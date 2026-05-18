"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OfflineResearchRunner = void 0;
const crypto_1 = __importDefault(require("crypto"));
const Result_1 = require("../shared/Result");
const DeterministicReplayStudio_1 = require("../replay/DeterministicReplayStudio");
const DEFAULT_MAX_DATASETS = 32;
const DEFAULT_MAX_TOTAL_FRAMES = 50000;
const SIGNAL_LIKE_CONTROL_STATES = new Set(['ARMED', 'SIGNAL']);
const BLOCKED_CONTROL_STATES = new Set(['NO_GO', 'COOLDOWN']);
/**
 * Runs deterministic offline research over clean command datasets.
 *
 * This runner intentionally excludes OCR, UI, filesystem and live latency from
 * the math-validation loop. It is a domain-only batch primitive for falsifying
 * alpha hypotheses before production concerns are introduced again.
 *
 * Complexity:
 * - Time: O(d + n), where d is dataset count and n is total command count.
 * - Space: O(d + n) because deterministic replay frames are retained by the
 *   underlying Replay Studio for auditability. Callers can bound n with policy.
 */
class OfflineResearchRunner {
    run(request) {
        try {
            const validation = this.validateRequest(request);
            if (validation.length > 0)
                return (0, Result_1.err)(new Result_1.DomainError(validation.join('; '), 'OFFLINE_RESEARCH_INVALID_REQUEST'));
            const maxDatasets = Math.max(1, Math.trunc(request.maxDatasets ?? DEFAULT_MAX_DATASETS));
            if (request.datasets.length > maxDatasets) {
                return (0, Result_1.err)(new Result_1.DomainError(`dataset count ${request.datasets.length} exceeds maxDatasets ${maxDatasets}`, 'OFFLINE_RESEARCH_TOO_MANY_DATASETS'));
            }
            const totalCommands = request.datasets.reduce((sum, dataset) => sum + dataset.commands.length, 0);
            const maxTotalFrames = Math.max(1, Math.trunc(request.maxTotalFrames ?? DEFAULT_MAX_TOTAL_FRAMES));
            if (totalCommands > maxTotalFrames) {
                return (0, Result_1.err)(new Result_1.DomainError(`total command count ${totalCommands} exceeds maxTotalFrames ${maxTotalFrames}`, 'OFFLINE_RESEARCH_TOO_LARGE'));
            }
            const replay = new DeterministicReplayStudio_1.DeterministicReplayStudio(request.runtimeOptions ?? {});
            const datasetReports = [];
            const blockers = [];
            const warnings = [];
            for (const dataset of request.datasets) {
                const replayResult = replay.replay({
                    sessionId: dataset.datasetId,
                    commands: dataset.commands,
                    maxFrames: dataset.maxFrames ?? dataset.commands.length
                });
                if (!replayResult.success) {
                    const message = `dataset ${dataset.datasetId} replay failed: ${replayResult.error.message}`;
                    blockers.push(message);
                    datasetReports.push(this.blockedDataset(dataset, message));
                    continue;
                }
                const report = this.datasetReport(dataset, replayResult.value);
                datasetReports.push(report);
                if (report.status === 'BLOCKED')
                    blockers.push(...report.blockers.map((blocker) => `dataset ${dataset.datasetId}: ${blocker}`));
                warnings.push(...report.warnings.map((warning) => `dataset ${dataset.datasetId}: ${warning}`));
            }
            const aggregate = this.aggregate(datasetReports);
            const status = blockers.length > 0 ? 'BLOCKED' : 'COMPLETED';
            const reportWithoutChecksum = {
                engineVersion: 'offline-research-runner-v1',
                status,
                datasetCount: request.datasets.length,
                processedDatasets: datasetReports.length,
                aggregate,
                datasets: datasetReports,
                blockers,
                warnings
            };
            return (0, Result_1.ok)({ ...reportWithoutChecksum, checksum: this.checksum(reportWithoutChecksum) });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'unknown offline research error';
            return (0, Result_1.err)(new Result_1.DomainError(message, 'OFFLINE_RESEARCH_UNEXPECTED_ERROR'));
        }
    }
    validateRequest(request) {
        const errors = [];
        if (!request || typeof request !== 'object')
            return ['request must be an object'];
        if (!Array.isArray(request.datasets))
            return ['datasets must be an array'];
        if (Array.isArray(request.datasets) && request.datasets.length === 0)
            errors.push('at least one dataset is required');
        const seen = new Set();
        for (let index = 0; index < (request.datasets?.length ?? 0); index += 1) {
            const dataset = request.datasets[index];
            if (!dataset || typeof dataset !== 'object') {
                errors.push(`dataset[${index}] must be an object`);
                continue;
            }
            if (typeof dataset.datasetId !== 'string' || dataset.datasetId.trim().length === 0)
                errors.push(`dataset[${index}].datasetId is required`);
            if (seen.has(dataset.datasetId))
                errors.push(`dataset[${index}].datasetId must be unique`);
            seen.add(dataset.datasetId);
            if (!Array.isArray(dataset.commands) || dataset.commands.length === 0)
                errors.push(`dataset[${index}].commands must be a non-empty array`);
            if (dataset.maxFrames !== undefined && (!Number.isFinite(dataset.maxFrames) || dataset.maxFrames < 1))
                errors.push(`dataset[${index}].maxFrames must be positive`);
        }
        if (request.maxDatasets !== undefined && (!Number.isFinite(request.maxDatasets) || request.maxDatasets < 1))
            errors.push('maxDatasets must be positive');
        if (request.maxTotalFrames !== undefined && (!Number.isFinite(request.maxTotalFrames) || request.maxTotalFrames < 1))
            errors.push('maxTotalFrames must be positive');
        return errors;
    }
    datasetReport(dataset, replay) {
        const metrics = this.metrics(replay);
        const blockers = replay.status === 'BLOCKED' ? [...replay.blockers] : [];
        const warnings = [...replay.warnings];
        if (metrics.readyFrames === 0)
            warnings.push('dataset produced no decision-ready frames');
        if (metrics.signalLikeFrames === 0)
            warnings.push('dataset produced no signal-like frames');
        return {
            datasetId: dataset.datasetId,
            label: dataset.label,
            status: replay.status === 'REPLAYED' ? 'REPLAYED' : 'BLOCKED',
            replayChecksum: replay.deterministicRunChecksum,
            finalSnapshotChecksum: replay.finalSnapshotChecksum,
            metrics,
            blockers,
            warnings
        };
    }
    blockedDataset(dataset, blocker) {
        return {
            datasetId: dataset.datasetId,
            label: dataset.label,
            status: 'BLOCKED',
            replayChecksum: '',
            finalSnapshotChecksum: '',
            metrics: {
                frameCount: 0,
                acceptedEvents: 0,
                duplicateEvents: 0,
                rejectedEvents: 0,
                readyFrames: 0,
                signalLikeFrames: 0,
                blockedFrames: 0,
                readyFrameRate: 0,
                signalLikeRate: 0,
                averageNormalizedEntropy: 0,
                averageRepeatRate: 0,
                averageMaxNumberConcentration: 0
            },
            blockers: [blocker],
            warnings: []
        };
    }
    metrics(replay) {
        const frameCount = replay.frames.length;
        let readyFrames = 0;
        let signalLikeFrames = 0;
        let blockedFrames = 0;
        let entropySum = 0;
        let repeatRateSum = 0;
        let concentrationSum = 0;
        for (const frame of replay.frames) {
            if (frame.readyForDecision)
                readyFrames += 1;
            if (SIGNAL_LIKE_CONTROL_STATES.has(frame.controlState))
                signalLikeFrames += 1;
            if (BLOCKED_CONTROL_STATES.has(frame.controlState))
                blockedFrames += 1;
            entropySum += frame.normalizedEntropy;
            repeatRateSum += frame.repeatRate;
            concentrationSum += frame.maxNumberConcentration;
        }
        return {
            frameCount,
            acceptedEvents: replay.acceptedEvents,
            duplicateEvents: replay.duplicateEvents,
            rejectedEvents: replay.rejectedEvents,
            readyFrames,
            signalLikeFrames,
            blockedFrames,
            readyFrameRate: this.safeRatio(readyFrames, frameCount),
            signalLikeRate: this.safeRatio(signalLikeFrames, frameCount),
            averageNormalizedEntropy: this.safeRatio(entropySum, frameCount),
            averageRepeatRate: this.safeRatio(repeatRateSum, frameCount),
            averageMaxNumberConcentration: this.safeRatio(concentrationSum, frameCount)
        };
    }
    aggregate(reports) {
        let totalFrames = 0;
        let acceptedEvents = 0;
        let duplicateEvents = 0;
        let rejectedEvents = 0;
        let blockedDatasets = 0;
        let readyFrames = 0;
        let signalLikeFrames = 0;
        let entropyWeighted = 0;
        let repeatWeighted = 0;
        let concentrationWeighted = 0;
        for (const report of reports) {
            const metrics = report.metrics;
            if (report.status === 'BLOCKED')
                blockedDatasets += 1;
            totalFrames += metrics.frameCount;
            acceptedEvents += metrics.acceptedEvents;
            duplicateEvents += metrics.duplicateEvents;
            rejectedEvents += metrics.rejectedEvents;
            readyFrames += metrics.readyFrames;
            signalLikeFrames += metrics.signalLikeFrames;
            entropyWeighted += metrics.averageNormalizedEntropy * metrics.frameCount;
            repeatWeighted += metrics.averageRepeatRate * metrics.frameCount;
            concentrationWeighted += metrics.averageMaxNumberConcentration * metrics.frameCount;
        }
        return {
            totalFrames,
            acceptedEvents,
            duplicateEvents,
            rejectedEvents,
            blockedDatasets,
            weightedReadyFrameRate: this.safeRatio(readyFrames, totalFrames),
            weightedSignalLikeRate: this.safeRatio(signalLikeFrames, totalFrames),
            weightedAverageEntropy: this.safeRatio(entropyWeighted, totalFrames),
            weightedAverageRepeatRate: this.safeRatio(repeatWeighted, totalFrames),
            weightedAverageConcentration: this.safeRatio(concentrationWeighted, totalFrames)
        };
    }
    safeRatio(numerator, denominator) {
        if (denominator <= 0)
            return 0;
        return Number((numerator / denominator).toFixed(6));
    }
    checksum(value) {
        return crypto_1.default.createHash('sha256').update(JSON.stringify(value)).digest('hex');
    }
}
exports.OfflineResearchRunner = OfflineResearchRunner;
