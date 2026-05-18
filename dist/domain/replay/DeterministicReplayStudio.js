"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeterministicReplayStudio = void 0;
const crypto_1 = __importDefault(require("crypto"));
const Result_1 = require("../shared/Result");
const LiveSessionRuntime_1 = require("../session/LiveSessionRuntime");
const SessionPersistenceEngine_1 = require("../session/SessionPersistenceEngine");
/**
 * Replays live-session commands into deterministic audit frames.
 *
 * This is a domain-only research primitive: it never reads files, never calls
 * external systems and never authorizes operational stake. Its goal is to make
 * historical sessions reproducible so alpha hypotheses can be falsified before
 * any live execution path is trusted.
 *
 * Complexity:
 * - Time: O(n + c), where n is the command count and c is checkpoint count.
 * - Space: O(n) for bounded replay frames. The caller controls maxFrames.
 */
class DeterministicReplayStudio {
    constructor(options = {}) {
        this.runtimeOptions = options;
        this.persistence = new SessionPersistenceEngine_1.SessionPersistenceEngine(options);
        this.defaultMaxFrames = Math.max(1, Math.trunc(options.maxFrames ?? 10000));
    }
    replay(request) {
        try {
            const prepared = this.prepareInput(request);
            if (!prepared.success)
                return prepared;
            const checkpoints = this.prepareCheckpoints(request.checkpoints ?? []);
            if (!checkpoints.success)
                return checkpoints;
            const maxFrames = Math.max(1, Math.trunc(request.maxFrames ?? this.defaultMaxFrames));
            if (prepared.value.commands.length > maxFrames) {
                return (0, Result_1.err)(new Result_1.DomainError(`Replay command count ${prepared.value.commands.length} exceeds maxFrames ${maxFrames}.`, 'DETERMINISTIC_REPLAY_TOO_LARGE'));
            }
            const runtime = new LiveSessionRuntime_1.LiveSessionRuntime(this.runtimeOptions);
            const frames = [];
            const blockers = [];
            let acceptedEvents = 0;
            let duplicateEvents = 0;
            let rejectedEvents = 0;
            let finalSnapshotChecksum = '';
            for (let index = 0; index < prepared.value.commands.length; index += 1) {
                const command = prepared.value.commands[index];
                const result = runtime.ingest({ ...command, sessionId: prepared.value.sessionId });
                if (!result.success) {
                    rejectedEvents += 1;
                    return (0, Result_1.err)(new Result_1.DomainError(`Replay failed at frame ${index}: ${result.error.message}`, result.error.code ?? 'DETERMINISTIC_REPLAY_FRAME_FAILED'));
                }
                if (result.value.status === 'ACCEPTED')
                    acceptedEvents += 1;
                if (result.value.status === 'DUPLICATE_IGNORED')
                    duplicateEvents += 1;
                const snapshot = result.value.snapshot;
                finalSnapshotChecksum = snapshot.checksum;
                const frame = {
                    frameIndex: index,
                    sourceKind: prepared.value.sourceKind,
                    eventId: command.eventId,
                    sequence: command.sequence,
                    value: command.value,
                    ingestionStatus: result.value.status,
                    roundCount: snapshot.roundCount,
                    readyForDecision: snapshot.readyForDecision,
                    sessionStatus: snapshot.status,
                    controlState: snapshot.control.phase,
                    normalizedEntropy: this.round(snapshot.rolling.normalizedEntropy),
                    repeatRate: this.round(snapshot.rolling.repeatRate),
                    maxNumberConcentration: this.round(snapshot.rolling.maxNumberConcentration),
                    snapshotChecksum: snapshot.checksum
                };
                frames.push(frame);
                const expected = checkpoints.value.get(index);
                if (expected && expected !== snapshot.checksum) {
                    blockers.push(`Checkpoint ${index} checksum mismatch.`);
                }
            }
            if (prepared.value.expectedFinalSnapshotChecksum && prepared.value.expectedFinalSnapshotChecksum !== finalSnapshotChecksum) {
                blockers.push('Final replay checksum does not match expected persisted snapshot checksum.');
            }
            const deterministicRunChecksum = this.runChecksum(prepared.value.sessionId, frames, blockers);
            return (0, Result_1.ok)({
                engineVersion: 'deterministic-replay-studio-v1',
                status: blockers.length > 0 ? 'BLOCKED' : 'REPLAYED',
                sourceKind: prepared.value.sourceKind,
                sessionId: prepared.value.sessionId,
                frameCount: frames.length,
                acceptedEvents,
                duplicateEvents,
                rejectedEvents,
                finalSnapshotChecksum,
                deterministicRunChecksum,
                frames,
                blockers,
                warnings: prepared.value.warnings
            });
        }
        catch (error) {
            return (0, Result_1.err)(new Result_1.DomainError(`Deterministic replay failed: ${error.message}`, 'DETERMINISTIC_REPLAY_FAILED'));
        }
    }
    prepareInput(request) {
        if (!request || typeof request !== 'object') {
            return (0, Result_1.err)(new Result_1.DomainError('Replay request is required.', 'DETERMINISTIC_REPLAY_INVALID_REQUEST'));
        }
        const hasRecord = request.record !== undefined;
        const hasCommands = request.commands !== undefined;
        if (hasRecord === hasCommands) {
            return (0, Result_1.err)(new Result_1.DomainError('Replay request must provide either record or commands, but not both.', 'DETERMINISTIC_REPLAY_SOURCE_AMBIGUOUS'));
        }
        if (hasRecord) {
            const record = request.record;
            const verification = this.persistence.verifyRecord(record);
            if (!verification.success)
                return (0, Result_1.err)(new Result_1.DomainError(verification.error.message, verification.error.code ?? 'DETERMINISTIC_REPLAY_RECORD_INVALID'));
            return (0, Result_1.ok)({
                sourceKind: 'PERSISTENCE_RECORD',
                sessionId: record.sessionId,
                commands: record.journal.map(entry => entry.command),
                expectedFinalSnapshotChecksum: record.snapshot.checksum,
                warnings: record.journal.length === 0 ? ['Replay record has no journal frames.'] : []
            });
        }
        const sessionId = typeof request.sessionId === 'string' ? request.sessionId.trim() : '';
        if (!sessionId)
            return (0, Result_1.err)(new Result_1.DomainError('Replay sessionId is required for command replay.', 'DETERMINISTIC_REPLAY_SESSION_REQUIRED'));
        if (!Array.isArray(request.commands))
            return (0, Result_1.err)(new Result_1.DomainError('Replay commands must be an array.', 'DETERMINISTIC_REPLAY_COMMANDS_REQUIRED'));
        return (0, Result_1.ok)({ sourceKind: 'COMMANDS', sessionId, commands: request.commands, warnings: [] });
    }
    prepareCheckpoints(checkpoints) {
        if (!Array.isArray(checkpoints))
            return (0, Result_1.err)(new Result_1.DomainError('Replay checkpoints must be an array.', 'DETERMINISTIC_REPLAY_INVALID_CHECKPOINTS'));
        const map = new Map();
        for (const checkpoint of checkpoints) {
            if (!checkpoint || typeof checkpoint !== 'object')
                return (0, Result_1.err)(new Result_1.DomainError('Replay checkpoint is invalid.', 'DETERMINISTIC_REPLAY_INVALID_CHECKPOINTS'));
            if (!Number.isInteger(checkpoint.frameIndex) || checkpoint.frameIndex < 0) {
                return (0, Result_1.err)(new Result_1.DomainError('Replay checkpoint frameIndex must be a non-negative integer.', 'DETERMINISTIC_REPLAY_INVALID_CHECKPOINTS'));
            }
            if (typeof checkpoint.expectedSnapshotChecksum !== 'string' || checkpoint.expectedSnapshotChecksum.length < 16) {
                return (0, Result_1.err)(new Result_1.DomainError('Replay checkpoint checksum is invalid.', 'DETERMINISTIC_REPLAY_INVALID_CHECKPOINTS'));
            }
            map.set(checkpoint.frameIndex, checkpoint.expectedSnapshotChecksum);
        }
        return (0, Result_1.ok)(map);
    }
    runChecksum(sessionId, frames, blockers) {
        const frameMaterial = frames.map(frame => [
            frame.frameIndex,
            frame.value,
            frame.eventId ?? '',
            frame.sequence ?? '',
            frame.ingestionStatus,
            frame.roundCount,
            frame.readyForDecision ? '1' : '0',
            frame.controlState,
            frame.snapshotChecksum
        ].join(':')).join('|');
        return crypto_1.default.createHash('sha256').update(`deterministic-replay-studio-v1|${sessionId}|${frameMaterial}|${blockers.join('|')}`).digest('hex');
    }
    round(value) {
        return Math.round(value * 1000000) / 1000000;
    }
}
exports.DeterministicReplayStudio = DeterministicReplayStudio;
