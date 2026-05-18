"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedWalkForwardValidator = void 0;
const RouletteStats_1 = require("../services/RouletteStats");
const DEFAULT_OPTIONS = {
    trainingWindow: 300,
    validationWindow: 90,
    stepSize: 60,
    minFolds: 4,
    minTrades: 120,
    stakeFraction: 0.005
};
class AdvancedWalkForwardValidator {
    constructor(options = {}) {
        this.stats = new RouletteStats_1.RouletteStats();
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }
    evaluate(history) {
        const validation = RouletteStats_1.RouletteStats.validate(history);
        if (!validation.ok) {
            throw new Error(`invalid_walk_forward_history: ${validation.errors.slice(0, 3).join('; ')}`);
        }
        const values = validation.values;
        const folds = this.buildFolds(values);
        const summary = this.summarize(values.length, folds);
        return { summary, folds, options: this.options };
    }
    buildFolds(values) {
        const folds = [];
        let id = 0;
        for (let trainStart = 0; trainStart + this.options.trainingWindow + this.options.validationWindow <= values.length; trainStart += this.options.stepSize) {
            const trainEnd = trainStart + this.options.trainingWindow;
            const validationStart = trainEnd;
            const validationEnd = trainEnd + this.options.validationWindow;
            const train = values.slice(trainStart, trainEnd);
            const validation = values.slice(validationStart, validationEnd);
            const learnedTarget = this.learnSector(train);
            const baselineTarget = this.baselineSector(id);
            const trainEdgeProxy = this.edgeProxy(train, learnedTarget);
            const validationMetrics = this.replay(validation, learnedTarget);
            const baselineMetrics = this.replay(validation, baselineTarget);
            const degradation = trainEdgeProxy <= 0 ? 1 : Math.max(0, (trainEdgeProxy - validationMetrics.edgeProxy) / Math.max(0.000001, Math.abs(trainEdgeProxy)));
            const passed = validationMetrics.edgeProxy > 0 && validationMetrics.roi > baselineMetrics.roi && degradation <= 0.75;
            folds.push({
                id,
                trainStart,
                trainEnd,
                validationStart,
                validationEnd,
                learnedTarget,
                trainEdgeProxy: round(trainEdgeProxy),
                validationEdgeProxy: round(validationMetrics.edgeProxy),
                baselineEdgeProxy: round(baselineMetrics.edgeProxy),
                trades: validationMetrics.trades,
                hitRate: round(validationMetrics.hitRate),
                roi: round(validationMetrics.roi),
                baselineRoi: round(baselineMetrics.roi),
                maxDrawdown: round(validationMetrics.maxDrawdown),
                degradation: round(degradation),
                passed
            });
            id += 1;
        }
        return folds;
    }
    learnSector(values) {
        const sectors = ['voisins', 'tiers', 'orphelins'];
        const scored = sectors.map(sector => ({ sector, edge: this.edgeProxy(values, sector) }));
        scored.sort((a, b) => b.edge - a.edge || a.sector.localeCompare(b.sector));
        return scored[0].sector;
    }
    baselineSector(index) {
        const sectors = ['voisins', 'tiers', 'orphelins'];
        return sectors[index % sectors.length];
    }
    replay(values, sector) {
        let equity = 1;
        let peak = 1;
        let wins = 0;
        let maxDrawdown = 0;
        for (const value of values) {
            const won = this.stats.sectorOf(value) === sector;
            if (won)
                wins += 1;
            equity *= 1 + this.pnl(sector, won);
            peak = Math.max(peak, equity);
            maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak);
        }
        return {
            trades: values.length,
            hitRate: values.length === 0 ? 0 : wins / values.length,
            roi: equity - 1,
            maxDrawdown,
            edgeProxy: this.edgeProxy(values, sector)
        };
    }
    edgeProxy(values, sector) {
        if (values.length === 0)
            return 0;
        const observed = values.filter(value => this.stats.sectorOf(value) === sector).length / values.length;
        const expected = (RouletteStats_1.RouletteStats.SECTORS[sector]?.length ?? 0) / RouletteStats_1.RouletteStats.EUROPEAN_WHEEL_SIZE;
        return observed - expected;
    }
    pnl(sector, won) {
        if (!won)
            return -this.options.stakeFraction;
        const sectorSize = RouletteStats_1.RouletteStats.SECTORS[sector]?.length ?? 0;
        const payout = sectorSize > 0 ? RouletteStats_1.RouletteStats.EUROPEAN_WHEEL_SIZE / sectorSize - 1 : 0;
        return this.options.stakeFraction * payout;
    }
    summarize(sampleSize, folds) {
        const trades = folds.reduce((sum, fold) => sum + fold.trades, 0);
        const passedFolds = folds.filter(fold => fold.passed).length;
        const meanTrainEdge = mean(folds.map(fold => fold.trainEdgeProxy));
        const meanValidationEdge = mean(folds.map(fold => fold.validationEdgeProxy));
        const meanBaselineEdge = mean(folds.map(fold => fold.baselineEdgeProxy));
        const passRate = folds.length === 0 ? 0 : passedFolds / folds.length;
        const positiveValidationRate = folds.length === 0 ? 0 : folds.filter(fold => fold.validationEdgeProxy > 0).length / folds.length;
        const baselineOutperformanceRate = folds.length === 0 ? 0 : folds.filter(fold => fold.roi > fold.baselineRoi).length / folds.length;
        const degradationRatio = meanTrainEdge <= 0 ? 1 : Math.max(0, (meanTrainEdge - meanValidationEdge) / Math.max(0.000001, Math.abs(meanTrainEdge)));
        const maxDrawdown = Math.max(...folds.map(fold => fold.maxDrawdown), 0);
        const outOfSampleConsistency = round(positiveValidationRate * 0.45 + baselineOutperformanceRate * 0.35 + Math.max(0, 1 - degradationRatio) * 0.2);
        const overfitRiskScore = round(Math.min(1, Math.max(0, degradationRatio * 0.55 + (1 - positiveValidationRate) * 0.25 + Math.max(0, maxDrawdown - 0.2) * 0.8)));
        const robustnessScore = round(outOfSampleConsistency * 0.55 + passRate * 0.25 + Math.max(0, 1 - overfitRiskScore) * 0.2);
        const partial = {
            sampleSize,
            folds: folds.length,
            trades,
            passedFolds,
            passRate: round(passRate),
            meanTrainEdge: round(meanTrainEdge),
            meanValidationEdge: round(meanValidationEdge),
            meanBaselineEdge: round(meanBaselineEdge),
            outOfSampleConsistency,
            degradationRatio: round(degradationRatio),
            overfitRiskScore,
            robustnessScore,
            maxDrawdown: round(maxDrawdown)
        };
        const blockers = this.blockers(partial);
        return { ...partial, approval: this.approval(partial, blockers), blockers };
    }
    blockers(summary) {
        const blockers = [];
        if (summary.folds < this.options.minFolds)
            blockers.push('insufficient_walk_forward_folds');
        if (summary.trades < this.options.minTrades)
            blockers.push('insufficient_out_of_sample_trades');
        if (summary.meanValidationEdge <= 0)
            blockers.push('non_positive_out_of_sample_edge');
        if (summary.outOfSampleConsistency < 0.55)
            blockers.push('low_out_of_sample_consistency');
        if (summary.overfitRiskScore > 0.45)
            blockers.push('overfit_risk_above_limit');
        if (summary.maxDrawdown > 0.3)
            blockers.push('walk_forward_drawdown_above_limit');
        return blockers;
    }
    approval(summary, blockers) {
        if (blockers.includes('insufficient_walk_forward_folds') || blockers.includes('insufficient_out_of_sample_trades') || blockers.includes('overfit_risk_above_limit'))
            return 'REJECTED';
        if (blockers.length === 0 && summary.robustnessScore >= 0.68)
            return 'CANDIDATE';
        return 'RESEARCH_REVIEW';
    }
}
exports.AdvancedWalkForwardValidator = AdvancedWalkForwardValidator;
function mean(values) {
    if (values.length === 0)
        return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function round(value) {
    if (!Number.isFinite(value))
        return 0;
    return Number(value.toFixed(6));
}
