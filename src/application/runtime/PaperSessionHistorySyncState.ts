export type PaperSessionHistorySyncStatus =
  | 'UNSYNCED'
  | 'SYNCED'
  | 'RESYNCED';

export interface PaperSessionHistorySyncSnapshot {
  readonly status: PaperSessionHistorySyncStatus;
  readonly rounds: readonly number[];
  readonly roundCount: number;
  readonly syncVersion: number;
  readonly synchronizedAtEpochMs?: number;
}

export interface PaperSessionHistorySyncInput {
  readonly rounds: readonly number[];
  readonly synchronizedAtEpochMs?: number;
}

/**
 * Owns the synchronized roulette-history snapshot for one PAPER session.
 *
 * The supplied history is always treated as a complete snapshot of the
 * operator's latest table extraction.
 *
 * Therefore:
 * - sync() stores the first accepted snapshot;
 * - resync() replaces the previous snapshot;
 * - histories are never implicitly concatenated.
 *
 * This component does not:
 * - parse clipboard text;
 * - calculate entropy;
 * - calculate VIX;
 * - qualify the table;
 * - modify bankroll or provider configuration;
 * - authorize PAPER operation.
 *
 * Complexity:
 * - Time: O(n) for validation and immutable copy.
 * - Memory: O(n), where n is the synchronized round count.
 */
export class PaperSessionHistorySyncState {
  private snapshot: PaperSessionHistorySyncSnapshot =
    Object.freeze({
      status: 'UNSYNCED' as const,
      rounds: Object.freeze([]),
      roundCount: 0,
      syncVersion: 0,
    });

  public current(): PaperSessionHistorySyncSnapshot {
    return this.snapshot;
  }

  public sync(
    input: PaperSessionHistorySyncInput,
  ): PaperSessionHistorySyncSnapshot {
    if (this.snapshot.status !== 'UNSYNCED') {
      throw new Error(
        'paper_session_history_already_synchronized',
      );
    }

    const rounds = this.validateAndCopyRounds(
      input.rounds,
    );

    this.snapshot = this.createSnapshot(
      'SYNCED',
      rounds,
      1,
      input.synchronizedAtEpochMs,
    );

    return this.snapshot;
  }

  public resync(
    input: PaperSessionHistorySyncInput,
  ): PaperSessionHistorySyncSnapshot {
    if (this.snapshot.status === 'UNSYNCED') {
      throw new Error(
        'paper_session_history_not_synchronized',
      );
    }

    const rounds = this.validateAndCopyRounds(
      input.rounds,
    );

    this.snapshot = this.createSnapshot(
      'RESYNCED',
      rounds,
      this.snapshot.syncVersion + 1,
      input.synchronizedAtEpochMs,
    );

    return this.snapshot;
  }

  private validateAndCopyRounds(
    rounds: readonly number[],
  ): readonly number[] {
    if (!Array.isArray(rounds)) {
      throw new Error(
        'paper_session_history_invalid_rounds',
      );
    }

    if (rounds.length === 0) {
      throw new Error(
        'paper_session_history_empty',
      );
    }

    const copy: number[] = [];

    for (const round of rounds) {
      if (
        !Number.isInteger(round) ||
        round < 0 ||
        round > 36
      ) {
        throw new Error(
          'paper_session_history_invalid_round',
        );
      }

      copy.push(round);
    }

    return Object.freeze(copy);
  }

  private createSnapshot(
    status: Exclude<
      PaperSessionHistorySyncStatus,
      'UNSYNCED'
    >,
    rounds: readonly number[],
    syncVersion: number,
    synchronizedAtEpochMs?: number,
  ): PaperSessionHistorySyncSnapshot {
    const timestamp =
      synchronizedAtEpochMs ?? Date.now();

    if (
      !Number.isFinite(timestamp) ||
      timestamp < 0
    ) {
      throw new Error(
        'paper_session_history_invalid_sync_timestamp',
      );
    }

    return Object.freeze({
      status,
      rounds,
      roundCount: rounds.length,
      syncVersion,
      synchronizedAtEpochMs: timestamp,
    });
  }
}
