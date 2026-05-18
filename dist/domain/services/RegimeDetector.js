"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegimeDetector = void 0;
const RouletteStats_1 = require("./RouletteStats");
const DEFAULT_OPTIONS = {
    windowSize: 80,
    stepSize: 40,
    minWindows: 3
};
class RegimeDetector {
    constructor(options = {}) {
        this.stats = new RouletteStats_1.RouletteStats();
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }
    detect(history) {
        const windows = this.buildWindows(history);
        const warnings = [];
        if (windows.length < this.options.minWindows) {
            warnings.push(`Amostra produz apenas ${windows.length} janelas; mínimo para regime: ${this.options.minWindows}.`);
            return {
                label: 'UNSTABLE',
                stabilityScore: 0,
                windows,
                entropyTrend: 0,
                sectorDriftScore: 0,
                warnings
            };
        }
        const entropies = windows.map(window => window.normalizedEntropy);
        const drifts = windows.map(window => window.maxSectorAbsZScore);
        const entropyTrend = entropies[entropies.length - 1] - entropies[0];
        const entropyStd = this.std(entropies);
        const driftMean = this.mean(drifts);
        const driftStd = this.std(drifts);
        const sectorDriftScore = this.clamp((driftMean - 1.2) / 2.8);
        const stabilityScore = this.clamp(1 - (entropyStd * 8 + driftStd / 4));
        let label = 'RANDOM_LIKE';
        if (stabilityScore < 0.35 || Math.abs(entropyTrend) > 0.08)
            label = 'UNSTABLE';
        else if (sectorDriftScore > 0.55 && stabilityScore >= 0.45)
            label = 'SECTOR_DRIFT';
        else if (sectorDriftScore > 0.25 || Math.abs(entropyTrend) > 0.035)
            label = 'TRANSITIONAL';
        if (label === 'RANDOM_LIKE')
            warnings.push('Regime atual parece compatível com aleatoriedade operacional.');
        if (label === 'UNSTABLE')
            warnings.push('Regime instável: sinais recentes não devem ser extrapolados.');
        if (label === 'TRANSITIONAL')
            warnings.push('Regime transicional: reduzir agressividade e exigir validação externa.');
        return {
            label,
            stabilityScore,
            windows,
            entropyTrend,
            sectorDriftScore,
            warnings
        };
    }
    buildWindows(history) {
        const windows = [];
        for (let start = 0; start + this.options.windowSize <= history.length; start += this.options.stepSize) {
            const end = start + this.options.windowSize;
            const metrics = this.stats.analyze(history.slice(start, end));
            windows.push({
                start,
                end,
                normalizedEntropy: metrics.normalizedEntropy,
                maxSectorAbsZScore: Math.max(...metrics.sectors.map(sector => Math.abs(sector.zScore))),
                chiSquare: metrics.chiSquare
            });
        }
        return windows;
    }
    mean(values) {
        return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
    }
    std(values) {
        if (values.length <= 1)
            return 0;
        const average = this.mean(values);
        const variance = values.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / values.length;
        return Math.sqrt(variance);
    }
    clamp(value) {
        if (!Number.isFinite(value))
            return 0;
        return Math.min(1, Math.max(0, value));
    }
}
exports.RegimeDetector = RegimeDetector;
