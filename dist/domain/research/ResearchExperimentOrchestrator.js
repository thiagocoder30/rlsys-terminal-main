"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResearchExperimentOrchestrator = void 0;
const crypto_1 = __importDefault(require("crypto"));
const Result_1 = require("../shared/Result");
const DEFAULT_POLICY = {
    minAcceptedDatasets: 1,
    minTotalFrames: 30,
    minSignalFrequency: 0.001,
    requirePositiveEdge: true,
    maxWarnings: 128
};
/**
 * Orchestrates versioned research experiments from already-computed domain reports.
 *
 * The orchestrator deliberately does not read files, persist state or execute live
 * decisions. It is a scientific coordination layer that joins dataset registry,
 * deterministic offline replay and EV/risk analytics into one reproducible
 * experiment envelope.
 *
 * Complexity:
 * - Time: O(b + w), where b and w are total blockers/warnings across stages.
 * - Space: O(b + w). The heavy replay and analytics payloads remain owned by
 *   their specialized engines to avoid duplicating memory on low-end Android.
 */
class ResearchExperimentOrchestrator {
    orchestrate(request) {
        try {
            const validation = this.validateRequest(request);
            if (validation.length > 0)
                return (0, Result_1.err)(new Result_1.DomainError(validation.join('; '), 'RESEARCH_EXPERIMENT_INVALID_REQUEST'));
            const policy = this.normalizePolicy(request.policy);
            const stages = this.stages(request);
            const summary = this.summary(request);
            const blockers = this.blockers(request, policy, stages, summary);
            const warnings = this.warnings(request, policy, stages);
            const status = this.status(request, blockers, warnings, policy);
            const conclusion = this.conclusion(status, summary, blockers);
            const evidenceChecksums = [request.registryReport.checksum, request.offlineReport.checksum, request.analyticsReport.checksum];
            const reportWithoutChecksum = {
                engineVersion: 'research-experiment-orchestrator-v1',
                experimentId: request.experimentId.trim(),
                hypothesis: request.hypothesis.trim(),
                status,
                conclusion,
                summary,
                stages,
                blockers,
                warnings,
                evidenceChecksums
            };
            return (0, Result_1.ok)({ ...reportWithoutChecksum, checksum: this.checksum(reportWithoutChecksum) });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown research experiment error';
            return (0, Result_1.err)(new Result_1.DomainError(message, 'RESEARCH_EXPERIMENT_UNEXPECTED_ERROR'));
        }
    }
    validateRequest(request) {
        if (!request || typeof request !== 'object')
            return ['request must be an object'];
        const errors = [];
        if (typeof request.experimentId !== 'string' || request.experimentId.trim().length === 0)
            errors.push('experimentId is required');
        if (typeof request.hypothesis !== 'string' || request.hypothesis.trim().length < 8)
            errors.push('hypothesis must be descriptive');
        if (!this.hasChecksum(request.registryReport))
            errors.push('registryReport with checksum is required');
        if (!this.hasChecksum(request.offlineReport))
            errors.push('offlineReport with checksum is required');
        if (!this.hasChecksum(request.analyticsReport))
            errors.push('analyticsReport with checksum is required');
        if (request.registryReport && request.offlineReport && request.registryReport.summary?.totalDatasets !== request.offlineReport.datasetCount) {
            errors.push('registry dataset count must match offline dataset count');
        }
        if (request.policy?.minAcceptedDatasets !== undefined && (!Number.isFinite(request.policy.minAcceptedDatasets) || request.policy.minAcceptedDatasets < 1)) {
            errors.push('policy.minAcceptedDatasets must be positive');
        }
        if (request.policy?.minTotalFrames !== undefined && (!Number.isFinite(request.policy.minTotalFrames) || request.policy.minTotalFrames < 1)) {
            errors.push('policy.minTotalFrames must be positive');
        }
        if (request.policy?.minSignalFrequency !== undefined && (!Number.isFinite(request.policy.minSignalFrequency) || request.policy.minSignalFrequency < 0 || request.policy.minSignalFrequency > 1)) {
            errors.push('policy.minSignalFrequency must be between 0 and 1');
        }
        if (request.policy?.maxWarnings !== undefined && (!Number.isFinite(request.policy.maxWarnings) || request.policy.maxWarnings < 0)) {
            errors.push('policy.maxWarnings must be non-negative');
        }
        return errors;
    }
    hasChecksum(value) {
        return typeof value === 'object' && value !== null && typeof value.checksum === 'string' && value.checksum.length > 0;
    }
    normalizePolicy(policy) {
        return {
            minAcceptedDatasets: Math.max(1, Math.trunc(policy?.minAcceptedDatasets ?? DEFAULT_POLICY.minAcceptedDatasets)),
            minTotalFrames: Math.max(1, Math.trunc(policy?.minTotalFrames ?? DEFAULT_POLICY.minTotalFrames)),
            minSignalFrequency: this.clamp(policy?.minSignalFrequency ?? DEFAULT_POLICY.minSignalFrequency, 0, 1),
            requirePositiveEdge: policy?.requirePositiveEdge ?? DEFAULT_POLICY.requirePositiveEdge,
            maxWarnings: Math.max(0, Math.trunc(policy?.maxWarnings ?? DEFAULT_POLICY.maxWarnings))
        };
    }
    stages(request) {
        return [
            {
                stage: 'DATASET_REGISTRY',
                status: request.registryReport.status === 'BLOCKED' ? 'BLOCKED' : request.registryReport.status === 'REVIEW_REQUIRED' ? 'REVIEW' : 'PASSED',
                checksum: request.registryReport.checksum,
                blockers: request.registryReport.blockers,
                warnings: request.registryReport.warnings
            },
            {
                stage: 'OFFLINE_RESEARCH',
                status: request.offlineReport.status === 'BLOCKED' ? 'BLOCKED' : request.offlineReport.warnings.length > 0 ? 'REVIEW' : 'PASSED',
                checksum: request.offlineReport.checksum,
                blockers: request.offlineReport.blockers,
                warnings: request.offlineReport.warnings
            },
            {
                stage: 'EV_RISK_ANALYTICS',
                status: request.analyticsReport.status === 'BLOCKED' ? 'BLOCKED' : request.analyticsReport.status === 'NEGATIVE_OR_INCONCLUSIVE' ? 'REVIEW' : 'PASSED',
                checksum: request.analyticsReport.checksum,
                blockers: request.analyticsReport.blockers,
                warnings: request.analyticsReport.warnings
            }
        ];
    }
    summary(request) {
        return {
            acceptedDatasets: request.registryReport.summary.acceptedDatasets,
            reviewDatasets: request.registryReport.summary.reviewDatasets,
            blockedDatasets: request.registryReport.summary.blockedDatasets,
            totalFrames: request.offlineReport.aggregate.totalFrames,
            signalFrequency: request.analyticsReport.metrics.signalFrequency,
            expectedValuePerUnitStake: request.analyticsReport.metrics.expectedValuePerUnitStake,
            profitFactor: request.analyticsReport.metrics.profitFactor,
            maxDrawdownRate: request.analyticsReport.metrics.maxDrawdownRate,
            riskOfRuinEstimate: request.analyticsReport.metrics.riskOfRuinEstimate
        };
    }
    blockers(request, policy, stages, summary) {
        const blockers = [];
        for (const stage of stages) {
            for (const blocker of stage.blockers)
                blockers.push(`${stage.stage}: ${blocker}`);
            if (stage.status === 'BLOCKED' && stage.blockers.length === 0)
                blockers.push(`${stage.stage}: stage blocked without detailed blocker`);
        }
        if (summary.acceptedDatasets < policy.minAcceptedDatasets)
            blockers.push(`accepted datasets ${summary.acceptedDatasets} below minimum ${policy.minAcceptedDatasets}`);
        if (summary.totalFrames < policy.minTotalFrames)
            blockers.push(`total frames ${summary.totalFrames} below minimum ${policy.minTotalFrames}`);
        if (summary.signalFrequency < policy.minSignalFrequency)
            blockers.push(`signal frequency ${summary.signalFrequency.toFixed(6)} below minimum ${policy.minSignalFrequency.toFixed(6)}`);
        if (policy.requirePositiveEdge && request.analyticsReport.status !== 'POSITIVE_EDGE_CANDIDATE')
            blockers.push('analytics did not confirm positive edge candidate');
        return blockers;
    }
    warnings(request, policy, stages) {
        const warnings = [];
        for (const stage of stages) {
            for (const warning of stage.warnings)
                warnings.push(`${stage.stage}: ${warning}`);
        }
        if (request.registryReport.status === 'REVIEW_REQUIRED')
            warnings.push('dataset registry requires manual review before alpha interpretation');
        if (warnings.length > policy.maxWarnings)
            return [`warning count ${warnings.length} exceeded maxWarnings ${policy.maxWarnings}`];
        return warnings;
    }
    status(request, blockers, warnings, policy) {
        if (blockers.length > 0)
            return 'BLOCKED';
        if (request.analyticsReport.status === 'POSITIVE_EDGE_CANDIDATE' && warnings.length <= policy.maxWarnings)
            return 'ALPHA_CANDIDATE';
        return 'INCONCLUSIVE';
    }
    conclusion(status, summary, blockers) {
        if (status === 'ALPHA_CANDIDATE') {
            return `Alpha candidate: EV/unit=${summary.expectedValuePerUnitStake.toFixed(6)}, profitFactor=${summary.profitFactor.toFixed(4)}, riskOfRuin=${summary.riskOfRuinEstimate.toFixed(4)}.`;
        }
        if (status === 'BLOCKED') {
            const primary = blockers[0] ?? 'governance blocker present';
            return `Experiment blocked: ${primary}.`;
        }
        return `Experiment inconclusive: EV/unit=${summary.expectedValuePerUnitStake.toFixed(6)} with insufficient governance confirmation.`;
    }
    clamp(value, min, max) {
        if (!Number.isFinite(value))
            return min;
        return Math.max(min, Math.min(max, value));
    }
    checksum(payload) {
        return crypto_1.default.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    }
}
exports.ResearchExperimentOrchestrator = ResearchExperimentOrchestrator;
