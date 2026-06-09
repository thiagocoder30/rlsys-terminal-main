import type {
  PaperEntryLedgerRepositoryPort,
} from '../ledger/PaperEntryLedgerRepositoryPort.js';
import {
  PaperEntryLedgerQueryService,
} from '../ledger/PaperEntryLedgerQueryService.js';

export type FirstPaperTradingReadinessStatus =
  | 'PAPER_READY'
  | 'NEEDS_REVIEW'
  | 'BLOCKED';

export interface FirstPaperTradingReadinessInput {
  readonly minimumRecommendedLedgerEntries?: number;
  readonly maxDeniedByHudRatio?: number;
  readonly maxRejectedByOperatorRatio?: number;
  readonly latestEntryLimit?: number;
}

export interface FirstPaperTradingReadinessCheck {
  readonly name: string;
  readonly status: FirstPaperTradingReadinessStatus;
  readonly message: string;
}

export interface FirstPaperTradingReadinessReport {
  readonly status: FirstPaperTradingReadinessStatus;
  readonly generatedAtEpochMs: number;
  readonly checks: readonly FirstPaperTradingReadinessCheck[];
  readonly totalEntries: number;
  readonly authorizedCount: number;
  readonly rejectedByOperatorCount: number;
  readonly deniedByHudCount: number;
  readonly latestEntryCount: number;
  readonly recommendation: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface FirstPaperTradingReadinessTextReport {
  readonly status: FirstPaperTradingReadinessStatus;
  readonly generatedAtEpochMs: number;
  readonly text: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface FirstPaperTradingReadinessSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

export interface FirstPaperTradingReadinessFailure {
  readonly ok: false;
  readonly error: {
    readonly code: 'FIRST_PAPER_TRADING_READINESS_COMMAND_ERROR';
    readonly message: string;
  };
}

export type FirstPaperTradingReadinessResult<T> =
  | FirstPaperTradingReadinessSuccess<T>
  | FirstPaperTradingReadinessFailure;

/**
 * First PAPER trading readiness command.
 *
 * This command is a pre-flight operator gate. It does not open a session, does
 * not execute bets, does not click any external interface and does not authorize
 * live money. It only evaluates whether the PAPER ledger/query path is healthy
 * enough to start a supervised PAPER operation.
 */
export class FirstPaperTradingReadinessCommand {
  private readonly repository: PaperEntryLedgerRepositoryPort;
  private readonly queryService: PaperEntryLedgerQueryService;

  public constructor(repository: PaperEntryLedgerRepositoryPort) {
    this.repository = repository;
    this.queryService = new PaperEntryLedgerQueryService(repository);
  }

  public async evaluate(
    input: FirstPaperTradingReadinessInput = {},
    generatedAtEpochMs = Date.now(),
  ): Promise<FirstPaperTradingReadinessResult<FirstPaperTradingReadinessReport>> {
    const policy = this.normalizePolicy(input);

    try {
      const stats = await this.repository.stats();

      if (!stats.ok) {
        return this.failure(stats.error.message);
      }

      const latest = await this.queryService.latest(policy.latestEntryLimit);

      if (!latest.ok) {
        return this.failure(latest.error.message);
      }

      const checks: FirstPaperTradingReadinessCheck[] = [];

      checks.push({
        name: 'LEDGER_REPOSITORY_ACCESS',
        status: 'PAPER_READY',
        message: 'Paper entry ledger repository is readable.',
      });

      checks.push({
        name: 'QUERY_SERVICE_ACCESS',
        status: 'PAPER_READY',
        message: 'Paper entry ledger query service is readable.',
      });

      if (stats.value.totalEntries === 0) {
        checks.push({
          name: 'FIRST_SESSION_EMPTY_LEDGER',
          status: 'PAPER_READY',
          message: 'Ledger is empty. First supervised PAPER trading session may start with audit from zero.',
        });
      } else if (stats.value.totalEntries < policy.minimumRecommendedLedgerEntries) {
        checks.push({
          name: 'LEDGER_HISTORY_DEPTH',
          status: 'NEEDS_REVIEW',
          message: `Ledger has ${stats.value.totalEntries} entries; recommended minimum is ${policy.minimumRecommendedLedgerEntries}.`,
        });
      } else {
        checks.push({
          name: 'LEDGER_HISTORY_DEPTH',
          status: 'PAPER_READY',
          message: 'Ledger history depth is sufficient for operator review.',
        });
      }

      const deniedRatio = stats.value.totalEntries > 0
        ? stats.value.deniedByHudCount / stats.value.totalEntries
        : 0;
      const rejectedRatio = stats.value.totalEntries > 0
        ? stats.value.rejectedByOperatorCount / stats.value.totalEntries
        : 0;

      if (deniedRatio > policy.maxDeniedByHudRatio) {
        checks.push({
          name: 'HUD_DENIAL_RATIO',
          status: 'NEEDS_REVIEW',
          message: `HUD denial ratio ${(deniedRatio * 100).toFixed(2)}% exceeds policy ${(policy.maxDeniedByHudRatio * 100).toFixed(2)}%.`,
        });
      } else {
        checks.push({
          name: 'HUD_DENIAL_RATIO',
          status: 'PAPER_READY',
          message: 'HUD denial ratio is within readiness policy.',
        });
      }

      if (rejectedRatio > policy.maxRejectedByOperatorRatio) {
        checks.push({
          name: 'OPERATOR_REJECTION_RATIO',
          status: 'NEEDS_REVIEW',
          message: `Operator rejection ratio ${(rejectedRatio * 100).toFixed(2)}% exceeds policy ${(policy.maxRejectedByOperatorRatio * 100).toFixed(2)}%.`,
        });
      } else {
        checks.push({
          name: 'OPERATOR_REJECTION_RATIO',
          status: 'PAPER_READY',
          message: 'Operator rejection ratio is within readiness policy.',
        });
      }

      checks.push({
        name: 'PAPER_ONLY_GOVERNANCE',
        status: 'PAPER_READY',
        message: 'Paper-only governance is enforced: no live money, no automatic execution, no automatic bet execution.',
      });

      const status = this.resolveStatus(checks);
      const recommendation = this.recommendationFor(status);

      return {
        ok: true,
        value: Object.freeze({
          status,
          generatedAtEpochMs,
          checks: Object.freeze(checks),
          totalEntries: stats.value.totalEntries,
          authorizedCount: stats.value.authorizedCount,
          rejectedByOperatorCount: stats.value.rejectedByOperatorCount,
          deniedByHudCount: stats.value.deniedByHudCount,
          latestEntryCount: latest.value.entries.length,
          recommendation,
          paperOnly: true as const,
          liveMoneyAuthorization: false as const,
          automaticExecutionAllowed: false as const,
          automaticBetExecutionAllowed: false as const,
          humanSupervisionRequired: true as const,
        }),
      };
    } catch (error: unknown) {
      return this.failure(error instanceof Error ? error.message : String(error));
    }
  }

  public async textReport(
    input: FirstPaperTradingReadinessInput = {},
    generatedAtEpochMs = Date.now(),
  ): Promise<FirstPaperTradingReadinessResult<FirstPaperTradingReadinessTextReport>> {
    const evaluated = await this.evaluate(input, generatedAtEpochMs);

    if (!evaluated.ok) {
      return evaluated;
    }

    const lines = [
      'RL.SYS CORE — FIRST PAPER TRADING READINESS',
      '============================================',
      `Generated At EpochMs: ${evaluated.value.generatedAtEpochMs}`,
      `Status: ${evaluated.value.status}`,
      `Recommendation: ${evaluated.value.recommendation}`,
      '',
      'Ledger:',
      `Total Entries: ${evaluated.value.totalEntries}`,
      `Authorized: ${evaluated.value.authorizedCount}`,
      `Rejected By Operator: ${evaluated.value.rejectedByOperatorCount}`,
      `Denied By HUD: ${evaluated.value.deniedByHudCount}`,
      `Latest Entry Count: ${evaluated.value.latestEntryCount}`,
      '',
      'Checks:',
    ];

    for (const check of evaluated.value.checks) {
      lines.push(` - ${check.name}: ${check.status} — ${check.message}`);
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
        status: evaluated.value.status,
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

  private normalizePolicy(input: FirstPaperTradingReadinessInput): Required<FirstPaperTradingReadinessInput> {
    return Object.freeze({
      minimumRecommendedLedgerEntries: Number.isFinite(input.minimumRecommendedLedgerEntries)
        ? Math.max(0, Math.floor(Number(input.minimumRecommendedLedgerEntries)))
        : 0,
      maxDeniedByHudRatio: Number.isFinite(input.maxDeniedByHudRatio)
        ? Math.max(0, Math.min(1, Number(input.maxDeniedByHudRatio)))
        : 0.8,
      maxRejectedByOperatorRatio: Number.isFinite(input.maxRejectedByOperatorRatio)
        ? Math.max(0, Math.min(1, Number(input.maxRejectedByOperatorRatio)))
        : 0.8,
      latestEntryLimit: Number.isFinite(input.latestEntryLimit)
        ? Math.max(1, Math.min(50, Math.floor(Number(input.latestEntryLimit))))
        : 10,
    });
  }

  private resolveStatus(
    checks: readonly FirstPaperTradingReadinessCheck[],
  ): FirstPaperTradingReadinessStatus {
    if (checks.some((check) => check.status === 'BLOCKED')) {
      return 'BLOCKED';
    }

    if (checks.some((check) => check.status === 'NEEDS_REVIEW')) {
      return 'NEEDS_REVIEW';
    }

    return 'PAPER_READY';
  }

  private recommendationFor(status: FirstPaperTradingReadinessStatus): string {
    if (status === 'PAPER_READY') {
      return 'Operator may start the first supervised PAPER trading session. Live money remains blocked.';
    }

    if (status === 'NEEDS_REVIEW') {
      return 'Operator should review readiness warnings before starting PAPER trading. Live money remains blocked.';
    }

    return 'Operator must not start PAPER trading until blocking issues are resolved. Live money remains blocked.';
  }

  private failure(message: string): FirstPaperTradingReadinessFailure {
    return {
      ok: false,
      error: {
        code: 'FIRST_PAPER_TRADING_READINESS_COMMAND_ERROR',
        message,
      },
    };
  }
}
