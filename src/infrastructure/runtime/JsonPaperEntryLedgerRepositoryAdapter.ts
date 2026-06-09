import { appendFile, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname } from 'node:path';

import type {
  PaperEntryLedgerRepositoryAppendResult,
  PaperEntryLedgerRepositoryLoadResult,
  PaperEntryLedgerRepositoryPort,
  PaperEntryLedgerRepositoryResult,
  PaperEntryLedgerRepositoryStats,
} from '../../application/ledger/PaperEntryLedgerRepositoryPort.js';
import type {
  PaperEntrySupervisionLedgerEntry,
} from '../../application/runtime/PaperEntrySupervisionLedgerExporter.js';

export interface JsonPaperEntryLedgerRepositoryAdapterConfig {
  readonly filePath: string;
}

/**
 * Append-only JSONL repository for supervised PAPER entry ledger entries.
 *
 * Storage format:
 * - one deterministic ledger entry per line
 * - append path does not load historical records
 * - read/stat paths are O(n), suitable for operator audit and local paper runs
 *
 * Institutional guarantees:
 * - paperOnly must remain true
 * - liveMoneyAuthorization must remain false
 * - automaticExecutionAllowed must remain false
 * - automaticBetExecutionAllowed must remain false
 */
export class JsonPaperEntryLedgerRepositoryAdapter implements PaperEntryLedgerRepositoryPort {
  private readonly filePath: string;

  public constructor(config: JsonPaperEntryLedgerRepositoryAdapterConfig) {
    if (
      typeof config !== 'object' ||
      config === null ||
      typeof config.filePath !== 'string' ||
      config.filePath.trim().length === 0
    ) {
      throw new Error('filePath is required');
    }

    this.filePath = config.filePath.trim();
  }

  public async append(
    entry: PaperEntrySupervisionLedgerEntry,
  ): Promise<PaperEntryLedgerRepositoryResult<PaperEntryLedgerRepositoryAppendResult>> {
    const validationFailure = this.validateEntry(entry);
    if (validationFailure !== null) {
      return validationFailure;
    }

    try {
      await mkdir(dirname(this.filePath), { recursive: true });
      await appendFile(this.filePath, `${JSON.stringify(entry)}\n`, 'utf8');

      return {
        ok: true,
        value: Object.freeze({
          appended: true,
          ledgerEntryId: entry.ledgerEntryId,
        }),
      };
    } catch (error: unknown) {
      return this.ioFailure(error);
    }
  }

  public async loadAll(): Promise<PaperEntryLedgerRepositoryResult<PaperEntryLedgerRepositoryLoadResult>> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const entries: PaperEntrySupervisionLedgerEntry[] = [];

      for (const line of raw.split('\n')) {
        const trimmed = line.trim();

        if (trimmed.length === 0) {
          continue;
        }

        let parsed: unknown;

        try {
          parsed = JSON.parse(trimmed);
        } catch (error: unknown) {
          return {
            ok: false,
            error: {
              code: 'INVALID_PAPER_ENTRY_LEDGER_REPOSITORY_INPUT',
              stage: 'VALIDATION',
              message: error instanceof Error ? error.message : 'invalid JSONL paper entry ledger line',
            },
          };
        }

        const validationFailure = this.validateEntry(parsed);
        if (validationFailure !== null) {
          return validationFailure;
        }

        entries.push(parsed as PaperEntrySupervisionLedgerEntry);
      }

      return {
        ok: true,
        value: Object.freeze({
          entries: Object.freeze(entries),
        }),
      };
    } catch (error: unknown) {
      if (this.isNotFound(error)) {
        return {
          ok: true,
          value: Object.freeze({
            entries: Object.freeze([]),
          }),
        };
      }

      return this.ioFailure(error);
    }
  }

  public async stats(): Promise<PaperEntryLedgerRepositoryResult<PaperEntryLedgerRepositoryStats>> {
    const loaded = await this.loadAll();

    if (!loaded.ok) {
      return loaded;
    }

    let authorizedCount = 0;
    let rejectedByOperatorCount = 0;
    let deniedByHudCount = 0;
    let latestEntry: PaperEntrySupervisionLedgerEntry | null = null;

    for (const entry of loaded.value.entries) {
      if (entry.status === 'PAPER_ENTRY_AUTHORIZED') {
        authorizedCount += 1;
      } else if (entry.status === 'PAPER_ENTRY_REJECTED_BY_OPERATOR') {
        rejectedByOperatorCount += 1;
      } else {
        deniedByHudCount += 1;
      }

      if (latestEntry === null || entry.generatedAtEpochMs >= latestEntry.generatedAtEpochMs) {
        latestEntry = entry;
      }
    }

    return {
      ok: true,
      value: Object.freeze({
        totalEntries: loaded.value.entries.length,
        authorizedCount,
        rejectedByOperatorCount,
        deniedByHudCount,
        latestEntry,
      }),
    };
  }

  public async clear(): Promise<PaperEntryLedgerRepositoryResult<true>> {
    try {
      await rm(this.filePath, { force: true });

      return {
        ok: true,
        value: true,
      };
    } catch (error: unknown) {
      return this.ioFailure(error);
    }
  }

  private validateEntry(entry: unknown): PaperEntryLedgerRepositoryResult<never> | null {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      typeof (entry as PaperEntrySupervisionLedgerEntry).ledgerEntryId !== 'string' ||
      (entry as PaperEntrySupervisionLedgerEntry).ledgerEntryId.trim().length === 0 ||
      typeof (entry as PaperEntrySupervisionLedgerEntry).exportId !== 'string' ||
      (entry as PaperEntrySupervisionLedgerEntry).exportId.trim().length === 0 ||
      !Number.isFinite((entry as PaperEntrySupervisionLedgerEntry).generatedAtEpochMs) ||
      (entry as PaperEntrySupervisionLedgerEntry).generatedAtEpochMs <= 0 ||
      typeof (entry as PaperEntrySupervisionLedgerEntry).supervisionId !== 'string' ||
      (entry as PaperEntrySupervisionLedgerEntry).supervisionId.trim().length === 0 ||
      typeof (entry as PaperEntrySupervisionLedgerEntry).sessionId !== 'string' ||
      (entry as PaperEntrySupervisionLedgerEntry).sessionId.trim().length === 0 ||
      typeof (entry as PaperEntrySupervisionLedgerEntry).strategyName !== 'string' ||
      (entry as PaperEntrySupervisionLedgerEntry).strategyName.trim().length === 0 ||
      (
        (entry as PaperEntrySupervisionLedgerEntry).status !== 'PAPER_ENTRY_AUTHORIZED' &&
        (entry as PaperEntrySupervisionLedgerEntry).status !== 'PAPER_ENTRY_REJECTED_BY_OPERATOR' &&
        (entry as PaperEntrySupervisionLedgerEntry).status !== 'PAPER_ENTRY_DENIED_BY_HUD'
      ) ||
      typeof (entry as PaperEntrySupervisionLedgerEntry).paperEntryAuthorized !== 'boolean' ||
      (
        (entry as PaperEntrySupervisionLedgerEntry).hudRecommendation !== 'ENTRAR' &&
        (entry as PaperEntrySupervisionLedgerEntry).hudRecommendation !== 'AGUARDAR'
      ) ||
      (
        (entry as PaperEntrySupervisionLedgerEntry).operatorDecision !== 'CONFIRMAR' &&
        (entry as PaperEntrySupervisionLedgerEntry).operatorDecision !== 'RECUSAR'
      ) ||
      (
        (entry as PaperEntrySupervisionLedgerEntry).operatorNote !== null &&
        typeof (entry as PaperEntrySupervisionLedgerEntry).operatorNote !== 'string'
      ) ||
      !Number.isFinite((entry as PaperEntrySupervisionLedgerEntry).requestedStake) ||
      (entry as PaperEntrySupervisionLedgerEntry).requestedStake < 0 ||
      !Number.isFinite((entry as PaperEntrySupervisionLedgerEntry).authorizedStake) ||
      (entry as PaperEntrySupervisionLedgerEntry).authorizedStake < 0 ||
      !Number.isFinite((entry as PaperEntrySupervisionLedgerEntry).confidencePercent) ||
      (entry as PaperEntrySupervisionLedgerEntry).confidencePercent < 0 ||
      (entry as PaperEntrySupervisionLedgerEntry).confidencePercent > 100 ||
      !Array.isArray((entry as PaperEntrySupervisionLedgerEntry).evidence) ||
      typeof (entry as PaperEntrySupervisionLedgerEntry).auditSummary !== 'string' ||
      (entry as PaperEntrySupervisionLedgerEntry).auditSummary.trim().length === 0 ||
      typeof (entry as PaperEntrySupervisionLedgerEntry).checksum !== 'string' ||
      (entry as PaperEntrySupervisionLedgerEntry).checksum.trim().length === 0 ||
      (entry as PaperEntrySupervisionLedgerEntry).paperOnly !== true ||
      (entry as PaperEntrySupervisionLedgerEntry).operatorDecisionRequired !== true ||
      (entry as PaperEntrySupervisionLedgerEntry).supervisedRecommendationOnly !== true ||
      (entry as PaperEntrySupervisionLedgerEntry).institutionalAnalysisMode !== true ||
      (entry as PaperEntrySupervisionLedgerEntry).automaticExecutionAllowed !== false ||
      (entry as PaperEntrySupervisionLedgerEntry).automaticBetExecutionAllowed !== false ||
      (entry as PaperEntrySupervisionLedgerEntry).liveMoneyAuthorization !== false
    ) {
      return {
        ok: false,
        error: {
          code: 'INVALID_PAPER_ENTRY_LEDGER_REPOSITORY_INPUT',
          stage: 'VALIDATION',
          message: 'paper entry ledger entry is invalid',
        },
      };
    }

    return null;
  }

  private isNotFound(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { readonly code?: string }).code === 'ENOENT'
    );
  }

  private ioFailure(error: unknown): PaperEntryLedgerRepositoryResult<never> {
    return {
      ok: false,
      error: {
        code: 'PAPER_ENTRY_LEDGER_REPOSITORY_IO_ERROR',
        stage: 'IO',
        message: error instanceof Error ? error.message : 'unknown paper entry ledger repository IO failure',
      },
    };
  }
}
