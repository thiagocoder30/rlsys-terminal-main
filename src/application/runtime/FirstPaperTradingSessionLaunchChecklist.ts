import type {
  PaperEntryLedgerRepositoryPort,
} from '../ledger/PaperEntryLedgerRepositoryPort.js';
import {
  FirstPaperTradingReadinessCommand,
  type FirstPaperTradingReadinessStatus,
} from './FirstPaperTradingReadinessCommand.js';

export type FirstPaperTradingSessionLaunchStatus =
  | 'PAPER_SESSION_READY'
  | 'PAPER_SESSION_NEEDS_REVIEW'
  | 'PAPER_SESSION_BLOCKED';

export interface FirstPaperTradingSessionLaunchInput {
  readonly sessionId: string;
  readonly operatorConfirmedLaunch: boolean;
  readonly runtimePaperAvailable?: boolean;
  readonly snapshotPathAvailable?: boolean;
  readonly ledgerPathConfigured?: boolean;
  readonly minimumRecommendedLedgerEntries?: number;
  readonly maxDeniedByHudRatio?: number;
  readonly maxRejectedByOperatorRatio?: number;
}

export interface FirstPaperTradingSessionLaunchCheck {
  readonly name: string;
  readonly status: FirstPaperTradingSessionLaunchStatus;
  readonly message: string;
}

export interface FirstPaperTradingSessionLaunchReport {
  readonly status: FirstPaperTradingSessionLaunchStatus;
  readonly generatedAtEpochMs: number;
  readonly sessionId: string;
  readonly checks: readonly FirstPaperTradingSessionLaunchCheck[];
  readonly readinessStatus: FirstPaperTradingReadinessStatus;
  readonly recommendation: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface FirstPaperTradingSessionLaunchTextReport {
  readonly status: FirstPaperTradingSessionLaunchStatus;
  readonly generatedAtEpochMs: number;
  readonly text: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface FirstPaperTradingSessionLaunchSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

export interface FirstPaperTradingSessionLaunchFailure {
  readonly ok: false;
  readonly error: {
    readonly code: 'FIRST_PAPER_TRADING_SESSION_LAUNCH_CHECKLIST_ERROR';
    readonly message: string;
  };
}

export type FirstPaperTradingSessionLaunchResult<T> =
  | FirstPaperTradingSessionLaunchSuccess<T>
  | FirstPaperTradingSessionLaunchFailure;

/**
 * Final institutional launch checklist before the first supervised PAPER session.
 *
 * This command does not open a real-money operation, does not execute bets and
 * does not connect to external casino/platform UIs. It only classifies whether
 * the operator may start a supervised PAPER session.
 */
export class FirstPaperTradingSessionLaunchChecklist {
  private readonly readinessCommand: FirstPaperTradingReadinessCommand;

  public constructor(repository: PaperEntryLedgerRepositoryPort) {
    this.readinessCommand = new FirstPaperTradingReadinessCommand(repository);
  }

  public async evaluate(
    input: FirstPaperTradingSessionLaunchInput,
    generatedAtEpochMs = Date.now(),
  ): Promise<FirstPaperTradingSessionLaunchResult<FirstPaperTradingSessionLaunchReport>> {
    const sessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() : '';

    if (sessionId.length === 0) {
      return this.failure('sessionId is required');
    }

    const readiness = await this.readinessCommand.evaluate({
      minimumRecommendedLedgerEntries: input.minimumRecommendedLedgerEntries,
      maxDeniedByHudRatio: input.maxDeniedByHudRatio,
      maxRejectedByOperatorRatio: input.maxRejectedByOperatorRatio,
      latestEntryLimit: 10,
    }, generatedAtEpochMs);

    if (!readiness.ok) {
      return this.failure(readiness.error.message);
    }

    const checks: FirstPaperTradingSessionLaunchCheck[] = [];

    checks.push({
      name: 'READINESS_COMMAND',
      status: this.fromReadiness(readiness.value.status),
      message: `Readiness command returned ${readiness.value.status}.`,
    });

    checks.push({
      name: 'SESSION_ID',
      status: 'PAPER_SESSION_READY',
      message: `SessionId accepted: ${sessionId}.`,
    });

    checks.push({
      name: 'OPERATOR_CONFIRMATION',
      status: input.operatorConfirmedLaunch ? 'PAPER_SESSION_READY' : 'PAPER_SESSION_BLOCKED',
      message: input.operatorConfirmedLaunch
        ? 'Operator explicitly confirmed supervised PAPER session launch.'
        : 'Operator confirmation is required before launching PAPER session.',
    });

    checks.push({
      name: 'RUNTIME_PAPER_AVAILABLE',
      status: input.runtimePaperAvailable === false ? 'PAPER_SESSION_BLOCKED' : 'PAPER_SESSION_READY',
      message: input.runtimePaperAvailable === false
        ? 'Paper runtime availability was not confirmed.'
        : 'Paper runtime availability confirmed.',
    });

    checks.push({
      name: 'SNAPSHOT_PATH_AVAILABLE',
      status: input.snapshotPathAvailable === false ? 'PAPER_SESSION_NEEDS_REVIEW' : 'PAPER_SESSION_READY',
      message: input.snapshotPathAvailable === false
        ? 'Snapshot path was not confirmed. Continue only if operator accepts reduced recovery assurance.'
        : 'Snapshot path availability confirmed.',
    });

    checks.push({
      name: 'LEDGER_PATH_CONFIGURED',
      status: input.ledgerPathConfigured === false ? 'PAPER_SESSION_BLOCKED' : 'PAPER_SESSION_READY',
      message: input.ledgerPathConfigured === false
        ? 'Ledger path must be configured before PAPER session launch.'
        : 'Ledger path configured.',
    });

    checks.push({
      name: 'PAPER_ONLY_GOVERNANCE',
      status: 'PAPER_SESSION_READY',
      message: 'Live money, automatic execution and automatic bet execution remain blocked.',
    });

    const status = this.resolveStatus(checks);
    const recommendation = this.recommendationFor(status);

    return {
      ok: true,
      value: Object.freeze({
        status,
        generatedAtEpochMs,
        sessionId,
        checks: Object.freeze(checks),
        readinessStatus: readiness.value.status,
        recommendation,
        paperOnly: true as const,
        liveMoneyAuthorization: false as const,
        automaticExecutionAllowed: false as const,
        automaticBetExecutionAllowed: false as const,
        humanSupervisionRequired: true as const,
      }),
    };
  }

  public async textReport(
    input: FirstPaperTradingSessionLaunchInput,
    generatedAtEpochMs = Date.now(),
  ): Promise<FirstPaperTradingSessionLaunchResult<FirstPaperTradingSessionLaunchTextReport>> {
    const evaluated = await this.evaluate(input, generatedAtEpochMs);

    if (!evaluated.ok) {
      return evaluated;
    }

    const lines = [
      'RL.SYS CORE — FIRST PAPER SESSION LAUNCH CHECKLIST',
      '===================================================',
      `Generated At EpochMs: ${evaluated.value.generatedAtEpochMs}`,
      `SessionId: ${evaluated.value.sessionId}`,
      `Status: ${evaluated.value.status}`,
      `ReadinessStatus: ${evaluated.value.readinessStatus}`,
      `Recommendation: ${evaluated.value.recommendation}`,
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

  private fromReadiness(
    status: FirstPaperTradingReadinessStatus,
  ): FirstPaperTradingSessionLaunchStatus {
    if (status === 'PAPER_READY') {
      return 'PAPER_SESSION_READY';
    }

    if (status === 'NEEDS_REVIEW') {
      return 'PAPER_SESSION_NEEDS_REVIEW';
    }

    return 'PAPER_SESSION_BLOCKED';
  }

  private resolveStatus(
    checks: readonly FirstPaperTradingSessionLaunchCheck[],
  ): FirstPaperTradingSessionLaunchStatus {
    if (checks.some((check) => check.status === 'PAPER_SESSION_BLOCKED')) {
      return 'PAPER_SESSION_BLOCKED';
    }

    if (checks.some((check) => check.status === 'PAPER_SESSION_NEEDS_REVIEW')) {
      return 'PAPER_SESSION_NEEDS_REVIEW';
    }

    return 'PAPER_SESSION_READY';
  }

  private recommendationFor(status: FirstPaperTradingSessionLaunchStatus): string {
    if (status === 'PAPER_SESSION_READY') {
      return 'Operator may launch the first supervised PAPER session. Live money remains blocked.';
    }

    if (status === 'PAPER_SESSION_NEEDS_REVIEW') {
      return 'Operator should review launch warnings before starting the supervised PAPER session.';
    }

    return 'Operator must not launch the PAPER session until blocking issues are resolved.';
  }

  private failure(message: string): FirstPaperTradingSessionLaunchFailure {
    return {
      ok: false,
      error: {
        code: 'FIRST_PAPER_TRADING_SESSION_LAUNCH_CHECKLIST_ERROR',
        message,
      },
    };
  }
}
