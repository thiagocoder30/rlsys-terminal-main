"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupSessionAnalyzer = void 0;
const crypto_1 = __importDefault(require("crypto"));
const ROULETTE_VALUES = 37;
const VOISINS = new Set([22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25]);
const TIERS = new Set([27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33]);
const ORPHELINS = new Set([1, 20, 14, 31, 9, 17, 34, 6]);
/**
 * Analyses exactly the latest warm-up window used before live session decisions.
 *
 * The engine is deterministic, side-effect free and O(n) in time / O(37) in memory,
 * which keeps it safe for low-memory Termux devices while still producing institutional
 * safety gates for the future decision engine.
 */
class WarmupSessionAnalyzer {
    constructor(options = {}) {
        this.warmupSize = options.warmupSize ?? 100;
        this.minCompleteness = options.minCompleteness ?? 1;
        this.maxConcentrationRatio = options.maxConcentrationRatio ?? 0.18;
        this.maxRepeatRun = options.maxRepeatRun ?? 9;
    }
    analyze(history) {
        this.assertValid(history);
        const window = history.slice(-this.warmupSize);
        const counts = new Array(ROULETTE_VALUES).fill(0);
        let longestRepeatRun = 0;
        let currentRun = 0;
        let previous;
        let even = 0;
        let odd = 0;
        let low = 0;
        let high = 0;
        for (const value of window) {
            counts[value] += 1;
            currentRun = value === previous ? currentRun + 1 : 1;
            longestRepeatRun = Math.max(longestRepeatRun, currentRun);
            previous = value;
            if (value > 0) {
                if (value % 2 === 0)
                    even += 1;
                else
                    odd += 1;
                if (value <= 18)
                    low += 1;
                else
                    high += 1;
            }
        }
        const used = window.length;
        const uniqueNumbers = counts.filter(count => count > 0).length;
        const entropy = this.shannonEntropy(counts, used);
        const normalizedEntropy = used === 0 ? 0 : entropy / Math.log2(ROULETTE_VALUES);
        const maxNumberConcentration = used === 0 ? 0 : Math.max(...counts) / used;
        const repetitionPressure = used <= 1 ? 0 : this.countImmediateRepeats(window) / (used - 1);
        const zeroRatio = used === 0 ? 0 : counts[0] / used;
        const evenOddImbalance = this.imbalance(even, odd);
        const lowHighImbalance = this.imbalance(low, high);
        const expectedUniqueByThirdLaw = Math.min(ROULETTE_VALUES, Math.round(ROULETTE_VALUES * (1 - Math.exp(-used / ROULETTE_VALUES))));
        const thirdLawDeviation = expectedUniqueByThirdLaw === 0 ? 0 : Math.abs(uniqueNumbers - expectedUniqueByThirdLaw) / expectedUniqueByThirdLaw;
        const sectors = this.sectorExposure(window);
        const completeness = used / this.warmupSize;
        const blockers = this.blockers({ completeness, normalizedEntropy, maxNumberConcentration, longestRepeatRun, thirdLawDeviation });
        const riskLabel = this.riskLabel(blockers.length, normalizedEntropy, maxNumberConcentration, longestRepeatRun);
        const tableGate = this.tableGate(blockers, riskLabel, used);
        return {
            engineVersion: 'warmup-session-v1',
            sample: {
                received: history.length,
                used,
                warmupSize: this.warmupSize,
                completeness: this.round(completeness),
                checksum: this.checksum(window)
            },
            tableGate,
            operationalGate: 'BLOCKED',
            riskLabel,
            metrics: {
                uniqueNumbers,
                entropy: this.round(entropy),
                normalizedEntropy: this.round(normalizedEntropy),
                thirdLawDeviation: this.round(thirdLawDeviation),
                repetitionPressure: this.round(repetitionPressure),
                longestRepeatRun,
                maxNumberConcentration: this.round(maxNumberConcentration),
                zeroRatio: this.round(zeroRatio),
                evenOddImbalance: this.round(evenOddImbalance),
                lowHighImbalance: this.round(lowHighImbalance)
            },
            sectors,
            blockers,
            recommendations: this.recommendations(tableGate, blockers, sectors)
        };
    }
    assertValid(history) {
        if (!Array.isArray(history))
            throw new Error('Warm-up history must be an array.');
        for (let index = 0; index < history.length; index += 1) {
            const value = history[index];
            if (!Number.isInteger(value) || value < 0 || value > 36) {
                throw new Error(`Invalid roulette number at index ${index}: ${value}`);
            }
        }
    }
    shannonEntropy(counts, total) {
        if (total === 0)
            return 0;
        let entropy = 0;
        for (const count of counts) {
            if (count === 0)
                continue;
            const probability = count / total;
            entropy -= probability * Math.log2(probability);
        }
        return entropy;
    }
    countImmediateRepeats(values) {
        let repeats = 0;
        for (let index = 1; index < values.length; index += 1) {
            if (values[index] === values[index - 1])
                repeats += 1;
        }
        return repeats;
    }
    imbalance(left, right) {
        const total = left + right;
        if (total === 0)
            return 0;
        return Math.abs(left - right) / total;
    }
    sectorExposure(values) {
        const total = Math.max(1, values.length);
        const sectors = [
            { sector: 'zero', expected: 1 / ROULETTE_VALUES, predicate: (value) => value === 0 },
            { sector: 'voisins', expected: VOISINS.size / ROULETTE_VALUES, predicate: (value) => VOISINS.has(value) },
            { sector: 'tiers', expected: TIERS.size / ROULETTE_VALUES, predicate: (value) => TIERS.has(value) },
            { sector: 'orphelins', expected: ORPHELINS.size / ROULETTE_VALUES, predicate: (value) => ORPHELINS.has(value) }
        ];
        return sectors.map(item => {
            let hits = 0;
            for (const value of values)
                if (item.predicate(value))
                    hits += 1;
            const ratio = hits / total;
            const variance = Math.max(1e-9, item.expected * (1 - item.expected) / total);
            return {
                sector: item.sector,
                hits,
                ratio: this.round(ratio),
                zScore: this.round((ratio - item.expected) / Math.sqrt(variance))
            };
        });
    }
    blockers(input) {
        const blockers = [];
        if (input.completeness < this.minCompleteness)
            blockers.push('WARMUP_INCOMPLETE_100_ROUNDS');
        if (input.normalizedEntropy < 0.78)
            blockers.push('LOW_ENTROPY_TABLE_STATE');
        if (input.maxNumberConcentration > this.maxConcentrationRatio)
            blockers.push('NUMBER_CONCENTRATION_PRESSURE');
        if (input.longestRepeatRun > this.maxRepeatRun)
            blockers.push('EXCESSIVE_REPEAT_RUN');
        if (input.thirdLawDeviation > 0.42)
            blockers.push('THIRD_LAW_DISPERSION_DEVIATION');
        return blockers;
    }
    riskLabel(blockerCount, normalizedEntropy, maxConcentration, longestRepeatRun) {
        if (blockerCount >= 3 || normalizedEntropy < 0.68 || maxConcentration > 0.26 || longestRepeatRun > 14)
            return 'CRITICAL';
        if (blockerCount >= 2 || normalizedEntropy < 0.78 || maxConcentration > 0.18)
            return 'HIGH';
        if (blockerCount === 1 || normalizedEntropy < 0.88)
            return 'MODERATE';
        return 'LOW';
    }
    tableGate(blockers, riskLabel, used) {
        if (used < this.warmupSize || riskLabel === 'CRITICAL' || blockers.length >= 2)
            return 'NO_GO';
        if (riskLabel === 'HIGH' || blockers.length === 1)
            return 'OBSERVE';
        return 'GO_RESEARCH';
    }
    recommendations(tableGate, blockers, sectors) {
        const recommendations = ['Gate operacional permanece BLOQUEADO: warm-up classifica mesa, não autoriza aposta.'];
        if (tableGate === 'NO_GO')
            recommendations.push('Mesa hostil ou amostra incompleta: não iniciar sessão operacional.');
        if (tableGate === 'OBSERVE')
            recommendations.push('Manter observação por mais rodadas antes de qualquer decisão do Strategy Decision Engine.');
        if (tableGate === 'GO_RESEARCH')
            recommendations.push('Mesa apta apenas para análise de pesquisa; submeter aos módulos de benchmark, Monte Carlo e risco antes de qualquer sinal.');
        for (const blocker of blockers)
            recommendations.push(`Bloqueador ativo: ${blocker}.`);
        const strongestSector = [...sectors].sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))[0];
        if (strongestSector && Math.abs(strongestSector.zScore) >= 2) {
            recommendations.push(`Anomalia setorial de warm-up detectada em ${strongestSector.sector} com z=${strongestSector.zScore}.`);
        }
        return [...new Set(recommendations)];
    }
    checksum(values) {
        return crypto_1.default.createHash('sha256').update(JSON.stringify(values)).digest('hex');
    }
    round(value) {
        return Number(value.toFixed(6));
    }
}
exports.WarmupSessionAnalyzer = WarmupSessionAnalyzer;
