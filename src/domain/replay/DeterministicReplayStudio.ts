import crypto from 'crypto';
import { DomainError, err, ok, type Result } from '../shared/Result';
import { LiveSessionRuntime, type LiveRoundCommand, type LiveSessionRuntimeOptions } from '../session/LiveSessionRuntime';
import { SessionPersistenceEngine, type SessionPersistenceRecord } from '../session/SessionPersistenceEngine';

export type ReplayStudioStatus = 'REPLAYED' | 'BLOCKED';
export type ReplaySourceKind = 'COMMANDS' | 'PERSISTENCE_RECORD';

export interface ReplayCheckpoint {
  readonly frameIndex: number;
  readonly expectedSnapshotChecksum: string;
}

export interface ReplayStudioRequest {
  readonly sessionId?: string;
  readonly commands?: readonly LiveRoundCommand[];
  readonly record?: SessionPersistenceRecord;
  readonly checkpoints?: readonly ReplayCheckpoint[];
  readonly maxFrames?: number;
}

export interface ReplayStudioFrame {
  readonly frameIndex: number;
  readonly sourceKind: ReplaySourceKind;
  readonly eventId?: string;
  readonly sequence?: number;
  readonly value: number;
  readonly ingestionStatus: 'ACCEPTED' | 'DUPLICATE_IGNORED' | 'REJECTED';
  readonly roundCount: number;
  readonly readyForDecision: boolean;
  readonly sessionStatus: string;
  readonly controlState: string;
  readonly normalizedEntropy: number;
  readonly repeatRate: number;
  readonly maxNumberConcentration: number;
  readonly snapshotChecksum: string;
}

export interface ReplayStudioReport {
  readonly engineVersion: 'deterministic-replay-studio-v1';
  readonly status: ReplayStudioStatus;
  readonly sourceKind: ReplaySourceKind;
  readonly sessionId: string;
  readonly frameCount: number;
  readonly acceptedEvents: number;
  readonly duplicateEvents: number;
  readonly rejectedEvents: number;
  readonly finalSnapshotChecksum: string;
  readonly deterministicRunChecksum: string;
  readonly frames: readonly ReplayStudioFrame[];
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}

interface PreparedReplayInput {
  readonly sourceKind: ReplaySourceKind;
  readonly sessionId: string;
  readonly commands: readonly LiveRoundCommand[];
  readonly expectedFinalSnapshotChecksum?: string;
  readonly warnings: readonly string[];
}

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
export class DeterministicReplayStudio {
  private readonly runtimeOptions: LiveSessionRuntimeOptions;
  private readonly persistence: SessionPersistenceEngine;
  private readonly defaultMaxFrames: number;

  public constructor(options: LiveSessionRuntimeOptions & { readonly maxFrames?: number } = {}) {
    this.runtimeOptions = options;
    this.persistence = new SessionPersistenceEngine(options);
    this.defaultMaxFrames = Math.max(1, Math.trunc(options.maxFrames ?? 10_000));
  }

  public replay(request: ReplayStudioRequest): Result<ReplayStudioReport, DomainError> {
    try {
      const prepared = this.prepareInput(request);
      if (!prepared.success) return prepared;

      const checkpoints = this.prepareCheckpoints(request.checkpoints ?? []);
      if (!checkpoints.success) return checkpoints;

      const maxFrames = Math.max(1, Math.trunc(request.maxFrames ?? this.defaultMaxFrames));
      if (prepared.value.commands.length > maxFrames) {
        return err(new DomainError(`Replay command count ${prepared.value.commands.length} exceeds maxFrames ${maxFrames}.`, 'DETERMINISTIC_REPLAY_TOO_LARGE'));
      }

      const runtime = new LiveSessionRuntime(this.runtimeOptions);
      const frames: ReplayStudioFrame[] = [];
      const blockers: string[] = [];
      let acceptedEvents = 0;
      let duplicateEvents = 0;
      let rejectedEvents = 0;
      let finalSnapshotChecksum = '';

      for (let index = 0; index < prepared.value.commands.length; index += 1) {
        const command = prepared.value.commands[index];
        const result = runtime.ingest({ ...command, sessionId: prepared.value.sessionId });
        if (!result.success) {
          rejectedEvents += 1;
          return err(new DomainError(`Replay failed at frame ${index}: ${result.error.message}`, result.error.code ?? 'DETERMINISTIC_REPLAY_FRAME_FAILED'));
        }

        if (result.value.status === 'ACCEPTED') acceptedEvents += 1;
        if (result.value.status === 'DUPLICATE_IGNORED') duplicateEvents += 1;

        const snapshot = result.value.snapshot;
        finalSnapshotChecksum = snapshot.checksum;
        const frame: ReplayStudioFrame = {
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
      return ok({
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
    } catch (error) {
      return err(new DomainError(`Deterministic replay failed: ${(error as Error).message}`, 'DETERMINISTIC_REPLAY_FAILED'));
    }
  }

  private prepareInput(request: ReplayStudioRequest): Result<PreparedReplayInput, DomainError> {
    if (!request || typeof request !== 'object') {
      return err(new DomainError('Replay request is required.', 'DETERMINISTIC_REPLAY_INVALID_REQUEST'));
    }

    const hasRecord = request.record !== undefined;
    const hasCommands = request.commands !== undefined;
    if (hasRecord === hasCommands) {
      return err(new DomainError('Replay request must provide either record or commands, but not both.', 'DETERMINISTIC_REPLAY_SOURCE_AMBIGUOUS'));
    }

    if (hasRecord) {
      const record = request.record as SessionPersistenceRecord;
      const verification = this.persistence.verifyRecord(record);
      if (!verification.success) return err(new DomainError(verification.error.message, verification.error.code ?? 'DETERMINISTIC_REPLAY_RECORD_INVALID'));
      return ok({
        sourceKind: 'PERSISTENCE_RECORD',
        sessionId: record.sessionId,
        commands: record.journal.map(entry => entry.command),
        expectedFinalSnapshotChecksum: record.snapshot.checksum,
        warnings: record.journal.length === 0 ? ['Replay record has no journal frames.'] : []
      });
    }

    const sessionId = typeof request.sessionId === 'string' ? request.sessionId.trim() : '';
    if (!sessionId) return err(new DomainError('Replay sessionId is required for command replay.', 'DETERMINISTIC_REPLAY_SESSION_REQUIRED'));
    if (!Array.isArray(request.commands)) return err(new DomainError('Replay commands must be an array.', 'DETERMINISTIC_REPLAY_COMMANDS_REQUIRED'));
    return ok({ sourceKind: 'COMMANDS', sessionId, commands: request.commands, warnings: [] });
  }

  private prepareCheckpoints(checkpoints: readonly ReplayCheckpoint[]): Result<Map<number, string>, DomainError> {
    if (!Array.isArray(checkpoints)) return err(new DomainError('Replay checkpoints must be an array.', 'DETERMINISTIC_REPLAY_INVALID_CHECKPOINTS'));
    const map = new Map<number, string>();
    for (const checkpoint of checkpoints) {
      if (!checkpoint || typeof checkpoint !== 'object') return err(new DomainError('Replay checkpoint is invalid.', 'DETERMINISTIC_REPLAY_INVALID_CHECKPOINTS'));
      if (!Number.isInteger(checkpoint.frameIndex) || checkpoint.frameIndex < 0) {
        return err(new DomainError('Replay checkpoint frameIndex must be a non-negative integer.', 'DETERMINISTIC_REPLAY_INVALID_CHECKPOINTS'));
      }
      if (typeof checkpoint.expectedSnapshotChecksum !== 'string' || checkpoint.expectedSnapshotChecksum.length < 16) {
        return err(new DomainError('Replay checkpoint checksum is invalid.', 'DETERMINISTIC_REPLAY_INVALID_CHECKPOINTS'));
      }
      map.set(checkpoint.frameIndex, checkpoint.expectedSnapshotChecksum);
    }
    return ok(map);
  }

  private runChecksum(sessionId: string, frames: readonly ReplayStudioFrame[], blockers: readonly string[]): string {
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
    return crypto.createHash('sha256').update(`deterministic-replay-studio-v1|${sessionId}|${frameMaterial}|${blockers.join('|')}`).digest('hex');
  }

  private round(value: number): number {
    return Math.round(value * 1_000_000) / 1_000_000;
  }
}
