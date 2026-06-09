import { createHash } from 'node:crypto';

import type {
  PaperEntryLedgerRepositoryPort,
} from '../ledger/PaperEntryLedgerRepositoryPort.js';
import {
  PaperTradingAcceptanceGate,
  type PaperTradingAcceptanceGateStatus,
} from './PaperTradingAcceptanceGate.js';
import type {
  FirstCompletePaperSessionCertificationInput,
} from './FirstCompletePaperSessionCertification.js';

export type PaperTradingRepeatSessionStarterStatus =
  | 'PAPER_REPEAT_READY'
  | 'PAPER_REPEAT_NEEDS_REVIEW'
  | 'PAPER_REPEAT_BLOCKED';

export interface PaperTradingRepeatSessionStarterInput extends FirstCompletePaperSessionCertificationInput {
  readonly repeatSessionId?: string;
  readonly repeatSessionLabel?: string;
  readonly realPlatformObserved?: boolean;
  readonly realMoneyBlocked?: boolean;
  readonly automaticExecutionBlocked?: boolean;
  readonly operatorReady?: boolean;
}

export interface PaperTradingRepeatSessionStartRecord {
  readonly repeatSessionId: string;
  readonly sourceSessionId: string;
  readonly repeatSessionLabel: string;
  readonly generatedAtEpochMs: number;
  readonly status: PaperTradingRepeatSessionStarterStatus;
  readonly acceptanceGateStatus: PaperTradingAcceptanceGateStatus;
  readonly operatorId: string;
  readonly tableId: string;
  readonly strategyName: string;
  readonly bankrollLabel: string;
  readonly plannedRounds: number;
  readonly realPlatformObserved: boolean;
  readonly realMoneyBlocked: true;
  readonly automaticExecutionBlocked: true;
  readonly operatorReady: boolean;
  readonly recommendation: string;
  readonly checksum: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface PaperTradingRepeatSessionStarterTextReport {
  readonly status: PaperTradingRepeatSessionStarterStatus;
  readonly generatedAtEpochMs: number;
  readonly text: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface PaperTradingRepeatSessionStarterSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

export interface PaperTradingRepeatSessionStarterFailure {
  readonly ok: false;
  readonly error: {
    readonly code: 'PAPER_TRADING_REPEAT_SESSION_STARTER_ERROR';
    readonly message: string;
  };
}

export type PaperTradingRepeatSessionStarterResult<T> =
  | PaperTradingRepeatSessionStarterSuccess<T>
  | PaperTradingRepeatSessionStarterFailure;

/**
 * Starter for repeat supervised PAPER sessions.
 *
 * This service starts an audit record for a new PAPER observation session on a
 * real platform/table without real-money authorization and without automatic
 * execution. The human operator remains responsible for every action.
 */
export class PaperTradingRepeatSessionStarter {
  private readonly acceptanceGate: PaperTradingAcceptanceGate;

  public constructor(repository: PaperEntryLedgerRepositoryPort) {
    this.acceptanceGate = new PaperTradingAcceptanceGate(repository);
  }

  public async start(
    input: PaperTradingRepeatSessionStarterInput,
    generatedAtEpochMs = Date.now(),
  ): Promise<PaperTradingRepeatSessionStarterResult<PaperTradingRepeatSessionStartRecord>> {
    const sourceSessionId = typeof input.sessionId === 'string' ? input.sessionId.trim() : '';

    if (sourceSessionId.length === 0) {
      return this.failure('sessionId is required');
    }

    const acceptance = await this.acceptanceGate.evaluate(input, generatedAtEpochMs);

    if (!acceptance.ok) {
      return this.failure(acceptance.error.message);
    }

    const realMoneyBlocked = input.realMoneyBlocked !== false;
    const automaticExecutionBlocked = input.automaticExecutionBlocked !== false;
    const operatorReady = input.operatorReady === true;
    const status = this.resolveStatus({
      acceptanceGateStatus: acceptance.value.status,
      realMoneyBlocked,
      automaticExecutionBlocked,
      operatorReady,
    });

    const repeatSessionId = this.resolveRepeatSessionId(input, sourceSessionId, generatedAtEpochMs);
    const withoutChecksum = {
      repeatSessionId,
      sourceSessionId,
      repeatSessionLabel: this.stringOrDefault(input.repeatSessionLabel, 'PAPER_TEST_001'),
      generatedAtEpochMs,
      status,
      acceptanceGateStatus: acceptance.value.status,
      operatorId: this.stringOrDefault(input.operatorId, 'operator-manual'),
      tableId: this.stringOrDefault(input.tableId, 'real-platform-observed-table'),
      strategyName: this.stringOrDefault(input.strategyName, 'Triplicação'),
      bankrollLabel: this.stringOrDefault(input.bankrollLabel, 'PAPER_BANKROLL'),
      plannedRounds: this.safePlannedRounds(input.plannedRounds),
      realPlatformObserved: input.realPlatformObserved !== false,
      realMoneyBlocked: true as const,
      automaticExecutionBlocked: true as const,
      operatorReady,
      recommendation: this.recommendationFor(status),
      paperOnly: true as const,
      liveMoneyAuthorization: false as const,
      automaticExecutionAllowed: false as const,
      automaticBetExecutionAllowed: false as const,
      humanSupervisionRequired: true as const,
    };

    return {
      ok: true,
      value: Object.freeze({
        ...withoutChecksum,
        checksum: this.hash(withoutChecksum),
      }),
    };
  }

  public async textReport(
    input: PaperTradingRepeatSessionStarterInput,
    generatedAtEpochMs = Date.now(),
  ): Promise<PaperTradingRepeatSessionStarterResult<PaperTradingRepeatSessionStarterTextReport>> {
    const started = await this.start(input, generatedAtEpochMs);

    if (!started.ok) {
      return started;
    }

    const lines = [
      'RL.SYS CORE — PAPER TRADING REPEAT SESSION STARTER',
      '===================================================',
      `Generated At EpochMs: ${started.value.generatedAtEpochMs}`,
      `Status: ${started.value.status}`,
      `RepeatSessionId: ${started.value.repeatSessionId}`,
      `SourceSessionId: ${started.value.sourceSessionId}`,
      `RepeatSessionLabel: ${started.value.repeatSessionLabel}`,
      `AcceptanceGateStatus: ${started.value.acceptanceGateStatus}`,
      `OperatorId: ${started.value.operatorId}`,
      `TableId: ${started.value.tableId}`,
      `StrategyName: ${started.value.strategyName}`,
      `BankrollLabel: ${started.value.bankrollLabel}`,
      `PlannedRounds: ${started.value.plannedRounds}`,
      `RealPlatformObserved: ${started.value.realPlatformObserved}`,
      `RealMoneyBlocked: ${started.value.realMoneyBlocked}`,
      `AutomaticExecutionBlocked: ${started.value.automaticExecutionBlocked}`,
      `OperatorReady: ${started.value.operatorReady}`,
      `Checksum: ${started.value.checksum}`,
      '',
      'Recommendation:',
      started.value.recommendation,
      '',
      'Governance:',
      'PaperOnly: true',
      'LiveMoneyAuthorization: false',
      'AutomaticExecutionAllowed: false',
      'AutomaticBetExecutionAllowed: false',
      'HumanSupervisionRequired: true',
      'CertifiesLiveMoney: false',
      'CertifiesProfit: false',
    ];

    return {
      ok: true,
      value: Object.freeze({
        status: started.value.status,
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
    readonly acceptanceGateStatus: PaperTradingAcceptanceGateStatus;
    readonly realMoneyBlocked: boolean;
    readonly automaticExecutionBlocked: boolean;
    readonly operatorReady: boolean;
  }): PaperTradingRepeatSessionStarterStatus {
    if (
      input.acceptanceGateStatus === 'PAPER_REJECTED' ||
      !input.realMoneyBlocked ||
      !input.automaticExecutionBlocked ||
      !input.operatorReady
    ) {
      return 'PAPER_REPEAT_BLOCKED';
    }

    if (input.acceptanceGateStatus === 'PAPER_NEEDS_REVIEW') {
      return 'PAPER_REPEAT_NEEDS_REVIEW';
    }

    return 'PAPER_REPEAT_READY';
  }

  private resolveRepeatSessionId(
    input: PaperTradingRepeatSessionStarterInput,
    sourceSessionId: string,
    generatedAtEpochMs: number,
  ): string {
    const provided = typeof input.repeatSessionId === 'string' ? input.repeatSessionId.trim() : '';

    if (provided.length > 0) {
      return provided;
    }

    return `paper-repeat-${this.hash({ sourceSessionId, generatedAtEpochMs }).slice(0, 16)}`;
  }

  private recommendationFor(status: PaperTradingRepeatSessionStarterStatus): string {
    if (status === 'PAPER_REPEAT_READY') {
      return 'Operator may start the supervised PAPER test on a real observed platform. No real money and no automatic execution are allowed.';
    }

    if (status === 'PAPER_REPEAT_NEEDS_REVIEW') {
      return 'Human review is required before starting this PAPER test. No real money and no automatic execution are allowed.';
    }

    return 'Do not start the PAPER test until acceptance, operator readiness and blocking controls are satisfied.';
  }

  private stringOrDefault(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
  }

  private safePlannedRounds(value: unknown): number {
    if (!Number.isFinite(value)) {
      return 200;
    }

    return Math.max(1, Math.floor(Number(value)));
  }

  private hash(value: unknown): string {
    return createHash('sha256')
      .update(JSON.stringify(value))
      .digest('hex');
  }

  private failure(message: string): PaperTradingRepeatSessionStarterFailure {
    return {
      ok: false,
      error: {
        code: 'PAPER_TRADING_REPEAT_SESSION_STARTER_ERROR',
        message,
      },
    };
  }
}
