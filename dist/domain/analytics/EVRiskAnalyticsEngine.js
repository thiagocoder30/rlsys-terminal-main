"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVRiskAnalyticsEngine = void 0;
const crypto_1 = __importDefault(require("crypto"));
const Result_1 = require("../shared/Result");
const DEFAULT_POLICY = {
    minSampleSize: 30,
    minEvPerUnitStake: 0.01,
    minProfitFactor: 1.05,
    maxDrawdownRate: 0.35,
    maxRiskOfRuin: 0.2,
    maxOutcomes: 100000
};
/**
 * Computes EV and risk analytics for resolved research signals.
 *
 * The engine is intentionally domain-only: it does not place bets, does not
 * read datasets from disk and does not depend on UI or infrastructure. It is a
 * scientific falsification layer that converts replay/offline outcomes into
 * bounded, deterministic risk metrics.
 *
 * Complexity:
 * - Time: O(n + g log g), where n is outcome count and g is group count.
 * - Space: O(g), bounded by the number of strategies/regimes in the sample.
 */
class EVRiskAnalyticsEngine {
    analyze(request) {
        try {
            const validation = this.validateRequest(request);
            if (validation.length > 0)
                return (0, Result_1.err)(new Result_1.DomainError(validation.join('; '), 'EV_RISK_INVALID_REQUEST'));
            const policy = this.normalizePolicy(request.policy ?? {});
            if (request.outcomes.length > policy.maxOutcomes) {
                return (0, Result_1.err)(new Result_1.DomainError(`outcome count ${request.outcomes.length} exceeds maxOutcomes ${policy.maxOutcomes}`, 'EV_RISK_TOO_LARGE'));
            }
            const metrics = this.computeMetrics(request);
            const strategyBreakdown = this.groupBy(request.outcomes, (outcome) => outcome.strategyId ?? 'UNKNOWN_STRATEGY');
            const regimeBreakdown = this.groupBy(request.outcomes, (outcome) => outcome.regime ?? 'UNKNOWN_REGIME');
            const blockers = this.blockers(metrics, policy);
            const warnings = this.warnings(metrics, request, policy);
            const status = blockers.length === 0 ? 'POSITIVE_EDGE_CANDIDATE' : 'NEGATIVE_OR_INCONCLUSIVE';
            const reportWithoutChecksum = {
                engineVersion: 'ev-risk-analytics-engine-v1',
                status,
                experimentId: request.experimentId,
                metrics,
                strategyBreakdown,
                regimeBreakdown,
                blockers,
                warnings
            };
            return (0, Result_1.ok)({ ...reportWithoutChecksum, checksum: this.checksum(reportWithoutChecksum) });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown ev/risk analytics error';
            return (0, Result_1.err)(new Result_1.DomainError(message, 'EV_RISK_UNEXPECTED_ERROR'));
        }
    }
    validateRequest(request) {
        if (!request || typeof request !== 'object')
            return ['request must be an object'];
        const errors = [];
        if (typeof request.experimentId !== 'string' || request.experimentId.trim().length === 0)
            errors.push('experimentId is required');
        if (!Array.isArray(request.outcomes) || request.outcomes.length === 0)
            errors.push('outcomes must be a non-empty array');
        if (request.totalFrames !== undefined && (!Number.isFinite(request.totalFrames) || request.totalFrames < 1))
            errors.push('totalFrames must be positive');
        if (request.startingBankroll !== undefined && (!Number.isFinite(request.startingBankroll) || request.startingBankroll <= 0))
            errors.push('startingBankroll must be positive');
        if (request.ruinThreshold !== undefined && (!Number.isFinite(request.ruinThreshold) || request.ruinThreshold < 0))
            errors.push('ruinThreshold must be non-negative');
        if (request.startingBankroll !== undefined && request.ruinThreshold !== undefined && request.ruinThreshold >= request.startingBankroll) {
            errors.push('ruinThreshold must be lower than startingBankroll');
        }
        const seen = new Set();
        for (let index = 0; index < (request.outcomes?.length ?? 0); index += 1) {
            const outcome = request.outcomes[index];
            if (!outcome || typeof outcome !== 'object') {
                errors.push(`outcome[${index}] must be an object`);
                continue;
            }
            if (typeof outcome.signalId !== 'string' || outcome.signalId.trim().length === 0)
                errors.push(`outcome[${index}].signalId is required`);
            if (seen.has(outcome.signalId))
                errors.push(`outcome[${index}].signalId must be unique`);
            seen.add(outcome.signalId);
            if (!Number.isFinite(outcome.stake) || outcome.stake <= 0)
                errors.push(`outcome[${index}].stake must be positive`);
            if (!Number.isFinite(outcome.netProfit))
                errors.push(`outcome[${index}].netProfit must be finite`);
            if (outcome.confidence !== undefined && (!Number.isFinite(outcome.confidence) || outcome.confidence < 0 || outcome.confidence > 1)) {
                errors.push(`outcome[${index}].confidence must be between 0 and 1`);
            }
            if (outcome.frameIndex !== undefined && (!Number.isFinite(outcome.frameIndex) || outcome.frameIndex < 0))
                errors.push(`outcome[${index}].frameIndex must be non-negative`);
        }
        return errors;
    }
    normalizePolicy(policy) {
        return {
            minSampleSize: this.positiveInteger(policy.minSampleSize, DEFAULT_POLICY.minSampleSize),
            minEvPerUnitStake: this.finiteNumber(policy.minEvPerUnitStake, DEFAULT_POLICY.minEvPerUnitStake),
            minProfitFactor: this.finiteNumber(policy.minProfitFactor, DEFAULT_POLICY.minProfitFactor),
            maxDrawdownRate: this.ratio(policy.maxDrawdownRate, DEFAULT_POLICY.maxDrawdownRate),
            maxRiskOfRuin: this.ratio(policy.maxRiskOfRuin, DEFAULT_POLICY.maxRiskOfRuin),
            maxOutcomes: this.positiveInteger(policy.maxOutcomes, DEFAULT_POLICY.maxOutcomes)
        };
    }
    computeMetrics(request) {
        let totalStake = 0;
        let totalNetProfit = 0;
        let grossProfit = 0;
        let grossLoss = 0;
        let wins = 0;
        let losses = 0;
        let confidenceSum = 0;
        let confidenceCount = 0;
        let equity = request.startingBankroll ?? 0;
        let peakEquity = equity;
        let minEquity = equity;
        let maxDrawdown = 0;
        let ruinEvents = 0;
        const ruinThreshold = request.ruinThreshold ?? 0;
        for (const outcome of request.outcomes) {
            totalStake += outcome.stake;
            totalNetProfit += outcome.netProfit;
            if (outcome.netProfit > 0) {
                grossProfit += outcome.netProfit;
                wins += 1;
            }
            else if (outcome.netProfit < 0) {
                grossLoss += Math.abs(outcome.netProfit);
                losses += 1;
            }
            if (outcome.confidence !== undefined) {
                confidenceSum += outcome.confidence;
                confidenceCount += 1;
            }
            if (request.startingBankroll !== undefined) {
                equity += outcome.netProfit;
                if (equity > peakEquity)
                    peakEquity = equity;
                if (equity < minEquity)
                    minEquity = equity;
                const drawdown = peakEquity - equity;
                if (drawdown > maxDrawdown)
                    maxDrawdown = drawdown;
                if (equity <= ruinThreshold)
                    ruinEvents += 1;
            }
            else {
                const syntheticEquity = totalNetProfit;
                if (syntheticEquity > peakEquity)
                    peakEquity = syntheticEquity;
                if (syntheticEquity < minEquity)
                    minEquity = syntheticEquity;
                const drawdown = peakEquity - syntheticEquity;
                if (drawdown > maxDrawdown)
                    maxDrawdown = drawdown;
            }
        }
        const sampleSize = request.outcomes.length;
        const denominatorEquity = request.startingBankroll ?? Math.max(totalStake, 1);
        const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? Number.POSITIVE_INFINITY : 0) : grossProfit / grossLoss;
        const maxDrawdownRate = this.safeRatio(maxDrawdown, denominatorEquity);
        const recoveryFactor = maxDrawdown === 0 ? (totalNetProfit > 0 ? Number.POSITIVE_INFINITY : 0) : totalNetProfit / maxDrawdown;
        const heuristicRisk = Math.min(1, Math.max(0, this.safeRatio(losses, sampleSize) * Math.max(maxDrawdownRate, this.safeRatio(grossLoss, Math.max(totalStake, 1)))));
        const riskOfRuinEstimate = ruinEvents > 0 ? 1 : this.round(heuristicRisk);
        return {
            sampleSize,
            totalStake: this.round(totalStake),
            totalNetProfit: this.round(totalNetProfit),
            expectedValuePerSignal: this.round(this.safeRatio(totalNetProfit, sampleSize)),
            expectedValuePerUnitStake: this.round(this.safeRatio(totalNetProfit, totalStake)),
            winRate: this.round(this.safeRatio(wins, sampleSize)),
            lossRate: this.round(this.safeRatio(losses, sampleSize)),
            averageWin: this.round(this.safeRatio(grossProfit, wins)),
            averageLoss: this.round(this.safeRatio(grossLoss, losses)),
            profitFactor: this.roundFinite(profitFactor),
            maxDrawdown: this.round(maxDrawdown),
            maxDrawdownRate: this.round(maxDrawdownRate),
            recoveryFactor: this.roundFinite(recoveryFactor),
            startingBankroll: request.startingBankroll,
            endingBankroll: request.startingBankroll === undefined ? undefined : this.round(equity),
            minEquity: request.startingBankroll === undefined ? undefined : this.round(minEquity),
            ruinEvents,
            riskOfRuinEstimate,
            signalFrequency: this.round(this.safeRatio(sampleSize, request.totalFrames ?? sampleSize)),
            averageConfidence: this.round(this.safeRatio(confidenceSum, confidenceCount))
        };
    }
    blockers(metrics, policy) {
        const blockers = [];
        if (metrics.sampleSize < policy.minSampleSize)
            blockers.push(`sample size ${metrics.sampleSize} below minSampleSize ${policy.minSampleSize}`);
        if (metrics.expectedValuePerUnitStake < policy.minEvPerUnitStake)
            blockers.push(`EV/unit ${metrics.expectedValuePerUnitStake} below threshold ${policy.minEvPerUnitStake}`);
        if (metrics.profitFactor < policy.minProfitFactor)
            blockers.push(`profit factor ${metrics.profitFactor} below threshold ${policy.minProfitFactor}`);
        if (metrics.maxDrawdownRate > policy.maxDrawdownRate)
            blockers.push(`drawdown rate ${metrics.maxDrawdownRate} exceeds threshold ${policy.maxDrawdownRate}`);
        if (metrics.riskOfRuinEstimate > policy.maxRiskOfRuin)
            blockers.push(`risk of ruin ${metrics.riskOfRuinEstimate} exceeds threshold ${policy.maxRiskOfRuin}`);
        return blockers;
    }
    warnings(metrics, request, policy) {
        const warnings = [];
        if (metrics.sampleSize < policy.minSampleSize * 3)
            warnings.push('sample size is still small for production inference');
        if (metrics.signalFrequency > 0.35)
            warnings.push('signal frequency is high; investigate overtrading risk');
        if (request.startingBankroll === undefined)
            warnings.push('startingBankroll not provided; drawdown is synthetic');
        if (metrics.averageConfidence === 0)
            warnings.push('confidence was not provided for any outcome');
        return warnings;
    }
    groupBy(outcomes, keySelector) {
        const groups = new Map();
        for (const outcome of outcomes) {
            const key = keySelector(outcome);
            const current = groups.get(key) ?? { count: 0, totalStake: 0, totalNetProfit: 0, wins: 0 };
            current.count += 1;
            current.totalStake += outcome.stake;
            current.totalNetProfit += outcome.netProfit;
            if (outcome.netProfit > 0)
                current.wins += 1;
            groups.set(key, current);
        }
        return [...groups.entries()]
            .map(([id, group]) => ({
            id,
            count: group.count,
            totalStake: this.round(group.totalStake),
            totalNetProfit: this.round(group.totalNetProfit),
            evPerUnitStake: this.round(this.safeRatio(group.totalNetProfit, group.totalStake)),
            winRate: this.round(this.safeRatio(group.wins, group.count))
        }))
            .sort((left, right) => right.evPerUnitStake - left.evPerUnitStake || right.count - left.count || left.id.localeCompare(right.id));
    }
    safeRatio(numerator, denominator) {
        if (denominator <= 0)
            return 0;
        return numerator / denominator;
    }
    round(value) {
        return Number(value.toFixed(6));
    }
    roundFinite(value) {
        if (!Number.isFinite(value))
            return value;
        return this.round(value);
    }
    finiteNumber(value, fallback) {
        if (value === undefined || !Number.isFinite(value))
            return fallback;
        return value;
    }
    positiveInteger(value, fallback) {
        if (value === undefined || !Number.isFinite(value) || value < 1)
            return fallback;
        return Math.trunc(value);
    }
    ratio(value, fallback) {
        if (value === undefined || !Number.isFinite(value))
            return fallback;
        return Math.min(1, Math.max(0, value));
    }
    checksum(value) {
        return crypto_1.default.createHash('sha256').update(JSON.stringify(value)).digest('hex');
    }
}
exports.EVRiskAnalyticsEngine = EVRiskAnalyticsEngine;
