import type { PaperBankrollAccountSnapshot } from './paper-bankroll-account-engine';
import type { PaperSessionJournalSnapshot } from './paper-session-journal-engine';
import type { PaperSettlementRecord } from './paper-settlement-engine';
import type {
  PaperTradeEntryRecord,
  PaperTradeFinalRecord,
} from './paper-trade-lifecycle-engine';

export type PaperSessionSnapshotState =
  | 'PREPARED'
  | 'ACTIVE'
  | 'ENTRY_OPEN'
  | 'SETTLED'
  | 'FINISHED'
  | 'BLOCKED';

export type PaperSessionSnapshotReason =
  | 'PAPER_SESSION_SNAPSHOT_CREATED'
  | 'PAPER_SESSION_SNAPSHOT_REPLAYED_IDEMPOTENTLY'
  | 'PAPER_SESSION_SNAPSHOT_UPDATED'
  | 'PAPER_SESSION_SNAPSHOT_BLOCKED'
  | 'INVALID_PAPER_SESSION_SNAPSHOT_INPUT'
  | 'LIVE_MONEY_FORBIDDEN'
  | 'SNAPSHOT_SESSION_MISMATCH'
  | 'SNAPSHOT_VERSION_CONFLICT';

export interface PaperSessionSnapshotInput {
  readonly snapshotId: string;
  readonly sessionId: string;
  readonly state: PaperSessionSnapshotState;
  readonly account: PaperBankrollAccountSnapshot;
  readonly journal: PaperSessionJournalSnapshot;
  readonly updatedAtEpochMs: number;
  readonly lastEntry?: PaperTradeEntryRecord;
  readonly lastFinal?: PaperTradeFinalRecord;
  readonly lastSettlement?: PaperSettlementRecord;
  readonly previousSnapshot?: PaperSessionSnapshot;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface PaperSessionSnapshot {
  readonly snapshotId: string;
  readonly sessionId: string;
  readonly state: PaperSessionSnapshotState;
  readonly accountId: string;
  readonly currentBalance: number;
  readonly availableBalance: number;
  readonly realizedPnL: number;
  readonly journalTotalEvents: number;
  readonly journalLastSequence: number;
  readonly openTradeId?: string;
  readonly lastTradeId?: string;
  readonly lastSettlementId?: string;
  readonly lastOutcome?: 'WIN' | 'LOSS' | 'PUSH';
  readonly updatedAtEpochMs: number;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly version: 1;
}

export interface PaperSessionSnapshotEvaluation {
  readonly reason: PaperSessionSnapshotReason;
  readonly snapshot: PaperSessionSnapshot;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly explanation: string;
}

export type PaperSessionSnapshotResult =
  | {
      readonly ok: true;
      readonly value: PaperSessionSnapshotEvaluation;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: PaperSessionSnapshotReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

const MONEY_PRECISION = 100;

/**
 * PaperSessionSnapshotEngine
 *
 * Snapshot leve e recuperável de uma sessão PAPER. Este domínio não persiste
 * arquivo; apenas compõe um objeto imutável para futura camada de infraestrutura.
 *
 * Invariantes:
 * - live money sempre bloqueado;
 * - sessionId do journal precisa bater com sessionId do snapshot;
 * - atualização monotônica por updatedAtEpochMs;
 * - replay idempotente quando o snapshot resultante é idêntico.
 *
 * Complexidade: O(1), pois usa contadores bounded do journal e últimas entidades.
 */
export class PaperSessionSnapshotEngine {
  public compose(input: PaperSessionSnapshotInput): PaperSessionSnapshotResult {
    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_PAPER_SESSION_SNAPSHOT_INPUT', invalidReason);
    }

    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper session snapshot cannot run with live money flags enabled.');
    }

    const invariantFailure = this.validatePaperInvariants(input);

    if (invariantFailure !== null) {
      return invariantFailure;
    }

    const snapshot = this.createSnapshot(input);

    if (input.previousSnapshot !== undefined) {
      return this.compareWithPrevious(input.previousSnapshot, snapshot);
    }

    return this.success(
      input.state === 'BLOCKED' ? 'PAPER_SESSION_SNAPSHOT_BLOCKED' : 'PAPER_SESSION_SNAPSHOT_CREATED',
      snapshot,
      input.state === 'BLOCKED'
        ? 'Snapshot PAPER criado em estado bloqueado defensivo.'
        : 'Snapshot PAPER criado com banca fictícia, journal bounded e live money bloqueado.',
    );
  }

  private compareWithPrevious(
    previousSnapshot: PaperSessionSnapshot,
    nextSnapshot: PaperSessionSnapshot,
  ): PaperSessionSnapshotResult {
    if (previousSnapshot.sessionId !== nextSnapshot.sessionId) {
      return this.fail('SNAPSHOT_SESSION_MISMATCH', 'Previous snapshot sessionId does not match next snapshot sessionId.');
    }

    if (previousSnapshot.snapshotId === nextSnapshot.snapshotId) {
      if (!this.sameSnapshot(previousSnapshot, nextSnapshot)) {
        return this.fail(
          'SNAPSHOT_VERSION_CONFLICT',
          'Repeated snapshotId must preserve immutable snapshot payload.',
        );
      }

      return this.success(
        'PAPER_SESSION_SNAPSHOT_REPLAYED_IDEMPOTENTLY',
        previousSnapshot,
        'Snapshot PAPER repetido detectado como replay idempotente.',
      );
    }

    if (nextSnapshot.updatedAtEpochMs < previousSnapshot.updatedAtEpochMs) {
      return this.fail(
        'SNAPSHOT_VERSION_CONFLICT',
        'Next snapshot timestamp cannot be older than previous snapshot timestamp.',
      );
    }

    return this.success(
      nextSnapshot.state === 'BLOCKED' ? 'PAPER_SESSION_SNAPSHOT_BLOCKED' : 'PAPER_SESSION_SNAPSHOT_UPDATED',
      nextSnapshot,
      'Snapshot PAPER atualizado de forma monotônica e auditável.',
    );
  }

  private createSnapshot(input: PaperSessionSnapshotInput): PaperSessionSnapshot {
    const openTradeId = input.lastEntry !== undefined && input.lastFinal === undefined
      ? input.lastEntry.tradeId
      : undefined;

    return Object.freeze({
      snapshotId: input.snapshotId,
      sessionId: input.sessionId,
      state: input.state,
      accountId: input.account.accountId,
      currentBalance: this.roundMoney(input.account.currentBalance),
      availableBalance: this.roundMoney(input.account.availableBalance),
      realizedPnL: this.roundMoney(input.account.realizedPnL),
      journalTotalEvents: input.journal.totalEvents,
      journalLastSequence: input.journal.lastSequence,
      openTradeId,
      lastTradeId: input.lastFinal?.tradeId ?? input.lastEntry?.tradeId,
      lastSettlementId: input.lastSettlement?.settlementId,
      lastOutcome: input.lastSettlement?.outcome,
      updatedAtEpochMs: input.updatedAtEpochMs,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
      version: 1,
    });
  }

  private validatePaperInvariants(input: PaperSessionSnapshotInput): PaperSessionSnapshotResult | null {
    if (input.account.productionMoneyAllowed !== false || input.account.liveMoneyAuthorization !== false) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper account must keep live money disabled.');
    }

    if (input.journal.productionMoneyAllowed !== false || input.journal.liveMoneyAuthorization !== false) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper journal must keep live money disabled.');
    }

    if (input.journal.sessionId !== input.sessionId) {
      return this.fail('SNAPSHOT_SESSION_MISMATCH', 'Journal sessionId must match snapshot sessionId.');
    }

    if (input.lastEntry !== undefined) {
      if (input.lastEntry.productionMoneyAllowed !== false || input.lastEntry.liveMoneyAuthorization !== false) {
        return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper entry must keep live money disabled.');
      }

      if (input.lastEntry.accountId !== input.account.accountId) {
        return this.fail('SNAPSHOT_SESSION_MISMATCH', 'Paper entry accountId must match snapshot accountId.');
      }
    }

    if (input.lastFinal !== undefined) {
      if (input.lastFinal.productionMoneyAllowed !== false || input.lastFinal.liveMoneyAuthorization !== false) {
        return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper final trade must keep live money disabled.');
      }

      if (input.lastFinal.accountId !== input.account.accountId) {
        return this.fail('SNAPSHOT_SESSION_MISMATCH', 'Paper final accountId must match snapshot accountId.');
      }
    }

    if (input.lastSettlement !== undefined) {
      if (input.lastSettlement.productionMoneyAllowed !== false || input.lastSettlement.liveMoneyAuthorization !== false) {
        return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper settlement must keep live money disabled.');
      }

      if (input.lastSettlement.accountId !== input.account.accountId) {
        return this.fail('SNAPSHOT_SESSION_MISMATCH', 'Paper settlement accountId must match snapshot accountId.');
      }
    }

    return null;
  }

  private validateInput(input: PaperSessionSnapshotInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'Input must be an object.';
    }

    if (!this.isSafeToken(input.snapshotId, 3, 96)) {
      return 'snapshotId must be a safe token with 3 to 96 characters.';
    }

    if (!this.isSafeToken(input.sessionId, 3, 96)) {
      return 'sessionId must be a safe token with 3 to 96 characters.';
    }

    if (
      input.state !== 'PREPARED' &&
      input.state !== 'ACTIVE' &&
      input.state !== 'ENTRY_OPEN' &&
      input.state !== 'SETTLED' &&
      input.state !== 'FINISHED' &&
      input.state !== 'BLOCKED'
    ) {
      return 'state must be a valid paper session snapshot state.';
    }

    if (typeof input.account !== 'object' || input.account === null) {
      return 'account must be provided.';
    }

    if (typeof input.journal !== 'object' || input.journal === null) {
      return 'journal must be provided.';
    }

    if (!Number.isInteger(input.updatedAtEpochMs) || input.updatedAtEpochMs <= 0) {
      return 'updatedAtEpochMs must be a positive integer.';
    }

    if (!Number.isFinite(input.account.currentBalance) || input.account.currentBalance < 0) {
      return 'account.currentBalance must be a non-negative finite number.';
    }

    if (!Number.isFinite(input.account.availableBalance) || input.account.availableBalance < 0) {
      return 'account.availableBalance must be a non-negative finite number.';
    }

    if (!Number.isInteger(input.journal.totalEvents) || input.journal.totalEvents < 0) {
      return 'journal.totalEvents must be a non-negative integer.';
    }

    if (!Number.isInteger(input.journal.lastSequence) || input.journal.lastSequence < 0) {
      return 'journal.lastSequence must be a non-negative integer.';
    }

    return null;
  }

  private sameSnapshot(left: PaperSessionSnapshot, right: PaperSessionSnapshot): boolean {
    return (
      left.snapshotId === right.snapshotId &&
      left.sessionId === right.sessionId &&
      left.state === right.state &&
      left.accountId === right.accountId &&
      left.currentBalance === right.currentBalance &&
      left.availableBalance === right.availableBalance &&
      left.realizedPnL === right.realizedPnL &&
      left.journalTotalEvents === right.journalTotalEvents &&
      left.journalLastSequence === right.journalLastSequence &&
      left.openTradeId === right.openTradeId &&
      left.lastTradeId === right.lastTradeId &&
      left.lastSettlementId === right.lastSettlementId &&
      left.lastOutcome === right.lastOutcome &&
      left.updatedAtEpochMs === right.updatedAtEpochMs &&
      left.productionMoneyAllowed === false &&
      left.liveMoneyAuthorization === false
    );
  }

  private success(
    reason: PaperSessionSnapshotReason,
    snapshot: PaperSessionSnapshot,
    explanation: string,
  ): PaperSessionSnapshotResult {
    return {
      ok: true,
      value: {
        reason,
        snapshot,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation,
      },
    };
  }

  private fail(reason: PaperSessionSnapshotReason, message: string): PaperSessionSnapshotResult {
    return {
      ok: false,
      error: {
        reason,
        message,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      },
    };
  }

  private isSafeToken(value: string, min: number, max: number): boolean {
    return typeof value === 'string' && value.length >= min && value.length <= max && /^[0-9A-Za-z._:-]+$/.test(value);
  }

  private roundMoney(value: number): number {
    return Math.round(value * MONEY_PRECISION) / MONEY_PRECISION;
  }
}
