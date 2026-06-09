import { createHash } from 'node:crypto';

import type {
  PaperEntryLedgerRepositoryPort,
} from '../ledger/PaperEntryLedgerRepositoryPort.js';
import {
  FirstPaperTradingSessionLaunchChecklist,
  type FirstPaperTradingSessionLaunchInput,
  type FirstPaperTradingSessionLaunchStatus,
} from './FirstPaperTradingSessionLaunchChecklist.js';

export type FirstSupervisedPaperTradingSessionRecordStatus =
  | 'FIRST_PAPER_SESSION_RECORDED'
  | 'FIRST_PAPER_SESSION_RECORDED_WITH_REVIEW'
  | 'FIRST_PAPER_SESSION_NOT_RECORDED_BLOCKED';

export interface FirstSupervisedPaperTradingSessionRecorderInput
  extends FirstPaperTradingSessionLaunchInput {
  readonly operatorId?: string;
  readonly tableId?: string;
  readonly strategyName?: string;
  readonly bankrollLabel?: string;
  readonly plannedRounds?: number;
  readonly notes?: readonly string[];
  readonly allowNeedsReviewRecording?: boolean;
}

export interface FirstSupervisedPaperTradingSessionRecord {
  readonly recordId: string;
  readonly sessionId: string;
  readonly generatedAtEpochMs: number;
  readonly status: FirstSupervisedPaperTradingSessionRecordStatus;
  readonly launchStatus: FirstPaperTradingSessionLaunchStatus;
  readonly operatorId: string;
  readonly tableId: string;
  readonly strategyName: string;
  readonly bankrollLabel: string;
  readonly plannedRounds: number;
  readonly notes: readonly string[];
  readonly recommendation: string;
  readonly launchChecklistChecksum: string;
  readonly checksum: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface FirstSupervisedPaperTradingSessionRecorderReport {
  readonly recorded: boolean;
  readonly record: FirstSupervisedPaperTradingSessionRecord;
  readonly launchStatus: FirstPaperTradingSessionLaunchStatus;
  readonly message: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface FirstSupervisedPaperTradingSessionRecorderTextReport {
  readonly recorded: boolean;
  readonly status: FirstSupervisedPaperTradingSessionRecordStatus;
  readonly generatedAtEpochMs: number;
  readonly text: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface FirstSupervisedPaperTradingSessionRecorderSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

export interface FirstSupervisedPaperTradingSessionRecorderFailure {
  readonly ok: false;
  readonly error: {
    readonly code: 'FIRST_SUPERVISED_PAPER_TRADING_SESSION_RECORDER_ERROR';
    readonly message: string;
  };
}

export type FirstSupervisedPaperTradingSessionRecorderResult<T> =
  | FirstSupervisedPaperTradingSessionRecorderSuccess<T>
  | FirstSupervisedPaperTradingSessionRecorderFailure;

/**
 * Builds the formal audit record for the first supervised PAPER trading session.
 *
 * This application service never executes a bet, never opens a platform and
 * never authorizes live money. Persistence is intentionally outside this class:
 * the CLI or any future adapter may append the returned record to an audit file.
 */
export class FirstSupervisedPaperTradingSessionRecorder {
  private readonly launchChecklist: FirstPaperTradingSessionLaunchChecklist;

  public constructor(repository: PaperEntryLedgerRepositoryPort) {
    this.launchChecklist = new FirstPaperTradingSessionLaunchChecklist(repository);
  }

  public async record(
    input: FirstSupervisedPaperTradingSessionRecorderInput,
    generatedAtEpochMs = Date.now(),
  ): Promise<FirstSupervisedPaperTradingSessionRecorderResult<FirstSupervisedPaperTradingSessionRecorderReport>> {
    const normalized = this.normalizeInput(input);
    if (!normalized.ok) {
      return normalized;
    }

    const launch = await this.launchChecklist.evaluate(input, generatedAtEpochMs);

    if (!launch.ok) {
      return this.failure(launch.error.message);
    }

    const launchChecksum = this.hash({
      sessionId: launch.value.sessionId,
      status: launch.value.status,
      readinessStatus: launch.value.readinessStatus,
      checks: launch.value.checks,
      generatedAtEpochMs: launch.value.generatedAtEpochMs,
    });

    const status = this.recordStatusFor(
      launch.value.status,
      normalized.value.allowNeedsReviewRecording,
    );

    const recorded = status !== 'FIRST_PAPER_SESSION_NOT_RECORDED_BLOCKED';

    const recordWithoutChecksum = {
      recordId: this.recordIdFor(normalized.value.sessionId, generatedAtEpochMs),
      sessionId: normalized.value.sessionId,
      generatedAtEpochMs,
      status,
      launchStatus: launch.value.status,
      operatorId: normalized.value.operatorId,
      tableId: normalized.value.tableId,
      strategyName: normalized.value.strategyName,
      bankrollLabel: normalized.value.bankrollLabel,
      plannedRounds: normalized.value.plannedRounds,
      notes: normalized.value.notes,
      recommendation: launch.value.recommendation,
      launchChecklistChecksum: launchChecksum,
      paperOnly: true as const,
      liveMoneyAuthorization: false as const,
      automaticExecutionAllowed: false as const,
      automaticBetExecutionAllowed: false as const,
      humanSupervisionRequired: true as const,
    };

    const record: FirstSupervisedPaperTradingSessionRecord = Object.freeze({
      ...recordWithoutChecksum,
      checksum: this.hash(recordWithoutChecksum),
    });

    return {
      ok: true,
      value: Object.freeze({
        recorded,
        record,
        launchStatus: launch.value.status,
        message: recorded
          ? 'First supervised PAPER trading session record is ready for append-only audit persistence.'
          : 'First supervised PAPER trading session was not recorded as launchable because checklist is blocked.',
        paperOnly: true as const,
        liveMoneyAuthorization: false as const,
        automaticExecutionAllowed: false as const,
        automaticBetExecutionAllowed: false as const,
        humanSupervisionRequired: true as const,
      }),
    };
  }

  public async textReport(
    input: FirstSupervisedPaperTradingSessionRecorderInput,
    generatedAtEpochMs = Date.now(),
  ): Promise<FirstSupervisedPaperTradingSessionRecorderResult<FirstSupervisedPaperTradingSessionRecorderTextReport>> {
    const result = await this.record(input, generatedAtEpochMs);

    if (!result.ok) {
      return result;
    }

    const lines = [
      'RL.SYS CORE — FIRST SUPERVISED PAPER TRADING SESSION RECORD',
      '============================================================',
      `Generated At EpochMs: ${result.value.record.generatedAtEpochMs}`,
      `Recorded: ${result.value.recorded}`,
      `RecordStatus: ${result.value.record.status}`,
      `LaunchStatus: ${result.value.record.launchStatus}`,
      `RecordId: ${result.value.record.recordId}`,
      `SessionId: ${result.value.record.sessionId}`,
      `OperatorId: ${result.value.record.operatorId}`,
      `TableId: ${result.value.record.tableId}`,
      `StrategyName: ${result.value.record.strategyName}`,
      `BankrollLabel: ${result.value.record.bankrollLabel}`,
      `PlannedRounds: ${result.value.record.plannedRounds}`,
      `Recommendation: ${result.value.record.recommendation}`,
      `Checksum: ${result.value.record.checksum}`,
      '',
      'Notes:',
    ];

    if (result.value.record.notes.length === 0) {
      lines.push(' - none');
    } else {
      for (const note of result.value.record.notes) {
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
        recorded: result.value.recorded,
        status: result.value.record.status,
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

  private normalizeInput(
    input: FirstSupervisedPaperTradingSessionRecorderInput,
  ): FirstSupervisedPaperTradingSessionRecorderResult<Required<FirstSupervisedPaperTradingSessionRecorderInput>> {
    const sessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() : '';

    if (sessionId.length === 0) {
      return this.failure('sessionId is required');
    }

    return {
      ok: true,
      value: Object.freeze({
        sessionId,
        operatorConfirmedLaunch: input.operatorConfirmedLaunch === true,
        runtimePaperAvailable: input.runtimePaperAvailable !== false,
        snapshotPathAvailable: input.snapshotPathAvailable !== false,
        ledgerPathConfigured: input.ledgerPathConfigured !== false,
        minimumRecommendedLedgerEntries: Number.isFinite(input.minimumRecommendedLedgerEntries)
          ? Number(input.minimumRecommendedLedgerEntries)
          : 0,
        maxDeniedByHudRatio: Number.isFinite(input.maxDeniedByHudRatio)
          ? Number(input.maxDeniedByHudRatio)
          : 0.8,
        maxRejectedByOperatorRatio: Number.isFinite(input.maxRejectedByOperatorRatio)
          ? Number(input.maxRejectedByOperatorRatio)
          : 0.8,
        operatorId: typeof input.operatorId === 'string' && input.operatorId.trim().length > 0
          ? input.operatorId.trim()
          : 'operator-manual',
        tableId: typeof input.tableId === 'string' && input.tableId.trim().length > 0
          ? input.tableId.trim()
          : 'table-manual',
        strategyName: typeof input.strategyName === 'string' && input.strategyName.trim().length > 0
          ? input.strategyName.trim()
          : 'Triplicação',
        bankrollLabel: typeof input.bankrollLabel === 'string' && input.bankrollLabel.trim().length > 0
          ? input.bankrollLabel.trim()
          : 'PAPER_BANKROLL',
        plannedRounds: Number.isFinite(input.plannedRounds)
          ? Math.max(1, Math.floor(Number(input.plannedRounds)))
          : 200,
        notes: Array.isArray(input.notes)
          ? Object.freeze(input.notes.filter((note): note is string => typeof note === 'string' && note.trim().length > 0))
          : Object.freeze([]),
        allowNeedsReviewRecording: input.allowNeedsReviewRecording === true,
      }),
    };
  }

  private recordStatusFor(
    launchStatus: FirstPaperTradingSessionLaunchStatus,
    allowNeedsReviewRecording: boolean,
  ): FirstSupervisedPaperTradingSessionRecordStatus {
    if (launchStatus === 'PAPER_SESSION_READY') {
      return 'FIRST_PAPER_SESSION_RECORDED';
    }

    if (launchStatus === 'PAPER_SESSION_NEEDS_REVIEW' && allowNeedsReviewRecording) {
      return 'FIRST_PAPER_SESSION_RECORDED_WITH_REVIEW';
    }

    return 'FIRST_PAPER_SESSION_NOT_RECORDED_BLOCKED';
  }

  private recordIdFor(sessionId: string, generatedAtEpochMs: number): string {
    return `first-paper-session-${this.hash({ sessionId, generatedAtEpochMs }).slice(0, 16)}`;
  }

  private hash(value: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(value))
      .digest('hex');
  }

  private failure(message: string): FirstSupervisedPaperTradingSessionRecorderFailure {
    return {
      ok: false,
      error: {
        code: 'FIRST_SUPERVISED_PAPER_TRADING_SESSION_RECORDER_ERROR',
        message,
      },
    };
  }
}
