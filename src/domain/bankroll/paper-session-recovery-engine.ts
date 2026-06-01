import type {
  PaperSessionSnapshot,
  PaperSessionSnapshotState,
} from './paper-session-snapshot-engine';

export type PaperSessionRecoveryState =
  | 'RECOVERED_PREPARED'
  | 'RECOVERED_ACTIVE'
  | 'RECOVERED_ENTRY_OPEN'
  | 'RECOVERED_SETTLED'
  | 'RECOVERED_FINISHED'
  | 'RECOVERED_BLOCKED';

export type PaperSessionRecoveryReason =
  | 'PAPER_SESSION_RECOVERED'
  | 'PAPER_SESSION_RECOVERY_REPLAYED_IDEMPOTENTLY'
  | 'PAPER_SESSION_RECOVERY_UPDATED'
  | 'CORRUPTED_PAPER_SNAPSHOT_REJECTED'
  | 'INVALID_PAPER_SESSION_RECOVERY_INPUT'
  | 'LIVE_MONEY_FORBIDDEN'
  | 'RECOVERY_ID_CONFLICT'
  | 'RECOVERY_TIMESTAMP_CONFLICT';

export interface PaperSessionRecoveryInput {
  readonly recoveryId: string;
  readonly snapshot: PaperSessionSnapshot;
  readonly recoveredAtEpochMs: number;
  readonly previousRecovery?: PaperSessionRecoveryRecord;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface PaperSessionRecoveryRecord {
  readonly recoveryId: string;
  readonly snapshotId: string;
  readonly sessionId: string;
  readonly state: PaperSessionRecoveryState;
  readonly sourceState: PaperSessionSnapshotState;
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
  readonly snapshotUpdatedAtEpochMs: number;
  readonly recoveredAtEpochMs: number;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly version: 1;
}

export interface PaperSessionRecoveryEvaluation {
  readonly reason: PaperSessionRecoveryReason;
  readonly recovery: PaperSessionRecoveryRecord;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly explanation: string;
}

export type PaperSessionRecoveryResult =
  | {
      readonly ok: true;
      readonly value: PaperSessionRecoveryEvaluation;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: PaperSessionRecoveryReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

const MONEY_PRECISION = 100;

/**
 * PaperSessionRecoveryEngine
 *
 * Recupera uma sessão PAPER a partir de snapshot de domínio validado.
 * Este motor não lê arquivos, não grava arquivos e não depende de infraestrutura.
 *
 * Regras:
 * - snapshots corrompidos são rejeitados;
 * - live money permanece bloqueado;
 * - recoveredAtEpochMs precisa ser monotônico;
 * - replay por recoveryId é idempotente quando o payload é idêntico.
 *
 * Complexidade: O(1) em tempo e memória.
 */
export class PaperSessionRecoveryEngine {
  public recover(input: PaperSessionRecoveryInput): PaperSessionRecoveryResult {
    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_PAPER_SESSION_RECOVERY_INPUT', invalidReason);
    }

    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper session recovery cannot run with live money flags enabled.');
    }

    const snapshotFailure = this.validateSnapshot(input.snapshot);

    if (snapshotFailure !== null) {
      return this.fail('CORRUPTED_PAPER_SNAPSHOT_REJECTED', snapshotFailure);
    }

    if (input.recoveredAtEpochMs < input.snapshot.updatedAtEpochMs) {
      return this.fail(
        'RECOVERY_TIMESTAMP_CONFLICT',
        'Recovery timestamp cannot be older than snapshot updatedAtEpochMs.',
      );
    }

    const recovery = this.createRecovery(input);

    if (input.previousRecovery !== undefined) {
      return this.compareWithPrevious(input.previousRecovery, recovery);
    }

    return this.success(
      'PAPER_SESSION_RECOVERED',
      recovery,
      'Sessão PAPER recuperada a partir de snapshot íntegro e live money bloqueado.',
    );
  }

  private compareWithPrevious(
    previousRecovery: PaperSessionRecoveryRecord,
    nextRecovery: PaperSessionRecoveryRecord,
  ): PaperSessionRecoveryResult {
    if (previousRecovery.recoveryId === nextRecovery.recoveryId) {
      if (!this.sameRecovery(previousRecovery, nextRecovery)) {
        return this.fail(
          'RECOVERY_ID_CONFLICT',
          'Repeated recoveryId must preserve immutable recovery payload.',
        );
      }

      return this.success(
        'PAPER_SESSION_RECOVERY_REPLAYED_IDEMPOTENTLY',
        previousRecovery,
        'Recuperação PAPER repetida detectada como replay idempotente.',
      );
    }

    if (previousRecovery.sessionId === nextRecovery.sessionId &&
      nextRecovery.recoveredAtEpochMs < previousRecovery.recoveredAtEpochMs) {
      return this.fail(
        'RECOVERY_TIMESTAMP_CONFLICT',
        'Next recovery timestamp cannot be older than previous recovery timestamp.',
      );
    }

    return this.success(
      'PAPER_SESSION_RECOVERY_UPDATED',
      nextRecovery,
      'Recuperação PAPER atualizada de forma monotônica para a mesma sessão.',
    );
  }

  private createRecovery(input: PaperSessionRecoveryInput): PaperSessionRecoveryRecord {
    const snapshot = input.snapshot;

    return Object.freeze({
      recoveryId: input.recoveryId,
      snapshotId: snapshot.snapshotId,
      sessionId: snapshot.sessionId,
      state: this.mapRecoveryState(snapshot.state),
      sourceState: snapshot.state,
      accountId: snapshot.accountId,
      currentBalance: this.roundMoney(snapshot.currentBalance),
      availableBalance: this.roundMoney(snapshot.availableBalance),
      realizedPnL: this.roundMoney(snapshot.realizedPnL),
      journalTotalEvents: snapshot.journalTotalEvents,
      journalLastSequence: snapshot.journalLastSequence,
      openTradeId: snapshot.openTradeId,
      lastTradeId: snapshot.lastTradeId,
      lastSettlementId: snapshot.lastSettlementId,
      lastOutcome: snapshot.lastOutcome,
      snapshotUpdatedAtEpochMs: snapshot.updatedAtEpochMs,
      recoveredAtEpochMs: input.recoveredAtEpochMs,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
      version: 1,
    });
  }

  private mapRecoveryState(state: PaperSessionSnapshotState): PaperSessionRecoveryState {
    if (state === 'PREPARED') {
      return 'RECOVERED_PREPARED';
    }

    if (state === 'ACTIVE') {
      return 'RECOVERED_ACTIVE';
    }

    if (state === 'ENTRY_OPEN') {
      return 'RECOVERED_ENTRY_OPEN';
    }

    if (state === 'SETTLED') {
      return 'RECOVERED_SETTLED';
    }

    if (state === 'FINISHED') {
      return 'RECOVERED_FINISHED';
    }

    return 'RECOVERED_BLOCKED';
  }

  private validateSnapshot(snapshot: PaperSessionSnapshot): string | null {
    if (typeof snapshot !== 'object' || snapshot === null) {
      return 'snapshot must be an object.';
    }

    if (!this.isSafeToken(snapshot.snapshotId, 3, 96)) {
      return 'snapshot.snapshotId is invalid.';
    }

    if (!this.isSafeToken(snapshot.sessionId, 3, 96)) {
      return 'snapshot.sessionId is invalid.';
    }

    if (!this.isSafeToken(snapshot.accountId, 3, 96)) {
      return 'snapshot.accountId is invalid.';
    }

    if (
      snapshot.state !== 'PREPARED' &&
      snapshot.state !== 'ACTIVE' &&
      snapshot.state !== 'ENTRY_OPEN' &&
      snapshot.state !== 'SETTLED' &&
      snapshot.state !== 'FINISHED' &&
      snapshot.state !== 'BLOCKED'
    ) {
      return 'snapshot.state is invalid.';
    }

    if (snapshot.productionMoneyAllowed !== false || snapshot.liveMoneyAuthorization !== false) {
      return 'snapshot live money invariants are violated.';
    }

    if (snapshot.version !== 1) {
      return 'snapshot.version must be 1.';
    }

    if (!this.isNonNegativeFinite(snapshot.currentBalance)) {
      return 'snapshot.currentBalance must be non-negative finite.';
    }

    if (!this.isNonNegativeFinite(snapshot.availableBalance)) {
      return 'snapshot.availableBalance must be non-negative finite.';
    }

    if (snapshot.availableBalance > snapshot.currentBalance) {
      return 'snapshot.availableBalance cannot exceed currentBalance.';
    }

    if (!Number.isFinite(snapshot.realizedPnL)) {
      return 'snapshot.realizedPnL must be finite.';
    }

    if (!Number.isInteger(snapshot.journalTotalEvents) || snapshot.journalTotalEvents < 0) {
      return 'snapshot.journalTotalEvents must be non-negative integer.';
    }

    if (!Number.isInteger(snapshot.journalLastSequence) || snapshot.journalLastSequence < 0) {
      return 'snapshot.journalLastSequence must be non-negative integer.';
    }

    if (snapshot.journalLastSequence > snapshot.journalTotalEvents) {
      return 'snapshot.journalLastSequence cannot exceed journalTotalEvents.';
    }

    if (!Number.isInteger(snapshot.updatedAtEpochMs) || snapshot.updatedAtEpochMs <= 0) {
      return 'snapshot.updatedAtEpochMs must be positive integer.';
    }

    if (snapshot.state === 'ENTRY_OPEN' && snapshot.openTradeId === undefined) {
      return 'ENTRY_OPEN snapshot requires openTradeId.';
    }

    if (snapshot.state === 'SETTLED' && (snapshot.lastSettlementId === undefined || snapshot.lastOutcome === undefined)) {
      return 'SETTLED snapshot requires lastSettlementId and lastOutcome.';
    }

    if (
      snapshot.lastOutcome !== undefined &&
      snapshot.lastOutcome !== 'WIN' &&
      snapshot.lastOutcome !== 'LOSS' &&
      snapshot.lastOutcome !== 'PUSH'
    ) {
      return 'snapshot.lastOutcome is invalid.';
    }

    return null;
  }

  private validateInput(input: PaperSessionRecoveryInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'Input must be an object.';
    }

    if (!this.isSafeToken(input.recoveryId, 3, 96)) {
      return 'recoveryId must be a safe token with 3 to 96 characters.';
    }

    if (typeof input.snapshot !== 'object' || input.snapshot === null) {
      return 'snapshot must be provided.';
    }

    if (!Number.isInteger(input.recoveredAtEpochMs) || input.recoveredAtEpochMs <= 0) {
      return 'recoveredAtEpochMs must be a positive integer.';
    }

    return null;
  }

  private sameRecovery(left: PaperSessionRecoveryRecord, right: PaperSessionRecoveryRecord): boolean {
    return (
      left.recoveryId === right.recoveryId &&
      left.snapshotId === right.snapshotId &&
      left.sessionId === right.sessionId &&
      left.state === right.state &&
      left.sourceState === right.sourceState &&
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
      left.snapshotUpdatedAtEpochMs === right.snapshotUpdatedAtEpochMs &&
      left.recoveredAtEpochMs === right.recoveredAtEpochMs &&
      left.productionMoneyAllowed === false &&
      left.liveMoneyAuthorization === false
    );
  }

  private success(
    reason: PaperSessionRecoveryReason,
    recovery: PaperSessionRecoveryRecord,
    explanation: string,
  ): PaperSessionRecoveryResult {
    return {
      ok: true,
      value: {
        reason,
        recovery,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation,
      },
    };
  }

  private fail(reason: PaperSessionRecoveryReason, message: string): PaperSessionRecoveryResult {
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

  private isNonNegativeFinite(value: number): boolean {
    return Number.isFinite(value) && value >= 0;
  }

  private roundMoney(value: number): number {
    return Math.round(value * MONEY_PRECISION) / MONEY_PRECISION;
  }
}
