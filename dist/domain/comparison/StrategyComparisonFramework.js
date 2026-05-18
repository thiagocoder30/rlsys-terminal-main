"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyComparisonFramework = void 0;
const crypto_1 = __importDefault(require("crypto"));
const Result_1 = require("../shared/Result");
const DEFAULT_POLICY = {
    minSampleSize: 30,
    minEvPerUnitStake: 0.01,
    minProfitFactor: 1.05,
    maxDrawdownRate: 0.35,
    maxRiskOfRuin: 0.2,
    minLeaderScoreGap: 0.04,
    maxStrategies: 128
};
/**
 * Compares strategy research candidates using deterministic, risk-adjusted scoring.
 *
 * The framework is intentionally domain-only. It does not run strategies, does
 * not read datasets and does not authorize live stakes. Its role is to prevent
 * false leadership caused by raw win rate, small samples or hidden drawdown.
 *
 * Complexity:
 * - Time: O(n log n), dominated by ranking sort.
 * - Space: O(n), bounded by maxStrategies.
 */
class StrategyComparisonFramework {
    compare(request) {
        try {
            const validation = this.validateRequest(request);
            if (validation.length > 0)
                return (0, Result_1.err)(new Result_1.DomainError(validation.join('; '), 'STRATEGY_COMPARISON_INVALID_REQUEST'));
            const policy = this.normalizePolicy(request.policy ?? {});
            if (request.candidates.length > policy.maxStrategies) {
                return (0, Result_1.err)(new Result_1.DomainError(`strategy count ${request.candidates.length} exceeds maxStrategies ${policy.maxStrategies}`, 'STRATEGY_COMPARISON_TOO_LARGE'));
            }
            const scored = request.candidates.map((candidate) => this.scoreCandidate(candidate, policy));
            const ranking = this.rank(scored);
            const eligible = ranking.filter((entry) => entry.eligible);
            const blockers = this.blockers(eligible, ranking, policy);
            const warnings = this.warnings(ranking, policy);
            const leader = eligible[0];
            const runnerUp = eligible[1];
            const status = this.status(leader, runnerUp, blockers, policy);
            const reportWithoutChecksum = {
                engineVersion: 'strategy-comparison-framework-v1',
                status,
                experimentId: request.experimentId,
                leader: status === 'LEADER_FOUND' ? leader : undefined,
                runnerUp,
                ranking,
                blockers,
                warnings
            };
            return (0, Result_1.ok)({ ...reportWithoutChecksum, checksum: this.checksum(reportWithoutChecksum) });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown strategy comparison error';
            return (0, Result_1.err)(new Result_1.DomainError(message, 'STRATEGY_COMPARISON_UNEXPECTED_ERROR'));
        }
    }
    validateRequest(request) {
        if (!request || typeof request !== 'object')
            return ['request must be an object'];
        const errors = [];
        if (typeof request.experimentId !== 'string' || request.experimentId.trim().length === 0)
            errors.push('experimentId is required');
        if (!Array.isArray(request.candidates) || request.candidates.length === 0)
            errors.push('candidates must be a non-empty array');
        const ids = new Set();
        if (Array.isArray(request.candidates)) {
            for (const candidate of request.candidates) {
                if (!candidate || typeof candidate !== 'object') {
                    errors.push('candidate must be an object');
                    continue;
                }
                if (typeof candidate.strategyId !== 'string' || candidate.strategyId.trim().length === 0)
                    errors.push('strategyId is required');
                if (ids.has(candidate.strategyId))
                    errors.push(`duplicate strategyId ${candidate.strategyId}`);
                ids.add(candidate.strategyId);
                if (!Number.isFinite(candidate.sampleSize) || candidate.sampleSize < 0)
                    errors.push(`${candidate.strategyId}: sampleSize must be non-negative`);
                if (!Number.isFinite(candidate.totalStake) || candidate.totalStake < 0)
                    errors.push(`${candidate.strategyId}: totalStake must be non-negative`);
                if (!Number.isFinite(candidate.netProfit))
                    errors.push(`${candidate.strategyId}: netProfit must be finite`);
                if (!Number.isFinite(candidate.evPerUnitStake))
                    errors.push(`${candidate.strategyId}: evPerUnitStake must be finite`);
                if (!Number.isFinite(candidate.profitFactor) || candidate.profitFactor < 0)
                    errors.push(`${candidate.strategyId}: profitFactor must be non-negative`);
                if (!Number.isFinite(candidate.maxDrawdownRate) || candidate.maxDrawdownRate < 0 || candidate.maxDrawdownRate > 1)
                    errors.push(`${candidate.strategyId}: maxDrawdownRate must be 0..1`);
                if (!Number.isFinite(candidate.riskOfRuinEstimate) || candidate.riskOfRuinEstimate < 0 || candidate.riskOfRuinEstimate > 1)
                    errors.push(`${candidate.strategyId}: riskOfRuinEstimate must be 0..1`);
                if (!Number.isFinite(candidate.signalFrequency) || candidate.signalFrequency < 0 || candidate.signalFrequency > 1)
                    errors.push(`${candidate.strategyId}: signalFrequency must be 0..1`);
                if (candidate.confidence !== undefined && (!Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1))
                    errors.push(`${candidate.strategyId}: confidence must be 0..1`);
                if (candidate.regimes !== undefined && !Array.isArray(candidate.regimes))
                    errors.push(`${candidate.strategyId}: regimes must be an array`);
            }
        }
        return errors;
    }
    normalizePolicy(policy) {
        return {
            minSampleSize: this.positive(policy.minSampleSize, DEFAULT_POLICY.minSampleSize),
            minEvPerUnitStake: this.finite(policy.minEvPerUnitStake, DEFAULT_POLICY.minEvPerUnitStake),
            minProfitFactor: this.positive(policy.minProfitFactor, DEFAULT_POLICY.minProfitFactor),
            maxDrawdownRate: this.ratio(policy.maxDrawdownRate, DEFAULT_POLICY.maxDrawdownRate),
            maxRiskOfRuin: this.ratio(policy.maxRiskOfRuin, DEFAULT_POLICY.maxRiskOfRuin),
            minLeaderScoreGap: this.ratio(policy.minLeaderScoreGap, DEFAULT_POLICY.minLeaderScoreGap),
            maxStrategies: Math.max(1, Math.floor(this.positive(policy.maxStrategies, DEFAULT_POLICY.maxStrategies)))
        };
    }
    scoreCandidate(candidate, policy) {
        const reasons = [];
        if (candidate.sampleSize < policy.minSampleSize)
            reasons.push(`sample size ${candidate.sampleSize} below ${policy.minSampleSize}`);
        if (candidate.evPerUnitStake < policy.minEvPerUnitStake)
            reasons.push(`EV/unit ${candidate.evPerUnitStake.toFixed(6)} below ${policy.minEvPerUnitStake}`);
        if (candidate.profitFactor < policy.minProfitFactor)
            reasons.push(`profit factor ${candidate.profitFactor.toFixed(6)} below ${policy.minProfitFactor}`);
        if (candidate.maxDrawdownRate > policy.maxDrawdownRate)
            reasons.push(`drawdown rate ${candidate.maxDrawdownRate.toFixed(6)} above ${policy.maxDrawdownRate}`);
        if (candidate.riskOfRuinEstimate > policy.maxRiskOfRuin)
            reasons.push(`risk of ruin ${candidate.riskOfRuinEstimate.toFixed(6)} above ${policy.maxRiskOfRuin}`);
        const confidence = candidate.confidence ?? 0.5;
        const evScore = this.clamp(0.5 + candidate.evPerUnitStake * 2, 0, 1);
        const profitFactorScore = this.clamp((candidate.profitFactor - 1) / 2, 0, 1);
        const sampleScore = this.clamp(candidate.sampleSize / Math.max(policy.minSampleSize * 4, 1), 0, 1);
        const riskPenalty = (candidate.maxDrawdownRate * 0.65) + (candidate.riskOfRuinEstimate * 0.35);
        const signalPenalty = candidate.signalFrequency > 0.65 ? (candidate.signalFrequency - 0.65) * 0.2 : 0;
        const score = this.round6(this.clamp((evScore * 0.35) + (profitFactorScore * 0.2) + (confidence * 0.2) + (sampleScore * 0.15) + ((1 - riskPenalty) * 0.1) - signalPenalty, 0, 1));
        return {
            strategyId: candidate.strategyId,
            score,
            grade: this.grade(score, reasons.length === 0),
            eligible: reasons.length === 0,
            reasons,
            sampleSize: candidate.sampleSize,
            evPerUnitStake: this.round6(candidate.evPerUnitStake),
            profitFactor: this.round6(candidate.profitFactor),
            maxDrawdownRate: this.round6(candidate.maxDrawdownRate),
            riskOfRuinEstimate: this.round6(candidate.riskOfRuinEstimate),
            confidence: this.round6(confidence),
            regimes: this.normalizeRegimes(candidate.regimes ?? [])
        };
    }
    rank(scored) {
        return [...scored]
            .sort((a, b) => {
            if (b.score !== a.score)
                return b.score - a.score;
            if (b.evPerUnitStake !== a.evPerUnitStake)
                return b.evPerUnitStake - a.evPerUnitStake;
            if (a.riskOfRuinEstimate !== b.riskOfRuinEstimate)
                return a.riskOfRuinEstimate - b.riskOfRuinEstimate;
            return a.strategyId.localeCompare(b.strategyId);
        })
            .map((entry, index) => ({ ...entry, rank: index + 1 }));
    }
    blockers(eligible, ranking, policy) {
        const blockers = [];
        if (eligible.length === 0)
            blockers.push('no strategy candidate passed risk-adjusted eligibility policy');
        if (eligible.length > 1 && eligible[0].score - eligible[1].score < policy.minLeaderScoreGap)
            blockers.push(`leader score gap below ${policy.minLeaderScoreGap}`);
        if (ranking.length > 0 && ranking.every((entry) => entry.sampleSize < policy.minSampleSize * 2))
            blockers.push('all candidates remain in early sample regime');
        return blockers;
    }
    warnings(ranking, policy) {
        const warnings = [];
        const highFrequency = ranking.filter((entry) => entry.eligible && entry.score > 0.6 && entry.regimes.length <= 1);
        if (highFrequency.length > 0)
            warnings.push('leading candidates should be validated across multiple regimes before live use');
        if (ranking.some((entry) => entry.sampleSize < policy.minSampleSize * 3))
            warnings.push('some candidates have limited sample depth');
        return warnings;
    }
    status(leader, runnerUp, blockers, policy) {
        if (!leader || blockers.some((blocker) => blocker.includes('no strategy')))
            return 'BLOCKED';
        if (runnerUp && leader.score - runnerUp.score < policy.minLeaderScoreGap)
            return 'NO_CLEAR_LEADER';
        if (blockers.length > 0)
            return 'NO_CLEAR_LEADER';
        return 'LEADER_FOUND';
    }
    normalizeRegimes(regimes) {
        return [...new Set(regimes.map((regime) => regime.trim().toUpperCase()).filter((regime) => regime.length > 0))].sort();
    }
    grade(score, eligible) {
        if (!eligible)
            return 'D';
        if (score >= 0.75)
            return 'A';
        if (score >= 0.62)
            return 'B';
        if (score >= 0.5)
            return 'C';
        return 'D';
    }
    checksum(payload) {
        return crypto_1.default.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    }
    positive(value, fallback) {
        return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
    }
    finite(value, fallback) {
        return value !== undefined && Number.isFinite(value) ? value : fallback;
    }
    ratio(value, fallback) {
        return value !== undefined && Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback;
    }
    clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }
    round6(value) {
        return Math.round(value * 1000000) / 1000000;
    }
}
exports.StrategyComparisonFramework = StrategyComparisonFramework;
