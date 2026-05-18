"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyEngine = void 0;
const RouletteStats_1 = require("./RouletteStats");
const DEFAULT_OPTIONS = {
    minSampleSize: 120,
    maxSuggestedFraction: 0.01,
    fractionalKellyDivisor: 4,
    minSectorAbsZScore: 2.2,
    maxNormalizedEntropy: 0.985,
    minTransitionObservations: 8
};
class StrategyEngine {
    constructor(options = {}) {
        this.stats = new RouletteStats_1.RouletteStats();
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }
    analyze(history) {
        if (history.length < this.options.minSampleSize)
            return null;
        const metrics = this.stats.analyze(history);
        const warnings = [];
        const signals = [];
        const sectorBias = metrics.sectors
            .filter(sector => Math.abs(sector.zScore) >= this.options.minSectorAbsZScore)
            .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))[0];
        if (sectorBias) {
            signals.push({
                type: 'SECTOR_BIAS',
                target: sectorBias.name,
                confidence: Math.min(0.75, Math.abs(sectorBias.zScore) / 4),
                rationale: `Setor ${sectorBias.name} com z-score ${sectorBias.zScore.toFixed(2)} em ${metrics.sampleSize} giros.`
            });
        }
        const transitions = this.stats.nextSectorTransition(history);
        const transitionTotal = Array.from(transitions.values()).reduce((a, b) => a + b, 0);
        if (transitionTotal >= this.options.minTransitionObservations) {
            const [target, hits] = Array.from(transitions.entries()).sort((a, b) => b[1] - a[1])[0];
            signals.push({
                type: 'MARKOV_TRANSITION',
                target,
                confidence: Math.min(0.65, hits / transitionTotal),
                rationale: `Após o setor atual, ${target} ocorreu ${hits}/${transitionTotal} vezes no histórico.`
            });
        }
        if (metrics.normalizedEntropy > this.options.maxNormalizedEntropy) {
            warnings.push('Entropia normalizada alta: distribuição próxima do aleatório esperado.');
        }
        if (metrics.sampleSize < 500) {
            warnings.push('Amostra abaixo de 500 giros: use somente como triagem, não como prova de vantagem.');
        }
        if (signals.length === 0) {
            warnings.push('Nenhum sinal estatístico ultrapassou o limiar mínimo configurado.');
        }
        const riskLevel = this.calculateRisk(metrics, warnings.length, signals.length);
        const status = riskLevel === 'CRITICAL' || signals.length === 0 ? 'LOCKED' : 'ALLOWED';
        const fraction = status === 'ALLOWED' ? this.positionSizing(signals, riskLevel) : 0;
        return {
            status,
            reason: status === 'ALLOWED'
                ? 'Sinal estatístico detectado, porém exige validação por backtest antes de uso real.'
                : 'Entrada bloqueada por falta de evidência estatística suficiente.',
            metrics,
            signals,
            suggestedFraction: fraction,
            bankroll: fraction,
            risk: { level: riskLevel, warnings }
        };
    }
    calculateRisk(metrics, warningCount, signalCount) {
        if (metrics.normalizedEntropy > 0.995 || signalCount === 0)
            return 'CRITICAL';
        if (warningCount >= 2 || metrics.maxAbsNumberZScore > 4)
            return 'HIGH';
        if (warningCount === 1)
            return 'MEDIUM';
        return 'LOW';
    }
    positionSizing(signals, riskLevel) {
        const confidence = Math.max(...signals.map(signal => signal.confidence));
        const conservativeEdgeProxy = Math.max(0, confidence - 0.5) / 10;
        const fullKellyProxy = conservativeEdgeProxy;
        const fractionalKelly = fullKellyProxy / this.options.fractionalKellyDivisor;
        const riskMultiplier = riskLevel === 'LOW' ? 1 : riskLevel === 'MEDIUM' ? 0.5 : 0.25;
        return Math.min(this.options.maxSuggestedFraction, fractionalKelly * riskMultiplier);
    }
}
exports.StrategyEngine = StrategyEngine;
