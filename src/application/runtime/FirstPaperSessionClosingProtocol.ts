import type {
  PaperEntryLedgerRepositoryPort,
  PaperEntryLedgerRepositoryStats,
} from '../ledger/PaperEntryLedgerRepositoryPort.js';
import {
  PaperEntryLedgerQueryService,
} from '../ledger/PaperEntryLedgerQueryService.js';

export type FirstPaperSessionClosingStatus =
  | 'SESSION_CLOSED'
  | 'SESSION_CLOSED_WITH_REVIEW'
  | 'SESSION_CLOSING_BLOCKED';

export interface FirstPaperSessionClosingInput {
  readonly sessionId: string;
  readonly operatorConfirmedClose: boolean;
  readonly snapshotValidated?: boolean;
  readonly ledgerValidated?: boolean;
  readonly reportExported?: boolean;
  readonly auditExported?: boolean;
  readonly totalWins?: number;
  readonly totalLosses?: number;
  readonly totalSkips?: number;
  readonly closingNotes?: readonly string[];
  readonly allowCloseWithReview?: boolean;
}

export interface FirstPaperSessionClosingReport {
  readonly sessionId: string;
  readonly status: FirstPaperSessionClosingStatus;
  readonly generatedAtEpochMs: number;
  readonly ledgerValidated: boolean;
  readonly snapshotValidated: boolean;
  readonly reportExported: boolean;
  readonly auditExported: boolean;
  readonly totalEntries: number;
  readonly totalWins: number;
  readonly totalLosses: number;
  readonly totalSkips: number;
  readonly authorizedCount: number;
  readonly rejectedByOperatorCount: number;
  readonly deniedByHudCount: number;
  readonly latestEntryCount: number;
  readonly auditSummary: string;
  readonly certificationCandidate: boolean;
  readonly closingNotes: readonly string[];
  readonly recommendation: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface FirstPaperSessionClosingTextReport {
  readonly status: FirstPaperSessionClosingStatus;
  readonly generatedAtEpochMs: number;
  readonly text: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface FirstPaperSessionClosingSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

export interface FirstPaperSessionClosingFailure {
  readonly ok: false;
  readonly error: {
    readonly code: 'FIRST_PAPER_SESSION_CLOSING_PROTOCOL_ERROR';
    readonly message: string;
  };
}

export type FirstPaperSessionClosingResult<T> =
  | FirstPaperSessionClosingSuccess<T>
  | FirstPaperSessionClosingFailure;

/**
 * Institutional closing protocol for the first supervised PAPER session.
 *
 * This service only classifies and reports the closing state. It does not place
 * bets, does not automate any interface, does not authorize live money and does
 * not mutate ledger records.
 */
export class FirstPaperSessionClosingProtocol {
  private readonly repository: PaperEntryLedgerRepositoryPort;
  private readonly queryService: PaperEntryLedgerQueryService;

  public constructor(repository: PaperEntryLedgerRepositoryPort) {
    this.repository = repository;
    this.queryService = new PaperEntryLedgerQueryService(repository);
  }

  public async close(
    input: FirstPaperSessionClosingInput,
    generatedAtEpochMs = Date.now(),
  ): Promise<FirstPaperSessionClosingResult<FirstPaperSessionClosingReport>> {
    const sessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() : '';

    if (sessionId.length === 0) {
      return this.failure('sessionId is required');
    }

    const stats = await this.repository.stats();

    if (!stats.ok) {
      return this.failure(stats.error.message);
    }

    const latest = await this.queryService.bySession(sessionId, 25);

    if (!latest.ok) {
      return this.failure(latest.error.message);
    }

    const ledgerValidated = input.ledgerValidated !== false;
    const snapshotValidated = input.snapshotValidated !== false;
    const reportExported = input.reportExported !== false;
    const auditExported = input.auditExported !== false;
    const operatorConfirmedClose = input.operatorConfirmedClose === true;
    const allowCloseWithReview = input.allowCloseWithReview === true;

    const totalWins = this.safeCount(input.totalWins);
    const totalLosses = this.safeCount(input.totalLosses);
    const totalSkips = this.safeCount(input.totalSkips);

    const status = this.resolveStatus({
      operatorConfirmedClose,
      ledgerValidated,
      snapshotValidated,
      reportExported,
      auditExported,
      allowCloseWithReview,
    });

    const certificationCandidate = status === 'SESSION_CLOSED';

    const auditSummary = this.auditSummary({
      status,
      stats: stats.value,
      ledgerValidated,
      snapshotValidated,
      reportExported,
      auditExported,
      totalWins,
      totalLosses,
      totalSkips,
    });

    return {
      ok: true,
      value: Object.freeze({
        sessionId,
        status,
        generatedAtEpochMs,
        ledgerValidated,
        snapshotValidated,
        reportExported,
        auditExported,
        totalEntries: stats.value.totalEntries,
        totalWins,
        totalLosses,
        totalSkips,
        authorizedCount: stats.value.authorizedCount,
        rejectedByOperatorCount: stats.value.rejectedByOperatorCount,
        deniedByHudCount: stats.value.deniedByHudCount,
        latestEntryCount: latest.value.entries.length,
        auditSummary,
        certificationCandidate,
        closingNotes: this.normalizeNotes(input.closingNotes),
        recommendation: this.recommendationFor(status),
        paperOnly: true as const,
        liveMoneyAuthorization: false as const,
        automaticExecutionAllowed: false as const,
        automaticBetExecutionAllowed: false as const,
        humanSupervisionRequired: true as const,
      }),
    };
  }

  public async textReport(
    input: FirstPaperSessionClosingInput,
    generatedAtEpochMs = Date.now(),
  ): Promise<FirstPaperSessionClosingResult<FirstPaperSessionClosingTextReport>> {
    const closed = await this.close(input, generatedAtEpochMs);

    if (!closed.ok) {
      return closed;
    }

    const lines = [
      'RL.SYS CORE — FIRST PAPER SESSION CLOSING PROTOCOL',
      '====================================================',
      `Generated At EpochMs: ${closed.value.generatedAtEpochMs}`,
      `SessionId: ${closed.value.sessionId}`,
      `Status: ${closed.value.status}`,
      `Recommendation: ${closed.value.recommendation}`,
      '',
      'Validation:',
      `LedgerValidated: ${closed.value.ledgerValidated}`,
      `SnapshotValidated: ${closed.value.snapshotValidated}`,
      `ReportExported: ${closed.value.reportExported}`,
      `AuditExported: ${closed.value.auditExported}`,
      `CertificationCandidate: ${closed.value.certificationCandidate}`,
      '',
      'Session Totals:',
      `Ledger Entries: ${closed.value.totalEntries}`,
      `Latest Session Entries: ${closed.value.latestEntryCount}`,
      `Authorized Entries: ${closed.value.authorizedCount}`,
      `Rejected By Operator: ${closed.value.rejectedByOperatorCount}`,
      `Denied By HUD: ${closed.value.deniedByHudCount}`,
      `Wins: ${closed.value.totalWins}`,
      `Losses: ${closed.value.totalLosses}`,
      `Skips: ${closed.value.totalSkips}`,
      '',
      'Audit Summary:',
      closed.value.auditSummary,
      '',
      'Closing Notes:',
    ];

    if (closed.value.closingNotes.length === 0) {
      lines.push(' - none');
    } else {
      for (const note of closed.value.closingNotes) {
        lines.push(` - ${note}`);
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
        status: closed.value.status,
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

  private resolveStatus(input: {
    readonly operatorConfirmedClose: boolean;
    readonly ledgerValidated: boolean;
    readonly snapshotValidated: boolean;
    readonly reportExported: boolean;
    readonly auditExported: boolean;
    readonly allowCloseWithReview: boolean;
  }): FirstPaperSessionClosingStatus {
    if (!input.operatorConfirmedClose || !input.ledgerValidated) {
      return 'SESSION_CLOSING_BLOCKED';
    }

    if (!input.snapshotValidated || !input.reportExported || !input.auditExported) {
      return input.allowCloseWithReview ? 'SESSION_CLOSED_WITH_REVIEW' : 'SESSION_CLOSING_BLOCKED';
    }

    return 'SESSION_CLOSED';
  }

  private auditSummary(input: {
    readonly status: FirstPaperSessionClosingStatus;
    readonly stats: PaperEntryLedgerRepositoryStats;
    readonly ledgerValidated: boolean;
    readonly snapshotValidated: boolean;
    readonly reportExported: boolean;
    readonly auditExported: boolean;
    readonly totalWins: number;
    readonly totalLosses: number;
    readonly totalSkips: number;
  }): string {
    return [
      `ClosingStatus=${input.status}`,
      `LedgerValidated=${input.ledgerValidated}`,
      `SnapshotValidated=${input.snapshotValidated}`,
      `ReportExported=${input.reportExported}`,
      `AuditExported=${input.auditExported}`,
      `LedgerEntries=${input.stats.totalEntries}`,
      `Authorized=${input.stats.authorizedCount}`,
      `RejectedByOperator=${input.stats.rejectedByOperatorCount}`,
      `DeniedByHud=${input.stats.deniedByHudCount}`,
      `Wins=${input.totalWins}`,
      `Losses=${input.totalLosses}`,
      `Skips=${input.totalSkips}`,
      'PaperOnly=true',
      'LiveMoneyAuthorization=false',
      'AutomaticExecutionAllowed=false',
      'AutomaticBetExecutionAllowed=false',
      'HumanSupervisionRequired=true',
    ].join('; ');
  }

  private safeCount(value: unknown): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, Math.floor(Number(value)));
  }

  private normalizeNotes(notes: readonly string[] | undefined): readonly string[] {
    if (!Array.isArray(notes)) {
      return Object.freeze([]);
    }

    return Object.freeze(
      notes
        .filter((note): note is string => typeof note === 'string')
        .map((note) => note.trim())
        .filter((note) => note.length > 0),
    );
  }

  private recommendationFor(status: FirstPaperSessionClosingStatus): string {
    if (status === 'SESSION_CLOSED') {
      return 'First PAPER session may be submitted as a certification candidate.';
    }

    if (status === 'SESSION_CLOSED_WITH_REVIEW') {
      return 'First PAPER session is closed with review warnings and should not be certified automatically.';
    }

    return 'First PAPER session closing is blocked until required closing conditions are satisfied.';
  }

  private failure(message: string): FirstPaperSessionClosingFailure {
    return {
      ok: false,
      error: {
        code: 'FIRST_PAPER_SESSION_CLOSING_PROTOCOL_ERROR',
        message,
      },
    };
  }
}
