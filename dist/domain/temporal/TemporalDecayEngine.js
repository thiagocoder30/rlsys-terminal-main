"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemporalDecayEngine = void 0;
const Result_1 = require("../shared/Result");
const DEFAULT_OPTIONS = {
    minDecayedConfidence: 0.42,
    minFreshnessWeight: 0.35,
    maxExpiredRatio: 0.34
};
/**
 * Applies exponential temporal decay to strategy signals.
 *
 * This domain engine is deterministic, side-effect free and independent from
 * storage, transport or UI. It models signal aging in spin units so old evidence
 * automatically loses influence before reaching the live decision layer.
 * Complexity is O(n) time and O(n) memory, bounded by the active strategy set.
 */
class TemporalDecayEngine {
    constructor(options = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.validateOptions(this.options);
    }
    evaluate(signals) {
        try {
            if (!Array.isArray(signals))
                throw new Error('invalid_temporal_decay_signals');
            const reports = [];
            let activeSignalCount = 0;
            let expiredSignalCount = 0;
            let decayedConfidenceSum = 0;
            let weightedFreshnessSum = 0;
            let weightSum = 0;
            for (const signal of signals) {
                this.validateSignal(signal);
                const report = this.scoreSignal(signal);
                reports.push(report);
                if (report.status === 'EXPIRED')
                    expiredSignalCount += 1;
                else
                    activeSignalCount += 1;
                decayedConfidenceSum += report.decayedConfidence;
                weightedFreshnessSum += report.freshnessWeight * report.sourceWeight;
                weightSum += report.sourceWeight;
            }
            reports.sort((left, right) => {
                const byStatus = statusWeight(right.status) - statusWeight(left.status);
                if (byStatus !== 0)
                    return byStatus;
                const byContribution = right.weightedContribution - left.weightedContribution;
                if (byContribution !== 0)
                    return byContribution;
                return left.signalId.localeCompare(right.signalId);
            });
            const averageDecayedConfidence = signals.length > 0 ? decayedConfidenceSum / signals.length : 0;
            const aggregateFreshnessWeight = weightSum > 0 ? weightedFreshnessSum / weightSum : 0;
            const blockers = this.blockers(signals.length, expiredSignalCount, averageDecayedConfidence, aggregateFreshnessWeight);
            const warnings = this.warnings(reports, aggregateFreshnessWeight);
            const decision = this.decision(blockers, signals.length, averageDecayedConfidence, aggregateFreshnessWeight);
            return (0, Result_1.ok)({
                engineVersion: 'temporal-decay-v1',
                signalCount: signals.length,
                activeSignalCount,
                expiredSignalCount,
                averageDecayedConfidence: round(averageDecayedConfidence),
                aggregateFreshnessWeight: round(aggregateFreshnessWeight),
                decision,
                signals: reports,
                blockers,
                warnings
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown_temporal_decay_error';
            return (0, Result_1.err)(new Result_1.DomainError(message, 'TEMPORAL_DECAY_FAILED'));
        }
    }
    scoreSignal(signal) {
        const ageSpins = signal.currentSpin - signal.observedAtSpin;
        const freshnessWeight = Math.pow(0.5, ageSpins / signal.halfLifeSpins);
        const decayedConfidence = clamp(signal.baseConfidence * freshnessWeight);
        const weightedContribution = clamp(decayedConfidence * signal.sourceWeight);
        const status = this.status(ageSpins, decayedConfidence, freshnessWeight, signal.hardTtlSpins);
        const blockers = this.signalBlockers(status, ageSpins, signal.hardTtlSpins, decayedConfidence, freshnessWeight);
        const warnings = this.signalWarnings(status, decayedConfidence, freshnessWeight);
        return {
            signalId: signal.signalId,
            label: signal.label,
            ageSpins,
            baseConfidence: round(signal.baseConfidence),
            decayedConfidence: round(decayedConfidence),
            freshnessWeight: round(freshnessWeight),
            sourceWeight: round(signal.sourceWeight),
            weightedContribution: round(weightedContribution),
            status,
            blockers,
            warnings
        };
    }
    status(ageSpins, decayedConfidence, freshnessWeight, hardTtlSpins) {
        if (ageSpins >= hardTtlSpins)
            return 'EXPIRED';
        if (decayedConfidence < this.options.minDecayedConfidence || freshnessWeight < this.options.minFreshnessWeight)
            return 'STALE';
        if (freshnessWeight < 0.66)
            return 'AGING';
        return 'FRESH';
    }
    blockers(signalCount, expiredSignalCount, averageDecayedConfidence, aggregateFreshnessWeight) {
        const blockers = [];
        if (signalCount === 0)
            blockers.push('Nenhum sinal temporal disponível para avaliação.');
        const expiredRatio = signalCount > 0 ? expiredSignalCount / signalCount : 1;
        if (expiredRatio > this.options.maxExpiredRatio)
            blockers.push('Proporção de sinais expirados excede política temporal.');
        if (averageDecayedConfidence < this.options.minDecayedConfidence)
            blockers.push('Confiança média decaída abaixo do mínimo temporal.');
        if (aggregateFreshnessWeight < this.options.minFreshnessWeight)
            blockers.push('Peso agregado de frescor abaixo do mínimo temporal.');
        return blockers;
    }
    warnings(reports, aggregateFreshnessWeight) {
        const warnings = [];
        const staleCount = reports.filter(report => report.status === 'STALE').length;
        if (staleCount > 0)
            warnings.push(`${staleCount} sinal(is) envelhecido(s) requerem observação.`);
        if (aggregateFreshnessWeight < 0.55)
            warnings.push('Frescor agregado em zona de atenção; reduzir peso operacional do sinal.');
        return warnings;
    }
    decision(blockers, signalCount, averageDecayedConfidence, aggregateFreshnessWeight) {
        if (blockers.length > 0)
            return 'BLOCK_EXPIRED';
        if (signalCount === 0)
            return 'BLOCK_EXPIRED';
        if (averageDecayedConfidence < this.options.minDecayedConfidence + 0.08 || aggregateFreshnessWeight < this.options.minFreshnessWeight + 0.12)
            return 'OBSERVE';
        return 'ALLOW';
    }
    signalBlockers(status, ageSpins, hardTtlSpins, decayedConfidence, freshnessWeight) {
        const blockers = [];
        if (status === 'EXPIRED')
            blockers.push(`Sinal expirado: idade ${ageSpins} >= TTL ${hardTtlSpins}.`);
        if (decayedConfidence < this.options.minDecayedConfidence)
            blockers.push('Confiança decaída abaixo do mínimo.');
        if (freshnessWeight < this.options.minFreshnessWeight)
            blockers.push('Frescor temporal abaixo do mínimo.');
        return blockers;
    }
    signalWarnings(status, decayedConfidence, freshnessWeight) {
        const warnings = [];
        if (status === 'AGING')
            warnings.push('Sinal ainda utilizável, mas já sofreu decaimento temporal relevante.');
        if (status === 'STALE')
            warnings.push('Sinal antigo deve ser observado antes de qualquer decisão.');
        if (decayedConfidence < 0.55 && freshnessWeight >= this.options.minFreshnessWeight)
            warnings.push('Confiança decaída em zona de atenção.');
        return warnings;
    }
    validateOptions(options) {
        if (!isUnit(options.minDecayedConfidence))
            throw new Error('invalid_temporal_decay_min_decayed_confidence');
        if (!isUnit(options.minFreshnessWeight))
            throw new Error('invalid_temporal_decay_min_freshness_weight');
        if (!isUnit(options.maxExpiredRatio))
            throw new Error('invalid_temporal_decay_max_expired_ratio');
    }
    validateSignal(signal) {
        if (!signal || typeof signal !== 'object')
            throw new Error('invalid_temporal_signal');
        if (!signal.signalId.trim())
            throw new Error('invalid_temporal_signal_id');
        if (!signal.label.trim())
            throw new Error('invalid_temporal_signal_label');
        if (!isNonNegativeInteger(signal.observedAtSpin))
            throw new Error('invalid_temporal_signal_observed_spin');
        if (!isNonNegativeInteger(signal.currentSpin))
            throw new Error('invalid_temporal_signal_current_spin');
        if (signal.currentSpin < signal.observedAtSpin)
            throw new Error('invalid_temporal_signal_negative_age');
        if (!isUnit(signal.baseConfidence))
            throw new Error('invalid_temporal_signal_base_confidence');
        if (!isPositive(signal.halfLifeSpins))
            throw new Error('invalid_temporal_signal_half_life');
        if (!isPositive(signal.hardTtlSpins))
            throw new Error('invalid_temporal_signal_ttl');
        if (signal.hardTtlSpins < signal.halfLifeSpins)
            throw new Error('invalid_temporal_signal_ttl_policy');
        if (!isUnit(signal.sourceWeight))
            throw new Error('invalid_temporal_signal_source_weight');
    }
}
exports.TemporalDecayEngine = TemporalDecayEngine;
function statusWeight(status) {
    if (status === 'FRESH')
        return 4;
    if (status === 'AGING')
        return 3;
    if (status === 'STALE')
        return 2;
    return 1;
}
function isUnit(value) {
    return Number.isFinite(value) && value >= 0 && value <= 1;
}
function isPositive(value) {
    return Number.isFinite(value) && value > 0;
}
function isNonNegativeInteger(value) {
    return Number.isInteger(value) && value >= 0;
}
function clamp(value) {
    if (!Number.isFinite(value))
        return 0;
    return Math.max(0, Math.min(1, value));
}
function round(value) {
    return Number(value.toFixed(6));
}
