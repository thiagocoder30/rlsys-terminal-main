import type {
  PaperEntryLedgerRepositoryPort,
  PaperEntryLedgerRepositoryResult,
  PaperEntryLedgerRepositoryStats,
} from './PaperEntryLedgerRepositoryPort.js';
import type {
  PaperEntrySupervisionLedgerEntry,
} from '../runtime/PaperEntrySupervisionLedgerExporter.js';

export type PaperEntryLedgerQuerySortOrder = 'ASC' | 'DESC';

export interface PaperEntryLedgerQueryInput {
  readonly sessionId?: string;
  readonly strategyName?: string;
  readonly status?: PaperEntrySupervisionLedgerEntry['status'];
  readonly operatorDecision?: PaperEntrySupervisionLedgerEntry['operatorDecision'];
  readonly fromEpochMs?: number;
  readonly toEpochMs?: number;
  readonly minimumConfidencePercent?: number;
  readonly limit?: number;
  readonly sortOrder?: PaperEntryLedgerQuerySortOrder;
}

export interface PaperEntryLedgerQuerySummary {
  readonly scannedEntries: number;
  readonly matchedEntries: number;
  readonly returnedEntries: number;
  readonly truncated: boolean;
  readonly sortOrder: PaperEntryLedgerQuerySortOrder;
  readonly limit: number;
}

export interface PaperEntryLedgerQueryReport {
  readonly entries: readonly PaperEntrySupervisionLedgerEntry[];
  readonly summary: PaperEntryLedgerQuerySummary;
  readonly repositoryStats: PaperEntryLedgerRepositoryStats;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface PaperEntryLedgerQueryTextReport {
  readonly title: string;
  readonly generatedAtEpochMs: number;
  readonly text: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

/**
 * Application service for querying supervised PAPER entry ledger records.
 *
 * This service depends only on the PaperEntryLedgerRepositoryPort. It does not
 * know whether persistence is JSONL, database, memory or another adapter.
 *
 * Complexity:
 * - Time: O(n), where n is loaded ledger entries.
 * - Space: O(limit), because returned entries are bounded by query limit.
 *
 * Institutional guarantees:
 * - query only
 * - no bet execution
 * - no live money authorization
 * - no external casino/platform integration
 */
export class PaperEntryLedgerQueryService {
  private readonly repository: PaperEntryLedgerRepositoryPort;

  public constructor(repository: PaperEntryLedgerRepositoryPort) {
    this.repository = repository;
  }

  public async query(
    input: PaperEntryLedgerQueryInput = {},
  ): Promise<PaperEntryLedgerRepositoryResult<PaperEntryLedgerQueryReport>> {
    const normalized = this.normalizeQuery(input);
    const loaded = await this.repository.loadAll();

    if (!loaded.ok) {
      return loaded;
    }

    const repositoryStatsResult = await this.repository.stats();

    if (!repositoryStatsResult.ok) {
      return repositoryStatsResult;
    }

    const sorted = [...loaded.value.entries].sort((left, right) => {
      if (normalized.sortOrder === 'ASC') {
        return left.generatedAtEpochMs - right.generatedAtEpochMs;
      }

      return right.generatedAtEpochMs - left.generatedAtEpochMs;
    });

    const returned: PaperEntrySupervisionLedgerEntry[] = [];
    let matchedEntries = 0;
    let truncated = false;

    for (const entry of sorted) {
      if (!this.matches(entry, normalized)) {
        continue;
      }

      matchedEntries += 1;

      if (returned.length >= normalized.limit) {
        truncated = true;
        continue;
      }

      returned.push(entry);
    }

    return {
      ok: true,
      value: Object.freeze({
        entries: Object.freeze(returned),
        summary: Object.freeze({
          scannedEntries: loaded.value.entries.length,
          matchedEntries,
          returnedEntries: returned.length,
          truncated,
          sortOrder: normalized.sortOrder,
          limit: normalized.limit,
        }),
        repositoryStats: repositoryStatsResult.value,
        paperOnly: true as const,
        liveMoneyAuthorization: false as const,
        automaticExecutionAllowed: false as const,
        automaticBetExecutionAllowed: false as const,
        humanSupervisionRequired: true as const,
      }),
    };
  }

  public async latest(
    limit = 10,
  ): Promise<PaperEntryLedgerRepositoryResult<PaperEntryLedgerQueryReport>> {
    return this.query({
      limit,
      sortOrder: 'DESC',
    });
  }

  public async bySession(
    sessionId: string,
    limit = 50,
  ): Promise<PaperEntryLedgerRepositoryResult<PaperEntryLedgerQueryReport>> {
    return this.query({
      sessionId,
      limit,
      sortOrder: 'DESC',
    });
  }

  public async textReport(
    input: PaperEntryLedgerQueryInput = {},
    generatedAtEpochMs = Date.now(),
  ): Promise<PaperEntryLedgerRepositoryResult<PaperEntryLedgerQueryTextReport>> {
    const result = await this.query(input);

    if (!result.ok) {
      return result;
    }

    const lines = [
      'RL.SYS CORE — PAPER ENTRY LEDGER QUERY REPORT',
      '================================================',
      `Generated At EpochMs: ${generatedAtEpochMs}`,
      `Scanned Entries: ${result.value.summary.scannedEntries}`,
      `Matched Entries: ${result.value.summary.matchedEntries}`,
      `Returned Entries: ${result.value.summary.returnedEntries}`,
      `Truncated: ${result.value.summary.truncated}`,
      `Sort Order: ${result.value.summary.sortOrder}`,
      `Limit: ${result.value.summary.limit}`,
      '',
      'Repository Stats:',
      `Total Entries: ${result.value.repositoryStats.totalEntries}`,
      `Authorized: ${result.value.repositoryStats.authorizedCount}`,
      `Rejected By Operator: ${result.value.repositoryStats.rejectedByOperatorCount}`,
      `Denied By HUD: ${result.value.repositoryStats.deniedByHudCount}`,
      '',
      'Entries:',
    ];

    if (result.value.entries.length === 0) {
      lines.push(' - no matching PAPER entry ledger records');
    } else {
      for (const entry of result.value.entries) {
        lines.push([
          ` - ${entry.generatedAtEpochMs}`,
          entry.sessionId,
          entry.strategyName,
          entry.status,
          `confidence=${entry.confidencePercent.toFixed(2)}%`,
          `authorizedStake=${entry.authorizedStake.toFixed(2)}`,
          `checksum=${entry.checksum}`,
        ].join(' | '));
      }
    }

    lines.push('');
    lines.push('Governance:');
    lines.push('PaperOnly: true');
    lines.push('LiveMoneyAuthorization: false');
    lines.push('AutomaticExecutionAllowed: false');
    lines.push('AutomaticBetExecutionAllowed: false');
    lines.push('HumanSupervisionRequired: true');

    return {
      ok: true,
      value: Object.freeze({
        title: 'RL.SYS CORE — PAPER ENTRY LEDGER QUERY REPORT',
        generatedAtEpochMs,
        text: `${lines.join('\n')}\n`,
        paperOnly: true as const,
        liveMoneyAuthorization: false as const,
        automaticExecutionAllowed: false as const,
        automaticBetExecutionAllowed: false as const,
        humanSupervisionRequired: true as const,
      }),
    };
  }

  private normalizeQuery(input: PaperEntryLedgerQueryInput): Required<PaperEntryLedgerQueryInput> {
    return Object.freeze({
      sessionId: typeof input.sessionId === 'string' ? input.sessionId.trim() : '',
      strategyName: typeof input.strategyName === 'string' ? input.strategyName.trim() : '',
      status: input.status || 'PAPER_ENTRY_AUTHORIZED',
      operatorDecision: input.operatorDecision || 'CONFIRMAR',
      fromEpochMs: Number.isFinite(input.fromEpochMs) ? Number(input.fromEpochMs) : 0,
      toEpochMs: Number.isFinite(input.toEpochMs) ? Number(input.toEpochMs) : Number.MAX_SAFE_INTEGER,
      minimumConfidencePercent: Number.isFinite(input.minimumConfidencePercent)
        ? Math.max(0, Math.min(100, Number(input.minimumConfidencePercent)))
        : 0,
      limit: Number.isFinite(input.limit)
        ? Math.max(0, Math.min(500, Math.floor(Number(input.limit))))
        : 50,
      sortOrder: input.sortOrder === 'ASC' ? 'ASC' : 'DESC',
    });
  }

  private matches(
    entry: PaperEntrySupervisionLedgerEntry,
    query: Required<PaperEntryLedgerQueryInput>,
  ): boolean {
    if (query.sessionId.length > 0 && entry.sessionId !== query.sessionId) {
      return false;
    }

    if (query.strategyName.length > 0 && entry.strategyName !== query.strategyName) {
      return false;
    }

    if (entry.generatedAtEpochMs < query.fromEpochMs || entry.generatedAtEpochMs > query.toEpochMs) {
      return false;
    }

    if (entry.confidencePercent < query.minimumConfidencePercent) {
      return false;
    }

    if (
      query.status !== 'PAPER_ENTRY_AUTHORIZED' ||
      query.operatorDecision !== 'CONFIRMAR'
    ) {
      if (entry.status !== query.status) {
        return false;
      }

      if (entry.operatorDecision !== query.operatorDecision) {
        return false;
      }

      return true;
    }

    return true;
  }
}
