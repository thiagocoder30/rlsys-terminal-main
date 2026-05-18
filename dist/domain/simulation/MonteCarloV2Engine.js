"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonteCarloV2Engine = void 0;
const crypto_1 = __importDefault(require("crypto"));
const BootstrapResampler_1 = require("./BootstrapResampler");
const RouletteStats_1 = require("../services/RouletteStats");
const DEFAULT_OPTIONS = {
    simulations: 240,
    initialCapital: 1000,
    stakeFraction: 0.01,
    maxStakeFraction: 0.035,
    ruinThresholdFraction: 0.55,
    blockSize: 12,
    seed: 'rlsys-monte-carlo-v2',
    preserveLocalDependence: true
};
class MonteCarloV2Engine {
    constructor(options = {}) {
        this.stats = new RouletteStats_1.RouletteStats();
        this.resampler = new BootstrapResampler_1.BootstrapResampler();
        this.options = this.normalizeOptions(options);
    }
    run(history) {
        const values = this.validate(history);
        const paths = this.resampler.samples(values, this.options.simulations, {
            seed: this.options.seed,
            blockSize: this.options.blockSize,
            preserveLocalDependence: this.options.preserveLocalDependence,
            sampleSize: values.length
        }).map(sample => this.simulatePath(sample.id, sample.values, sample.replacementRatio));
        const finalCapitals = paths.map(path => path.finalCapital).sort(ascending);
        const rois = paths.map(path => path.roi).sort(ascending);
        const drawdowns = paths.map(path => path.maxDrawdown).sort(ascending);
        const ruinProbability = average(paths.map(path => path.ruin ? 1 : 0));
        const lossProbability = average(paths.map(path => path.roi < 0 ? 1 : 0));
        const catastrophicLossProbability = average(paths.map(path => path.finalCapital <= this.options.initialCapital * 0.7 ? 1 : 0));
        const expectedShortfallP05 = average(finalCapitals.slice(0, Math.max(1, Math.ceil(finalCapitals.length * 0.05))));
        const p95Drawdown = percentile(drawdowns, 0.95);
        const bootstrapConsistency = round(Math.max(0, Math.min(1, average(paths.map(path => path.roi > -0.03 ? 1 : 0)))));
        const sequenceDependencyRisk = this.sequenceDependencyRisk(paths);
        const fragilityIndex = round(Math.max(0, Math.min(1, ruinProbability * 0.42 + p95Drawdown * 0.36 + lossProbability * 0.12 + sequenceDependencyRisk * 0.1)));
        const robustnessScore = round(Math.max(0, Math.min(1, bootstrapConsistency * 0.35 + (1 - p95Drawdown) * 0.28 + (1 - ruinProbability) * 0.22 + (1 - sequenceDependencyRisk) * 0.15)));
        const tailRisk = this.tailRisk(ruinProbability, p95Drawdown, catastrophicLossProbability, expectedShortfallP05);
        const blockers = this.blockers(ruinProbability, p95Drawdown, robustnessScore, bootstrapConsistency, sequenceDependencyRisk, tailRisk);
        const reviewStatus = blockers.length >= 3 || tailRisk === 'CRITICAL'
            ? 'REJECTED'
            : robustnessScore >= 0.72 && bootstrapConsistency >= 0.62 && ruinProbability < 0.18
                ? 'ROBUSTNESS_CANDIDATE'
                : 'RESEARCH_REVIEW';
        return {
            engineVersion: 'monte-carlo-v2',
            reportId: this.reportId(values, paths),
            sampleSize: values.length,
            options: this.options,
            summary: {
                simulations: paths.length,
                medianEndingCapital: round(percentile(finalCapitals, 0.5)),
                p05EndingCapital: round(percentile(finalCapitals, 0.05)),
                p95EndingCapital: round(percentile(finalCapitals, 0.95)),
                medianRoi: round(percentile(rois, 0.5)),
                ruinProbability: round(ruinProbability),
                expectedMaxDrawdown: round(average(drawdowns)),
                p95MaxDrawdown: round(p95Drawdown),
                tailRisk,
                robustnessScore,
                fragilityIndex,
                bootstrapConsistency,
                sequenceDependencyRisk
            },
            confidenceBands: {
                endingCapital: confidenceBand(finalCapitals),
                roi: confidenceBand(rois),
                maxDrawdown: confidenceBand(drawdowns)
            },
            tail: {
                expectedShortfallP05: round(expectedShortfallP05),
                worstFinalCapital: round(finalCapitals[0] ?? 0),
                worstMaxDrawdown: round(drawdowns[drawdowns.length - 1] ?? 0),
                lossProbability: round(lossProbability),
                catastrophicLossProbability: round(catastrophicLossProbability)
            },
            governance: {
                operationalGate: 'BLOCKED',
                reviewStatus,
                blockers
            },
            paths: paths.slice(0, 32)
        };
    }
    validate(history) {
        const result = RouletteStats_1.RouletteStats.validate(history);
        if (!result.ok)
            throw new Error(`invalid_monte_carlo_v2_history: ${result.errors.slice(0, 3).join('; ')}`);
        if (result.values.length < 120)
            throw new Error('insufficient_monte_carlo_v2_history: minimum 120 valid spins required');
        if (this.options.initialCapital <= 0)
            throw new Error('invalid_initial_capital');
        if (this.options.stakeFraction <= 0 || this.options.maxStakeFraction <= 0)
            throw new Error('invalid_stake_configuration');
        return result.values;
    }
    simulatePath(id, values, replacementRatio) {
        const sectors = values.map(value => this.stats.sectorOf(value));
        const target = this.learnTarget(sectors);
        let capital = this.options.initialCapital;
        let peak = capital;
        let maxDrawdown = 0;
        let underwaterRun = 0;
        let longestUnderwaterRun = 0;
        for (const sector of sectors) {
            const drawdown = peak <= 0 ? 0 : (peak - capital) / peak;
            const throttle = drawdown > 0.3 ? 0.42 : drawdown > 0.2 ? 0.62 : drawdown > 0.1 ? 0.8 : 1;
            const stakeFraction = Math.min(this.options.maxStakeFraction, this.options.stakeFraction * throttle);
            const stake = Math.min(capital, capital * stakeFraction);
            const pnl = sector === target ? stake * this.payout(target) : -stake;
            capital = Math.max(0, capital + pnl);
            peak = Math.max(peak, capital);
            const nextDrawdown = peak <= 0 ? 0 : (peak - capital) / peak;
            maxDrawdown = Math.max(maxDrawdown, nextDrawdown);
            underwaterRun = nextDrawdown > 0 ? underwaterRun + 1 : 0;
            longestUnderwaterRun = Math.max(longestUnderwaterRun, underwaterRun);
        }
        const finalCapital = round(capital);
        const roi = round(finalCapital / this.options.initialCapital - 1);
        return {
            id,
            finalCapital,
            roi,
            maxDrawdown: round(maxDrawdown),
            ruin: finalCapital <= this.options.initialCapital * this.options.ruinThresholdFraction,
            longestUnderwaterRun,
            target,
            replacementRatio
        };
    }
    learnTarget(sectors) {
        const tradable = ['voisins', 'tiers', 'orphelins'];
        const train = sectors.slice(0, Math.max(50, Math.floor(sectors.length * 0.35)));
        const counts = new Map(tradable.map(sector => [sector, 0]));
        for (const sector of train) {
            if (sector === 'voisins' || sector === 'tiers' || sector === 'orphelins')
                counts.set(sector, (counts.get(sector) ?? 0) + 1);
        }
        return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    }
    payout(target) {
        const sectorSize = RouletteStats_1.RouletteStats.SECTORS[target]?.length ?? 1;
        return RouletteStats_1.RouletteStats.EUROPEAN_WHEEL_SIZE / sectorSize - 1;
    }
    normalizeOptions(options) {
        const merged = { ...DEFAULT_OPTIONS, ...options };
        return {
            ...merged,
            simulations: Math.max(50, Math.min(3000, Math.floor(merged.simulations))),
            blockSize: Math.max(1, Math.floor(merged.blockSize)),
            stakeFraction: Math.max(0.0001, Math.min(0.08, merged.stakeFraction)),
            maxStakeFraction: Math.max(0.0001, Math.min(0.12, merged.maxStakeFraction)),
            ruinThresholdFraction: Math.max(0.05, Math.min(0.95, merged.ruinThresholdFraction))
        };
    }
    sequenceDependencyRisk(paths) {
        const rois = paths.map(path => path.roi).sort(ascending);
        const spread = percentile(rois, 0.9) - percentile(rois, 0.1);
        const signInstability = Math.min(1, Math.abs(0.5 - average(paths.map(path => path.roi >= 0 ? 1 : 0))) * 2);
        const replacementPressure = average(paths.map(path => path.replacementRatio));
        return round(Math.max(0, Math.min(1, spread * 0.32 + (1 - signInstability) * 0.23 + replacementPressure * 0.12)));
    }
    tailRisk(ruinProbability, p95Drawdown, catastrophicLossProbability, expectedShortfallP05) {
        const shortfallRatio = 1 - expectedShortfallP05 / this.options.initialCapital;
        const score = ruinProbability * 0.35 + p95Drawdown * 0.35 + catastrophicLossProbability * 0.2 + Math.max(0, shortfallRatio) * 0.1;
        if (score >= 0.62)
            return 'CRITICAL';
        if (score >= 0.42)
            return 'HIGH';
        if (score >= 0.24)
            return 'MODERATE';
        return 'LOW';
    }
    blockers(ruinProbability, p95Drawdown, robustnessScore, bootstrapConsistency, sequenceDependencyRisk, tailRisk) {
        const blockers = ['operational_gate_blocked: Monte Carlo v2 is research evidence, not authorization to bet'];
        if (ruinProbability >= 0.2)
            blockers.push('ruin_probability_above_institutional_threshold');
        if (p95Drawdown >= 0.38)
            blockers.push('p95_drawdown_above_prudential_threshold');
        if (robustnessScore < 0.55)
            blockers.push('robustness_score_below_research_threshold');
        if (bootstrapConsistency < 0.52)
            blockers.push('bootstrap_consistency_insufficient');
        if (sequenceDependencyRisk > 0.62)
            blockers.push('sequence_dependency_risk_high');
        if (tailRisk === 'HIGH' || tailRisk === 'CRITICAL')
            blockers.push('tail_risk_requires_manual_review');
        return blockers;
    }
    reportId(values, paths) {
        return crypto_1.default.createHash('sha256').update(JSON.stringify({ values: values.slice(0, 64), n: values.length, options: this.options, paths: paths.slice(0, 12) })).digest('hex');
    }
}
exports.MonteCarloV2Engine = MonteCarloV2Engine;
function ascending(a, b) { return a - b; }
function average(values) {
    if (values.length === 0)
        return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function percentile(sortedValues, p) {
    if (sortedValues.length === 0)
        return 0;
    const sorted = [...sortedValues].sort(ascending);
    const index = Math.min(sorted.length - 1, Math.max(0, p * (sorted.length - 1)));
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper)
        return sorted[lower];
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}
function confidenceBand(sortedValues) {
    return {
        p01: round(percentile(sortedValues, 0.01)),
        p05: round(percentile(sortedValues, 0.05)),
        p25: round(percentile(sortedValues, 0.25)),
        p50: round(percentile(sortedValues, 0.5)),
        p75: round(percentile(sortedValues, 0.75)),
        p95: round(percentile(sortedValues, 0.95)),
        p99: round(percentile(sortedValues, 0.99))
    };
}
function round(value) {
    return Math.round(value * 10000) / 10000;
}
