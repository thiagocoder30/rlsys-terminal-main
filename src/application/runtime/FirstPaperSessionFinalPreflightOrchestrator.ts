import type {
  PaperEntryLedgerRepositoryPort,
  PaperEntryLedgerRepositoryStats,
} from '../ledger/PaperEntryLedgerRepositoryPort.js';
import {
  PaperEntryLedgerQueryService,
} from '../ledger/PaperEntryLedgerQueryService.js';
import {
  FirstPaperTradingReadinessCommand,
  type FirstPaperTradingReadinessStatus,
} from './FirstPaperTradingReadinessCommand.js';
import {
  FirstPaperTradingSessionLaunchChecklist,
  type FirstPaperTradingSessionLaunchStatus,
} from './FirstPaperTradingSessionLaunchChecklist.js';
import {
  FirstSupervisedPaperTradingSessionRecorder,
  type FirstSupervisedPaperTradingSessionRecordStatus,
} from './FirstSupervisedPaperTradingSessionRecorder.js';
import {
  FirstPaperSessionOperatorRunbookCommand,
  type FirstPaperSessionOperatorRunbookStatus,
} from './FirstPaperSessionOperatorRunbookCommand.js';

export type FirstPaperSessionFinalPreflightVerdict =
  | 'PAPER_OPERATIONAL_GO'
  | 'PAPER_OPERATIONAL_REVIEW'
  | 'PAPER_OPERATIONAL_BLOCKED';

export interface FirstPaperSessionFinalPreflightInput {
  readonly sessionId: string;
  readonly operatorConfirmedLaunch: boolean;
  readonly runtimePaperAvailable?: boolean;
  readonly snapshotPathAvailable?: boolean;
  readonly ledgerPathConfigured?: boolean;
  readonly minimumRecommendedLedgerEntries?: number;
  readonly maxDeniedByHudRatio?: number;
  readonly maxRejectedByOperatorRatio?: number;
  readonly operatorId?: string;
  readonly tableId?: string;
  readonly strategyName?: string;
  readonly bankrollLabel?: string;
  readonly plannedRounds?: number;
  readonly notes?: readonly string[];
  readonly allowNeedsReviewRecording?: boolean;
}

export interface FirstPaperSessionFinalPreflightReport {
  readonly verdict: FirstPaperSessionFinalPreflightVerdict;
  readonly generatedAtEpochMs: number;
  readonly sessionId: string;
  readonly readinessStatus: FirstPaperTradingReadinessStatus;
  readonly launchStatus: FirstPaperTradingSessionLaunchStatus;
  readonly recorderStatus: FirstSupervisedPaperTradingSessionRecordStatus;
  readonly runbookStatus: FirstPaperSessionOperatorRunbookStatus;
  readonly ledgerStats: PaperEntryLedgerRepositoryStats;
  readonly latestEntryCount: number;
  readonly recommendation: string;
  readonly nextOperatorCommand: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface FirstPaperSessionFinalPreflightTextReport {
  readonly verdict: FirstPaperSessionFinalPreflightVerdict;
  readonly generatedAtEpochMs: number;
  readonly text: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface FirstPaperSessionFinalPreflightSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

export interface FirstPaperSessionFinalPreflightFailure {
  readonly ok: false;
  readonly error: {
    readonly code: 'FIRST_PAPER_SESSION_FINAL_PREFLIGHT_ORCHESTRATOR_ERROR';
    readonly message: string;
  };
}

export type FirstPaperSessionFinalPreflightResult<T> =
  | FirstPaperSessionFinalPreflightSuccess<T>
  | FirstPaperSessionFinalPreflightFailure;

/**
 * Final preflight orchestrator for the first supervised PAPER session.
 *
 * This service composes every prior PAPER-readiness component and produces one
 * final operator verdict. It never executes bets, never opens external
 * platforms, never automates UI clicks and never authorizes live money.
 */
export class FirstPaperSessionFinalPreflightOrchestrator {
  private readonly repository: PaperEntryLedgerRepositoryPort;
  private readonly queryService: PaperEntryLedgerQueryService;
  private readonly readinessCommand: FirstPaperTradingReadinessCommand;
  private readonly launchChecklist: FirstPaperTradingSessionLaunchChecklist;
  private readonly recorder: FirstSupervisedPaperTradingSessionRecorder;
  private readonly runbook: FirstPaperSessionOperatorRunbookCommand;

  public constructor(repository: PaperEntryLedgerRepositoryPort) {
    this.repository = repository;
    this.queryService = new PaperEntryLedgerQueryService(repository);
    this.readinessCommand = new FirstPaperTradingReadinessCommand(repository);
    this.launchChecklist = new FirstPaperTradingSessionLaunchChecklist(repository);
    this.recorder = new FirstSupervisedPaperTradingSessionRecorder(repository);
    this.runbook = new FirstPaperSessionOperatorRunbookCommand(repository);
  }

  public async evaluate(
    input: FirstPaperSessionFinalPreflightInput,
    generatedAtEpochMs = Date.now(),
  ): Promise<FirstPaperSessionFinalPreflightResult<FirstPaperSessionFinalPreflightReport>> {
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

    const launch = await this.launchChecklist.evaluate(input, generatedAtEpochMs);

    if (!launch.ok) {
      return this.failure(launch.error.message);
    }

    const record = await this.recorder.record(input, generatedAtEpochMs);

    if (!record.ok) {
      return this.failure(record.error.message);
    }

    const runbook = await this.runbook.compose(input, generatedAtEpochMs);

    if (!runbook.ok) {
      return this.failure(runbook.error.message);
    }

    const stats = await this.repository.stats();

    if (!stats.ok) {
      return this.failure(stats.error.message);
    }

    const latest = await this.queryService.latest(10);

    if (!latest.ok) {
      return this.failure(latest.error.message);
    }

    const verdict = this.resolveVerdict({
      readinessStatus: readiness.value.status,
      launchStatus: launch.value.status,
      recorderStatus: record.value.record.status,
      runbookStatus: runbook.value.status,
    });

    return {
      ok: true,
      value: Object.freeze({
        verdict,
        generatedAtEpochMs,
        sessionId,
        readinessStatus: readiness.value.status,
        launchStatus: launch.value.status,
        recorderStatus: record.value.record.status,
        runbookStatus: runbook.value.status,
        ledgerStats: stats.value,
        latestEntryCount: latest.value.entries.length,
        recommendation: this.recommendationFor(verdict),
        nextOperatorCommand: runbook.value.operatorCommandPreview,
        paperOnly: true as const,
        liveMoneyAuthorization: false as const,
        automaticExecutionAllowed: false as const,
        automaticBetExecutionAllowed: false as const,
        humanSupervisionRequired: true as const,
      }),
    };
  }

  public async textReport(
    input: FirstPaperSessionFinalPreflightInput,
    generatedAtEpochMs = Date.now(),
  ): Promise<FirstPaperSessionFinalPreflightResult<FirstPaperSessionFinalPreflightTextReport>> {
    const result = await this.evaluate(input, generatedAtEpochMs);

    if (!result.ok) {
      return result;
    }

    const lines = [
      'RL.SYS CORE — FIRST PAPER SESSION FINAL PREFLIGHT',
      '==================================================',
      `Generated At EpochMs: ${result.value.generatedAtEpochMs}`,
      `SessionId: ${result.value.sessionId}`,
      `Verdict: ${result.value.verdict}`,
      `ReadinessStatus: ${result.value.readinessStatus}`,
      `LaunchStatus: ${result.value.launchStatus}`,
      `RecorderStatus: ${result.value.recorderStatus}`,
      `RunbookStatus: ${result.value.runbookStatus}`,
      `Recommendation: ${result.value.recommendation}`,
      '',
      'Ledger Stats:',
      `Total Entries: ${result.value.ledgerStats.totalEntries}`,
      `Authorized: ${result.value.ledgerStats.authorizedCount}`,
      `Rejected By Operator: ${result.value.ledgerStats.rejectedByOperatorCount}`,
      `Denied By HUD: ${result.value.ledgerStats.deniedByHudCount}`,
      `Latest Entry Count: ${result.value.latestEntryCount}`,
      '',
      'Next Operator Command:',
      result.value.nextOperatorCommand,
      '',
      'Governance:',
      'PaperOnly: true',
      'LiveMoneyAuthorization: false',
      'AutomaticExecutionAllowed: false',
      'AutomaticBetExecutionAllowed: false',
      'HumanSupervisionRequired: true',
    ];

    return {
      ok: true,
      value: Object.freeze({
        verdict: result.value.verdict,
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

  private resolveVerdict(status: {
    readonly readinessStatus: FirstPaperTradingReadinessStatus;
    readonly launchStatus: FirstPaperTradingSessionLaunchStatus;
    readonly recorderStatus: FirstSupervisedPaperTradingSessionRecordStatus;
    readonly runbookStatus: FirstPaperSessionOperatorRunbookStatus;
  }): FirstPaperSessionFinalPreflightVerdict {
    if (
      status.readinessStatus === 'BLOCKED' ||
      status.launchStatus === 'PAPER_SESSION_BLOCKED' ||
      status.recorderStatus === 'FIRST_PAPER_SESSION_NOT_RECORDED_BLOCKED' ||
      status.runbookStatus === 'RUNBOOK_BLOCKED'
    ) {
      return 'PAPER_OPERATIONAL_BLOCKED';
    }

    if (
      status.readinessStatus === 'NEEDS_REVIEW' ||
      status.launchStatus === 'PAPER_SESSION_NEEDS_REVIEW' ||
      status.recorderStatus === 'FIRST_PAPER_SESSION_RECORDED_WITH_REVIEW' ||
      status.runbookStatus === 'RUNBOOK_NEEDS_REVIEW'
    ) {
      return 'PAPER_OPERATIONAL_REVIEW';
    }

    return 'PAPER_OPERATIONAL_GO';
  }

  private recommendationFor(verdict: FirstPaperSessionFinalPreflightVerdict): string {
    if (verdict === 'PAPER_OPERATIONAL_GO') {
      return 'Operator may start the first supervised PAPER session using the runbook. Live money remains blocked.';
    }

    if (verdict === 'PAPER_OPERATIONAL_REVIEW') {
      return 'Operator must review warnings before starting the supervised PAPER session. Live money remains blocked.';
    }

    return 'Operator must not start the PAPER session until blocking issues are resolved. Live money remains blocked.';
  }

  private failure(message: string): FirstPaperSessionFinalPreflightFailure {
    return {
      ok: false,
      error: {
        code: 'FIRST_PAPER_SESSION_FINAL_PREFLIGHT_ORCHESTRATOR_ERROR',
        message,
      },
    };
  }
}
