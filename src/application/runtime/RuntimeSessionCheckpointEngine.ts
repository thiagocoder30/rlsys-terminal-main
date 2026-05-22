export type RuntimeCheckpointReason =
  | "COMMAND_PROCESSED"
  | "TIME_INTERVAL"
  | "MANUAL"
  | "SESSION_FINISH"
  | "RECOVERY_POINT";

export interface RuntimeSessionCheckpointRequest {
  readonly commandId?: string;
  readonly reason: RuntimeCheckpointReason;
  readonly occurredAtEpochMs: number;
  readonly force?: boolean;
}

export interface RuntimeSessionCheckpointRecord {
  readonly checkpointId: string;
  readonly reason: RuntimeCheckpointReason;
  readonly commandId?: string;
  readonly createdAtEpochMs: number;
  readonly sequence: number;
}

export interface RuntimeSessionCheckpointRepositoryPort {
  saveCheckpoint(record: RuntimeSessionCheckpointRecord): Promise<void>;
}

export interface RuntimeSessionCheckpointResult {
  readonly saved: boolean;
  readonly status: "CHECKPOINT_SAVED" | "CHECKPOINT_SKIPPED";
  readonly message: string;
  readonly checkpoint?: RuntimeSessionCheckpointRecord;
}

/**
 * Decides and persists assisted runtime session checkpoints.
 *
 * Design:
 * - idempotent by command id;
 * - bounded in-memory command tracking;
 * - interval-based checkpoint throttling;
 * - force checkpoint support for manual/recovery/finish.
 *
 * Complexity:
 * - O(1) common path.
 * - O(k) only during bounded compaction, where k = maxTrackedCommandIds.
 * - Memory O(k).
 */
export class RuntimeSessionCheckpointEngine {
  private readonly checkpointIntervalMs: number;
  private readonly maxTrackedCommandIds: number;
  private readonly processedCommandIds: Set<string> = new Set<string>();
  private lastCheckpointAtEpochMs = 0;
  private sequence = 0;

  public constructor(
    private readonly repository: RuntimeSessionCheckpointRepositoryPort,
    options: {
      readonly checkpointIntervalMs?: number;
      readonly maxTrackedCommandIds?: number;
    } = {},
  ) {
    this.checkpointIntervalMs = options.checkpointIntervalMs ?? 30_000;
    this.maxTrackedCommandIds = options.maxTrackedCommandIds ?? 512;
  }

  public async checkpoint(
    request: RuntimeSessionCheckpointRequest,
  ): Promise<RuntimeSessionCheckpointResult> {
    this.validateRequest(request);

    if (this.isDuplicateCommand(request)) {
      return {
        saved: false,
        status: "CHECKPOINT_SKIPPED",
        message: "Checkpoint skipped because command was already checkpointed.",
      };
    }

    if (!this.shouldCheckpoint(request)) {
      return {
        saved: false,
        status: "CHECKPOINT_SKIPPED",
        message: "Checkpoint skipped by interval policy.",
      };
    }

    this.sequence += 1;

    const record: RuntimeSessionCheckpointRecord = {
      checkpointId: this.createCheckpointId(request, this.sequence),
      reason: request.reason,
      commandId: request.commandId,
      createdAtEpochMs: request.occurredAtEpochMs,
      sequence: this.sequence,
    };

    await this.repository.saveCheckpoint(record);

    this.lastCheckpointAtEpochMs = request.occurredAtEpochMs;
    this.rememberCommand(request.commandId);

    return {
      saved: true,
      status: "CHECKPOINT_SAVED",
      message: "Runtime session checkpoint saved.",
      checkpoint: record,
    };
  }

  private shouldCheckpoint(request: RuntimeSessionCheckpointRequest): boolean {
    if (request.force === true) {
      return true;
    }

    if (
      request.reason === "MANUAL"
      || request.reason === "SESSION_FINISH"
      || request.reason === "RECOVERY_POINT"
    ) {
      return true;
    }

    if (this.lastCheckpointAtEpochMs === 0) {
      return true;
    }

    return request.occurredAtEpochMs - this.lastCheckpointAtEpochMs >= this.checkpointIntervalMs;
  }

  private isDuplicateCommand(request: RuntimeSessionCheckpointRequest): boolean {
    return request.commandId !== undefined && this.processedCommandIds.has(request.commandId);
  }

  private rememberCommand(commandId: string | undefined): void {
    if (commandId === undefined) {
      return;
    }

    this.processedCommandIds.add(commandId);

    if (this.processedCommandIds.size <= this.maxTrackedCommandIds) {
      return;
    }

    const compacted = Array.from(this.processedCommandIds).slice(
      this.processedCommandIds.size - this.maxTrackedCommandIds,
    );

    this.processedCommandIds.clear();

    for (const id of compacted) {
      this.processedCommandIds.add(id);
    }
  }

  private validateRequest(request: RuntimeSessionCheckpointRequest): void {
    if (!Number.isFinite(request.occurredAtEpochMs) || request.occurredAtEpochMs <= 0) {
      throw new Error("Invalid checkpoint request: occurredAtEpochMs must be positive and finite.");
    }

    if (request.commandId !== undefined && request.commandId.trim().length === 0) {
      throw new Error("Invalid checkpoint request: commandId cannot be empty.");
    }
  }

  private createCheckpointId(request: RuntimeSessionCheckpointRequest, sequence: number): string {
    const commandPart = request.commandId ?? "no-command";
    return `checkpoint-${sequence}-${request.reason}-${request.occurredAtEpochMs}-${this.hash(commandPart)}`;
  }

  private hash(value: string): string {
    let hash = 2166136261;

    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0).toString(16);
  }
}
