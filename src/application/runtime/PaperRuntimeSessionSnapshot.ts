export type PaperRuntimeSnapshotSessionState =
  | "IDLE"
  | "READY"
  | "RUNNING"
  | "PAUSED"
  | "FINISHED";

export interface PaperRuntimeSessionSnapshot {
  readonly schemaVersion: 1;
  readonly savedAtEpochMs: number;
  readonly sessionState: PaperRuntimeSnapshotSessionState;
  readonly iteration: number;
  readonly lastCommand?: string;
  readonly gracefulShutdown: boolean;
}

export interface PaperRuntimeSessionSnapshotRepository {
  save(snapshot: PaperRuntimeSessionSnapshot): void;
  load(): PaperRuntimeSessionSnapshot | null;
}

/**
 * Builds bounded paper runtime session snapshots.
 *
 * Complexity:
 * - O(1)
 * - Memory O(1)
 */
export class PaperRuntimeSessionSnapshotFactory {
  public create(input: {
    readonly sessionState: PaperRuntimeSnapshotSessionState;
    readonly iteration: number;
    readonly lastCommand?: string;
    readonly gracefulShutdown: boolean;
  }): PaperRuntimeSessionSnapshot {
    if (!Number.isInteger(input.iteration) || input.iteration < 0) {
      throw new Error("Invalid paper runtime snapshot: iteration must be a non-negative integer.");
    }

    return {
      schemaVersion: 1,
      savedAtEpochMs: Date.now(),
      sessionState: input.sessionState,
      iteration: input.iteration,
      lastCommand: input.lastCommand,
      gracefulShutdown: input.gracefulShutdown,
    };
  }
}
