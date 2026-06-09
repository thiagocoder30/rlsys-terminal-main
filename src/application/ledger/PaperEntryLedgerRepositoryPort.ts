import type {
  PaperEntrySupervisionLedgerEntry,
} from '../runtime/PaperEntrySupervisionLedgerExporter.js';

export interface PaperEntryLedgerRepositoryAppendResult {
  readonly appended: true;
  readonly ledgerEntryId: string;
}

export interface PaperEntryLedgerRepositoryLoadResult {
  readonly entries: readonly PaperEntrySupervisionLedgerEntry[];
}

export interface PaperEntryLedgerRepositoryStats {
  readonly totalEntries: number;
  readonly authorizedCount: number;
  readonly rejectedByOperatorCount: number;
  readonly deniedByHudCount: number;
  readonly latestEntry: PaperEntrySupervisionLedgerEntry | null;
}

export interface PaperEntryLedgerRepositorySuccess<T> {
  readonly ok: true;
  readonly value: T;
}

export interface PaperEntryLedgerRepositoryFailure {
  readonly ok: false;
  readonly error: {
    readonly code:
      | 'INVALID_PAPER_ENTRY_LEDGER_REPOSITORY_INPUT'
      | 'PAPER_ENTRY_LEDGER_REPOSITORY_IO_ERROR';
    readonly stage: 'VALIDATION' | 'IO';
    readonly message: string;
  };
}

export type PaperEntryLedgerRepositoryResult<T> =
  | PaperEntryLedgerRepositorySuccess<T>
  | PaperEntryLedgerRepositoryFailure;

/**
 * Application-layer port for storing supervised PAPER entry ledger records.
 *
 * Implementations must remain append-only by default and must never execute
 * bets, click external UIs, call casino platforms or authorize live money.
 */
export interface PaperEntryLedgerRepositoryPort {
  append(
    entry: PaperEntrySupervisionLedgerEntry,
  ): Promise<PaperEntryLedgerRepositoryResult<PaperEntryLedgerRepositoryAppendResult>>;

  loadAll(): Promise<PaperEntryLedgerRepositoryResult<PaperEntryLedgerRepositoryLoadResult>>;

  stats(): Promise<PaperEntryLedgerRepositoryResult<PaperEntryLedgerRepositoryStats>>;

  clear(): Promise<PaperEntryLedgerRepositoryResult<true>>;
}
