"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SequentialBiasDetector = void 0;
exports.valueToState = valueToState;
const STATES = ['zero', 'low', 'mid', 'high'];
const EPSILON = 1e-12;
class SequentialBiasDetector {
    analyze(values) {
        const sanitized = values.filter(value => Number.isInteger(value) && value >= 0 && value <= 36);
        const states = sanitized.map(valueToState);
        const sampleSize = sanitized.length;
        const stateEntropy = shannonEntropy(countByState(states), sampleSize);
        const normalizedStateEntropy = normalizeEntropy(stateEntropy, STATES.length);
        const transition = this.transitionMatrix(states);
        const runLength = this.runLength(states, sanitized);
        const temporalClustering = this.temporalClustering(states);
        const sequentialEntropy = this.transitionEntropy(transition.counts);
        const normalizedSequentialEntropy = normalizeEntropy(sequentialEntropy, STATES.length * STATES.length);
        const entropyCompression = clamp01(1 - normalizedSequentialEntropy);
        const regimePersistence = clamp01((transition.stabilityScore * 0.45) + (runLength.anomalyScore * 0.35) + (temporalClustering.burstScore * 0.2));
        const sequentialBiasScore = this.score(sampleSize, entropyCompression, transition.stabilityScore, runLength.anomalyScore, temporalClustering.burstScore);
        const verdict = this.verdict(sampleSize, sequentialBiasScore, temporalClustering.label);
        return {
            sampleSize,
            stateEntropy: round(stateEntropy),
            normalizedStateEntropy: round(normalizedStateEntropy),
            sequentialEntropy: round(sequentialEntropy),
            normalizedSequentialEntropy: round(normalizedSequentialEntropy),
            entropyCompression: round(entropyCompression),
            transition,
            runLength,
            temporalClustering,
            regimePersistence: round(regimePersistence),
            sequentialBiasScore: round(sequentialBiasScore),
            verdict,
            recommendations: this.recommendations(sampleSize, verdict, temporalClustering.label)
        };
    }
    transitionMatrix(states) {
        const counts = emptyNestedCounts();
        for (let index = 1; index < states.length; index += 1)
            counts[states[index - 1]][states[index]] += 1;
        const probabilities = emptyNestedCounts();
        const dominantTransitions = [];
        const expected = 1 / STATES.length;
        let weightedDeviation = 0;
        let totalTransitions = 0;
        STATES.forEach(from => {
            const rowTotal = STATES.reduce((sum, to) => sum + counts[from][to], 0);
            totalTransitions += rowTotal;
            STATES.forEach(to => {
                const probability = rowTotal === 0 ? 0 : counts[from][to] / rowTotal;
                probabilities[from][to] = round(probability);
                if (counts[from][to] > 0) {
                    weightedDeviation += Math.abs(probability - expected) * (rowTotal / Math.max(1, states.length - 1));
                    dominantTransitions.push({ from, to, probability: round(probability), count: counts[from][to] });
                }
            });
        });
        dominantTransitions.sort((a, b) => b.probability - a.probability || b.count - a.count);
        const stabilityScore = totalTransitions === 0 ? 0 : clamp01(weightedDeviation * 1.5);
        return {
            states: STATES,
            counts,
            probabilities,
            stabilityScore: round(stabilityScore),
            dominantTransitions: dominantTransitions.slice(0, 8)
        };
    }
    runLength(states, values) {
        if (states.length === 0) {
            return { maxExactRun: 0, maxStateRun: 0, averageStateRun: 0, anomalyScore: 0, longestRuns: [] };
        }
        let maxExactRun = 1;
        let currentExactRun = 1;
        for (let index = 1; index < values.length; index += 1) {
            currentExactRun = values[index] === values[index - 1] ? currentExactRun + 1 : 1;
            maxExactRun = Math.max(maxExactRun, currentExactRun);
        }
        const runs = [];
        let startIndex = 0;
        for (let index = 1; index <= states.length; index += 1) {
            if (states[index] !== states[startIndex]) {
                runs.push({ state: states[startIndex], length: index - startIndex, startIndex, endIndex: index - 1 });
                startIndex = index;
            }
        }
        runs.sort((a, b) => b.length - a.length);
        const maxStateRun = runs[0]?.length ?? 0;
        const averageStateRun = states.length / Math.max(1, runs.length);
        const expectedMeanRun = 1 / (1 - (1 / STATES.length));
        const anomalyScore = clamp01(((maxStateRun / Math.max(1, expectedMeanRun)) - 1) / 8 + (maxExactRun > 3 ? 0.08 : 0));
        return {
            maxExactRun,
            maxStateRun,
            averageStateRun: round(averageStateRun),
            anomalyScore: round(anomalyScore),
            longestRuns: runs.slice(0, 8)
        };
    }
    temporalClustering(states) {
        const sampleSize = states.length;
        const windowSize = Math.max(20, Math.min(120, Math.floor(sampleSize / 8)));
        if (sampleSize < windowSize || sampleSize === 0) {
            return { label: 'none', burstScore: 0, maxWindowDeviation: 0, windowSize, anomalousWindows: [] };
        }
        const anomalousWindows = [];
        let maxWindowDeviation = 0;
        const expected = 1 / STATES.length;
        const step = Math.max(1, Math.floor(windowSize / 2));
        for (let start = 0; start + windowSize <= sampleSize; start += step) {
            const window = states.slice(start, start + windowSize);
            const counts = countByState(window);
            const dominant = STATES.map(state => ({ state, share: counts[state] / windowSize })).sort((a, b) => b.share - a.share)[0];
            const deviation = Math.max(0, dominant.share - expected);
            maxWindowDeviation = Math.max(maxWindowDeviation, deviation);
            if (dominant.share >= 0.55) {
                anomalousWindows.push({ startIndex: start, endIndex: start + windowSize - 1, dominantState: dominant.state, dominantShare: round(dominant.share) });
            }
        }
        const burstScore = clamp01(maxWindowDeviation / 0.5 + Math.min(0.2, anomalousWindows.length / 20));
        const label = burstScore >= 0.7 ? 'high' : burstScore >= 0.45 ? 'moderate' : burstScore >= 0.25 ? 'low' : 'none';
        return { label, burstScore: round(burstScore), maxWindowDeviation: round(maxWindowDeviation), windowSize, anomalousWindows: anomalousWindows.slice(0, 10) };
    }
    transitionEntropy(counts) {
        const allTransitions = STATES.flatMap(from => STATES.map(to => counts[from][to]));
        const total = allTransitions.reduce((sum, count) => sum + count, 0);
        return shannonEntropyFromCounts(allTransitions, total);
    }
    score(sampleSize, entropyCompression, transitionStability, runAnomaly, burstScore) {
        const samplePenalty = sampleSize < 120 ? 0.45 : sampleSize < 500 ? 0.72 : sampleSize < 2000 ? 0.88 : 1;
        return clamp01((entropyCompression * 0.25 + transitionStability * 0.25 + runAnomaly * 0.25 + burstScore * 0.25) * samplePenalty);
    }
    verdict(sampleSize, score, clusterLabel) {
        if (sampleSize < 120)
            return 'NO_TEMPORAL_EVIDENCE';
        if (score >= 0.72 && (clusterLabel === 'high' || clusterLabel === 'moderate'))
            return 'STRONG_TEMPORAL_EVIDENCE';
        if (score >= 0.55)
            return 'MODERATE_TEMPORAL_EVIDENCE';
        if (score >= 0.35)
            return 'WEAK_TEMPORAL_EVIDENCE';
        return 'NO_TEMPORAL_EVIDENCE';
    }
    recommendations(sampleSize, verdict, clusterLabel) {
        const recommendations = [];
        if (sampleSize < 500)
            recommendations.push('Aumentar amostra para 500+ spins antes de inferir persistência temporal.');
        if (sampleSize < 10000)
            recommendations.push('Para pesquisa institucional, segmentar 10.000+ spins por mesa e janela temporal.');
        if (verdict !== 'NO_TEMPORAL_EVIDENCE')
            recommendations.push('Validar dependência sequencial em out-of-sample e comparar contra simulação uniforme.');
        if (clusterLabel === 'high' || clusterLabel === 'moderate')
            recommendations.push('Investigar clusters temporais com controle de duplicatas, horário e fonte da mesa.');
        if (verdict === 'NO_TEMPORAL_EVIDENCE')
            recommendations.push('Não inferir previsibilidade: sequência compatível com ruído temporal ou amostra insuficiente.');
        return recommendations;
    }
}
exports.SequentialBiasDetector = SequentialBiasDetector;
function valueToState(value) {
    if (value === 0)
        return 'zero';
    if (value >= 1 && value <= 12)
        return 'low';
    if (value >= 13 && value <= 24)
        return 'mid';
    return 'high';
}
function emptyNestedCounts() {
    return STATES.reduce((outer, from) => {
        outer[from] = STATES.reduce((inner, to) => {
            inner[to] = 0;
            return inner;
        }, {});
        return outer;
    }, {});
}
function countByState(states) {
    return STATES.reduce((acc, state) => {
        acc[state] = states.filter(item => item === state).length;
        return acc;
    }, {});
}
function shannonEntropy(counts, sampleSize) {
    return shannonEntropyFromCounts(STATES.map(state => counts[state]), sampleSize);
}
function shannonEntropyFromCounts(counts, total) {
    if (total <= 0)
        return 0;
    return counts.reduce((entropy, count) => {
        if (count <= 0)
            return entropy;
        const p = count / total;
        return entropy - p * Math.log2(Math.max(p, EPSILON));
    }, 0);
}
function normalizeEntropy(entropy, categories) {
    if (categories <= 1)
        return 0;
    return clamp01(entropy / Math.log2(categories));
}
function clamp01(value) {
    if (!Number.isFinite(value))
        return 0;
    return Math.max(0, Math.min(1, value));
}
function round(value) {
    if (!Number.isFinite(value))
        return 0;
    return Number(value.toFixed(6));
}
