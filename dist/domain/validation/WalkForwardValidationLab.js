"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalkForwardValidationLab = void 0;
const crypto_1 = __importDefault(require("crypto"));
const Result_1 = require("../shared/Result");
const DEFAULT_POLICY = {
    trainWindowSize: 60,
    validationWindowSize: 30,
    stepSize: 30,
    minValidationWindows: 3,
    minValidationSamples: 30,
    minValidationEvPerUnitStake: 0.01,
    maxTrainValidationEvGap: 0.2,
    minPassedValidationRate: 0.6,
    maxValidationDrawdownRate: 0.35,
    maxRiskOfRuinEstimate: 0.25,
    maxOutcomes: 100000
};
/**
 * Performs deterministic walk-forward validation for offline research outcomes.
 *
 * The lab intentionally does not train strategies and does not authorize live
 * execution. It tests whether research outcomes remain profitable out-of-sample
 * across rolling validation windows, blocking candidates that only look strong
 * in training windows.
 *
 * Complexity:
 * - Time: O(n + w * v), where n is outcome count, w is number of windows and v
 *   is validation window size for drawdown scanning. Windows are bounded by
 *   maxOutcomes and policy sizes.
 * - Space: O(n + w), using prefix sums for deterministic aggregate metrics.
 */
class WalkForwardValidationLab {
    validate(request) {
        try {
            const validation = this.validateRequest(request);
            if (validation.length > 0)
                return (0, Result_1.err)(new Result_1.DomainError(validation.join('; '), 'WALK_FORWARD_INVALID_REQUEST'));
            const policy = this.normalizePolicy(request.policy);
            if (request.outcomes.length > policy.maxOutcomes) {
                return (0, Result_1.err)(new Result_1.DomainError(`outcome count ${request.outcomes.length} exceeds maxOutcomes ${policy.maxOutcomes}`, 'WALK_FORWARD_TOO_LARGE'));
            }
            const blockers = [];
            const warnings = [];
            const minimumRequired = policy.trainWindowSize + policy.validationWindowSize;
            if (request.outcomes.length < minimumRequired) {
                blockers.push(`outcomes ${request.outcomes.length} below minimum walk-forward requirement ${minimumRequired}`);
            }
            const windows = blockers.length > 0 ? [] : this.windows(request.outcomes, policy, request.startingBankroll);
            const aggregate = this.aggregate(windows);
            blockers.push(...this.blockers(aggregate, policy, windows));
            warnings.push(...this.warnings(aggregate, policy, windows));
            const status = this.status(blockers, aggregate, policy, windows);
            const reportWithoutChecksum = {
                engineVersion: 'walk-forward-validation-lab-v1',
                experimentId: request.experimentId.trim(),
                status,
                aggregate,
                windows,
                blockers,
                warnings
            };
            return (0, Result_1.ok)({ ...reportWithoutChecksum, checksum: this.checksum(reportWithoutChecksum) });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown walk-forward validation error';
            return (0, Result_1.err)(new Result_1.DomainError(message, 'WALK_FORWARD_UNEXPECTED_ERROR'));
        }
    }
    validateRequest(request) {
        if (!request || typeof request !== 'object')
            return ['request must be an object'];
        const errors = [];
        if (typeof request.experimentId !== 'string' || request.experimentId.trim().length === 0)
            errors.push('experimentId is required');
        if (!Array.isArray(request.outcomes))
            errors.push('outcomes must be an array');
        if (request.startingBankroll !== undefined && (!Number.isFinite(request.startingBankroll) || request.startingBankroll <= 0))
            errors.push('startingBankroll must be positive');
        let previousFrame = -1;
        const seen = new Set();
        for (let index = 0; index < (Array.isArray(request.outcomes) ? request.outcomes.length : 0); index += 1) {
            const outcome = request.outcomes[index];
            if (!outcome || typeof outcome !== 'object') {
                errors.push(`outcome[${index}] must be an object`);
                continue;
            }
            if (typeof outcome.signalId !== 'string' || outcome.signalId.trim().length === 0)
                errors.push(`outcome[${index}].signalId is required`);
            if (seen.has(outcome.signalId))
                errors.push(`duplicate signalId ${outcome.signalId}`);
            seen.add(outcome.signalId);
            if (!Number.isInteger(outcome.frameIndex) || outcome.frameIndex < 0)
                errors.push(`outcome[${index}].frameIndex must be a non-negative integer`);
            if (Number.isInteger(outcome.frameIndex) && outcome.frameIndex <= previousFrame)
                errors.push(`outcomes must be strictly ordered by frameIndex at index ${index}`);
            if (Number.isInteger(outcome.frameIndex))
                previousFrame = outcome.frameIndex;
            if (!Number.isFinite(outcome.stake) || outcome.stake <= 0)
                errors.push(`outcome[${index}].stake must be positive`);
            if (!Number.isFinite(outcome.netProfit))
                errors.push(`outcome[${index}].netProfit must be finite`);
            if (outcome.confidence !== undefined && (!Number.isFinite(outcome.confidence) || outcome.confidence < 0 || outcome.confidence > 1))
                errors.push(`outcome[${index}].confidence must be between 0 and 1`);
        }
        const policy = request.policy;
        if (policy) {
            if (policy.trainWindowSize !== undefined && (!Number.isInteger(policy.trainWindowSize) || policy.trainWindowSize < 1))
                errors.push('policy.trainWindowSize must be positive integer');
            if (policy.validationWindowSize !== undefined && (!Number.isInteger(policy.validationWindowSize) || policy.validationWindowSize < 1))
                errors.push('policy.validationWindowSize must be positive integer');
            if (policy.stepSize !== undefined && (!Number.isInteger(policy.stepSize) || policy.stepSize < 1))
                errors.push('policy.stepSize must be positive integer');
            if (policy.minValidationWindows !== undefined && (!Number.isInteger(policy.minValidationWindows) || policy.minValidationWindows < 1))
                errors.push('policy.minValidationWindows must be positive integer');
            if (policy.minValidationSamples !== undefined && (!Number.isInteger(policy.minValidationSamples) || policy.minValidationSamples < 1))
                errors.push('policy.minValidationSamples must be positive integer');
            if (policy.minValidationEvPerUnitStake !== undefined && !Number.isFinite(policy.minValidationEvPerUnitStake))
                errors.push('policy.minValidationEvPerUnitStake must be finite');
            if (policy.maxTrainValidationEvGap !== undefined && (!Number.isFinite(policy.maxTrainValidationEvGap) || policy.maxTrainValidationEvGap < 0))
                errors.push('policy.maxTrainValidationEvGap must be non-negative');
            if (policy.minPassedValidationRate !== undefined && (!Number.isFinite(policy.minPassedValidationRate) || policy.minPassedValidationRate < 0 || policy.minPassedValidationRate > 1))
                errors.push('policy.minPassedValidationRate must be between 0 and 1');
            if (policy.maxValidationDrawdownRate !== undefined && (!Number.isFinite(policy.maxValidationDrawdownRate) || policy.maxValidationDrawdownRate < 0 || policy.maxValidationDrawdownRate > 1))
                errors.push('policy.maxValidationDrawdownRate must be between 0 and 1');
            if (policy.maxRiskOfRuinEstimate !== undefined && (!Number.isFinite(policy.maxRiskOfRuinEstimate) || policy.maxRiskOfRuinEstimate < 0 || policy.maxRiskOfRuinEstimate > 1))
                errors.push('policy.maxRiskOfRuinEstimate must be between 0 and 1');
            if (policy.maxOutcomes !== undefined && (!Number.isInteger(policy.maxOutcomes) || policy.maxOutcomes < 1))
                errors.push('policy.maxOutcomes must be positive integer');
        }
        return errors;
    }
    normalizePolicy(policy) {
        return {
            trainWindowSize: Math.max(1, Math.trunc(policy?.trainWindowSize ?? DEFAULT_POLICY.trainWindowSize)),
            validationWindowSize: Math.max(1, Math.trunc(policy?.validationWindowSize ?? DEFAULT_POLICY.validationWindowSize)),
            stepSize: Math.max(1, Math.trunc(policy?.stepSize ?? DEFAULT_POLICY.stepSize)),
            minValidationWindows: Math.max(1, Math.trunc(policy?.minValidationWindows ?? DEFAULT_POLICY.minValidationWindows)),
            minValidationSamples: Math.max(1, Math.trunc(policy?.minValidationSamples ?? DEFAULT_POLICY.minValidationSamples)),
            minValidationEvPerUnitStake: policy?.minValidationEvPerUnitStake ?? DEFAULT_POLICY.minValidationEvPerUnitStake,
            maxTrainValidationEvGap: Math.max(0, policy?.maxTrainValidationEvGap ?? DEFAULT_POLICY.maxTrainValidationEvGap),
            minPassedValidationRate: this.clamp(policy?.minPassedValidationRate ?? DEFAULT_POLICY.minPassedValidationRate, 0, 1),
            maxValidationDrawdownRate: this.clamp(policy?.maxValidationDrawdownRate ?? DEFAULT_POLICY.maxValidationDrawdownRate, 0, 1),
            maxRiskOfRuinEstimate: this.clamp(policy?.maxRiskOfRuinEstimate ?? DEFAULT_POLICY.maxRiskOfRuinEstimate, 0, 1),
            maxOutcomes: Math.max(1, Math.trunc(policy?.maxOutcomes ?? DEFAULT_POLICY.maxOutcomes))
        };
    }
    windows(outcomes, policy, startingBankroll) {
        const prefix = this.prefix(outcomes);
        const windows = [];
        let windowIndex = 0;
        for (let start = 0; start + policy.trainWindowSize + policy.validationWindowSize <= outcomes.length; start += policy.stepSize) {
            const trainStart = start;
            const trainEnd = start + policy.trainWindowSize;
            const validationStart = trainEnd;
            const validationEnd = validationStart + policy.validationWindowSize;
            const train = this.metrics(prefix, outcomes, trainStart, trainEnd, startingBankroll);
            const validation = this.metrics(prefix, outcomes, validationStart, validationEnd, startingBankroll);
            const evGap = Math.abs(train.evPerUnitStake - validation.evPerUnitStake);
            const reasons = this.windowReasons(validation, evGap, policy);
            const status = reasons.length === 0 ? 'PASSED' : validation.evPerUnitStake < 0 ? 'FAILED' : 'REVIEW';
            windows.push({
                index: windowIndex,
                trainStart,
                trainEnd: trainEnd - 1,
                validationStart,
                validationEnd: validationEnd - 1,
                status,
                train,
                validation,
                evGap: this.round(evGap),
                reasons
            });
            windowIndex += 1;
        }
        return windows;
    }
    prefix(outcomes) {
        const stake = [0];
        const profit = [0];
        const wins = [0];
        const confidence = [0];
        const confidenceCount = [0];
        for (const outcome of outcomes) {
            stake.push(stake[stake.length - 1] + outcome.stake);
            profit.push(profit[profit.length - 1] + outcome.netProfit);
            wins.push(wins[wins.length - 1] + (outcome.netProfit > 0 ? 1 : 0));
            confidence.push(confidence[confidence.length - 1] + (outcome.confidence ?? 0));
            confidenceCount.push(confidenceCount[confidenceCount.length - 1] + (outcome.confidence === undefined ? 0 : 1));
        }
        return { stake, profit, wins, confidence, confidenceCount };
    }
    metrics(prefix, outcomes, start, end, startingBankroll) {
        const sampleSize = end - start;
        const totalStake = prefix.stake[end] - prefix.stake[start];
        const totalNetProfit = prefix.profit[end] - prefix.profit[start];
        const wins = prefix.wins[end] - prefix.wins[start];
        const confidenceSum = prefix.confidence[end] - prefix.confidence[start];
        const confidenceCount = prefix.confidenceCount[end] - prefix.confidenceCount[start];
        const drawdown = this.maxDrawdown(outcomes, start, end);
        const capitalBase = startingBankroll ?? Math.max(totalStake, 1);
        return {
            sampleSize,
            totalStake: this.round(totalStake),
            totalNetProfit: this.round(totalNetProfit),
            evPerUnitStake: this.round(totalStake === 0 ? 0 : totalNetProfit / totalStake),
            winRate: this.round(sampleSize === 0 ? 0 : wins / sampleSize),
            maxDrawdown: this.round(drawdown),
            maxDrawdownRate: this.round(capitalBase <= 0 ? 0 : drawdown / capitalBase),
            averageConfidence: this.round(confidenceCount === 0 ? 0 : confidenceSum / confidenceCount)
        };
    }
    maxDrawdown(outcomes, start, end) {
        let equity = 0;
        let peak = 0;
        let maxDrawdown = 0;
        for (let index = start; index < end; index += 1) {
            equity += outcomes[index].netProfit;
            if (equity > peak)
                peak = equity;
            const drawdown = peak - equity;
            if (drawdown > maxDrawdown)
                maxDrawdown = drawdown;
        }
        return maxDrawdown;
    }
    windowReasons(validation, evGap, policy) {
        const reasons = [];
        if (validation.sampleSize < policy.minValidationSamples)
            reasons.push(`validation sample ${validation.sampleSize} below minimum ${policy.minValidationSamples}`);
        if (validation.evPerUnitStake < policy.minValidationEvPerUnitStake)
            reasons.push(`validation EV ${validation.evPerUnitStake} below minimum ${policy.minValidationEvPerUnitStake}`);
        if (evGap > policy.maxTrainValidationEvGap)
            reasons.push(`train/validation EV gap ${this.round(evGap)} above maximum ${policy.maxTrainValidationEvGap}`);
        if (validation.maxDrawdownRate > policy.maxValidationDrawdownRate)
            reasons.push(`validation drawdown rate ${validation.maxDrawdownRate} above maximum ${policy.maxValidationDrawdownRate}`);
        return reasons;
    }
    aggregate(windows) {
        const windowCount = windows.length;
        if (windowCount === 0) {
            return {
                windowCount: 0,
                passedWindows: 0,
                failedWindows: 0,
                reviewWindows: 0,
                passedValidationRate: 0,
                averageTrainEvPerUnitStake: 0,
                averageValidationEvPerUnitStake: 0,
                averageEvGap: 0,
                worstValidationDrawdownRate: 0,
                riskOfRuinEstimate: 1,
                stabilityScore: 0
            };
        }
        let passedWindows = 0;
        let failedWindows = 0;
        let reviewWindows = 0;
        let trainEv = 0;
        let validationEv = 0;
        let evGap = 0;
        let worstDrawdownRate = 0;
        for (const window of windows) {
            if (window.status === 'PASSED')
                passedWindows += 1;
            if (window.status === 'FAILED')
                failedWindows += 1;
            if (window.status === 'REVIEW')
                reviewWindows += 1;
            trainEv += window.train.evPerUnitStake;
            validationEv += window.validation.evPerUnitStake;
            evGap += window.evGap;
            if (window.validation.maxDrawdownRate > worstDrawdownRate)
                worstDrawdownRate = window.validation.maxDrawdownRate;
        }
        const passedValidationRate = passedWindows / windowCount;
        const averageValidationEv = validationEv / windowCount;
        const averageGap = evGap / windowCount;
        const riskOfRuinEstimate = this.clamp((failedWindows / windowCount) * 0.65 + worstDrawdownRate * 0.35, 0, 1);
        const stabilityScore = this.clamp(passedValidationRate * 0.55 + Math.max(0, averageValidationEv) * 0.25 + (1 - Math.min(1, averageGap)) * 0.2, 0, 1);
        return {
            windowCount,
            passedWindows,
            failedWindows,
            reviewWindows,
            passedValidationRate: this.round(passedValidationRate),
            averageTrainEvPerUnitStake: this.round(trainEv / windowCount),
            averageValidationEvPerUnitStake: this.round(averageValidationEv),
            averageEvGap: this.round(averageGap),
            worstValidationDrawdownRate: this.round(worstDrawdownRate),
            riskOfRuinEstimate: this.round(riskOfRuinEstimate),
            stabilityScore: this.round(stabilityScore)
        };
    }
    blockers(aggregate, policy, windows) {
        const blockers = [];
        if (aggregate.windowCount < policy.minValidationWindows)
            blockers.push(`validation windows ${aggregate.windowCount} below minimum ${policy.minValidationWindows}`);
        if (windows.length > 0 && aggregate.averageValidationEvPerUnitStake < policy.minValidationEvPerUnitStake)
            blockers.push(`average validation EV ${aggregate.averageValidationEvPerUnitStake} below minimum ${policy.minValidationEvPerUnitStake}`);
        if (windows.length > 0 && aggregate.passedValidationRate < policy.minPassedValidationRate)
            blockers.push(`passed validation rate ${aggregate.passedValidationRate} below minimum ${policy.minPassedValidationRate}`);
        if (windows.length > 0 && aggregate.worstValidationDrawdownRate > policy.maxValidationDrawdownRate)
            blockers.push(`worst validation drawdown rate ${aggregate.worstValidationDrawdownRate} above maximum ${policy.maxValidationDrawdownRate}`);
        if (windows.length > 0 && aggregate.riskOfRuinEstimate > policy.maxRiskOfRuinEstimate)
            blockers.push(`risk of ruin estimate ${aggregate.riskOfRuinEstimate} above maximum ${policy.maxRiskOfRuinEstimate}`);
        return blockers;
    }
    warnings(aggregate, policy, windows) {
        const warnings = [];
        if (aggregate.windowCount > 0 && aggregate.averageEvGap > policy.maxTrainValidationEvGap * 0.75)
            warnings.push('train/validation EV gap is approaching overfit threshold');
        if (aggregate.windowCount > 0 && aggregate.passedValidationRate < 0.8)
            warnings.push('validation pass rate is below institutional preference');
        for (const window of windows) {
            if (window.status !== 'PASSED')
                warnings.push(`window ${window.index} requires review: ${window.reasons.join(', ')}`);
        }
        return warnings.slice(0, 128);
    }
    status(blockers, aggregate, policy, windows) {
        if (blockers.length > 0 && windows.length === 0)
            return 'BLOCKED';
        const hasTrainPositiveValidationNegative = windows.some((window) => window.train.evPerUnitStake >= policy.minValidationEvPerUnitStake && window.validation.evPerUnitStake < policy.minValidationEvPerUnitStake);
        if (blockers.length > 0 && hasTrainPositiveValidationNegative)
            return 'OVERFIT';
        if (blockers.length > 0)
            return 'INCONCLUSIVE';
        if (aggregate.stabilityScore >= 0.6)
            return 'ROBUST_ALPHA_CANDIDATE';
        return 'INCONCLUSIVE';
    }
    checksum(value) {
        return crypto_1.default.createHash('sha256').update(JSON.stringify(value)).digest('hex');
    }
    clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }
    round(value) {
        return Number.isFinite(value) ? Number(value.toFixed(6)) : 0;
    }
}
exports.WalkForwardValidationLab = WalkForwardValidationLab;
