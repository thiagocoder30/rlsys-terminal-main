import type { PaperBankrollAccountSnapshot } from './paper-bankroll-account-engine';
import type { PaperStakePolicyEvaluation } from './paper-stake-policy-engine';
import type { PaperSettlementEvaluation, PaperSettlementOutcome } from './paper-settlement-engine';

export type PaperTradeLifecycleState =
  | 'PAPER_ENTRY_OPENED'
  | 'SETTLEMENT_PENDING'
  | 'SETTLED';

export type PaperTradeLifecycleReason =
  | 'PAPER_ENTRY_OPENED_WITH_MANUAL_CONFIRMATION'
  | 'PAPER_ENTRY_REPLAYED_IDEMPOTENTLY'
  | 'PAPER_TRADE_SETTLED'
  | 'PAPER_TRADE_SETTLEMENT_REPLAYED_IDEMPOTENTLY'
  | 'MANUAL_CONFIRMATION_REQUIRED'
  | 'PAPER_STAKE_NOT_COMPATIBLE'
  | 'PAPER_ACCOUNT_NOT_ACTIVE'
  | 'TRADE_ID_MISMATCH'
  | 'DUPLICATE_TRADE_ID_CONFLICT'
  | 'SETTLEMENT_ACCOUNT_MISMATCH'
  | 'SETTLEMENT_STAKE_MISMATCH'
  | 'INVALID_PAPER_TRADE_LIFECYCLE_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface PaperTradeOpenInput {
  readonly tradeId: string;
  readonly suggestionId: string;
  readonly strategyId: string;
  readonly account: PaperBankrollAccountSnapshot;
  readonly stake: PaperStakePolicyEvaluation;
  readonly openedAtEpochMs: number;
  readonly manualConfirmation: boolean;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface PaperTradeEntryRecord {
  readonly tradeId: string;
  readonly suggestionId: string;
  readonly strategyId: string;
  readonly accountId: string;
  readonly state: 'PAPER_ENTRY_OPENED';
  readonly stakeAmount: number;
  readonly openedAtEpochMs: number;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly version: 1;
}

export interface PaperTradeFinalRecord {
  readonly tradeId: string;
  readonly suggestionId: string;
  readonly strategyId: string;
  readonly accountId: string;
  readonly state: 'SETTLED';
  readonly outcome: PaperSettlementOutcome;
  readonly stakeAmount: number;
  readonly pnl: number;
  readonly balanceAfter: number;
  readonly openedAtEpochMs: number;
  readonly settledAtEpochMs: number;
  readonly settlementId: string;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly version: 1;
}

export interface PaperTradeSettlementInput {
  readonly entry: PaperTradeEntryRecord;
  readonly settlement: PaperSettlementEvaluation;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface PaperTradeLifecycleEvaluation {
  readonly state: PaperTradeLifecycleState;
  readonly reason: PaperTradeLifecycleReason;
  readonly entry?: PaperTradeEntryRecord;
  readonly final?: PaperTradeFinalRecord;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly explanation: string;
}

export type PaperTradeLifecycleResult =
  | {
      readonly ok: true;
      readonly value: PaperTradeLifecycleEvaluation;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: PaperTradeLifecycleReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

const MONEY_PRECISION = 100;

/**
 * PaperTradeLifecycleEngine
 *
 * Orquestrador de domínio para o ciclo operacional PAPER:
 * sugestão compatível -> confirmação manual -> entrada PAPER aberta ->
 * settlement -> trade encerrado.
 *
 * O motor não executa apostas, não autoriza dinheiro real e mantém todas as
 * transições idempotentes por tradeId.
 *
 * Complexidade: O(1) em tempo e memória.
 */
export class PaperTradeLifecycleEngine {
  public openTrade(
    input: PaperTradeOpenInput,
    previousEntry?: PaperTradeEntryRecord,
  ): PaperTradeLifecycleResult {
    const invalidReason = this.validateOpenInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_PAPER_TRADE_LIFECYCLE_INPUT', invalidReason);
    }

    if (this.hasLiveMoney(input.productionMoneyAllowed, input.liveMoneyAuthorization)) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper trade lifecycle cannot run with live money flags enabled.');
    }

    if (input.account.productionMoneyAllowed !== false || input.account.liveMoneyAuthorization !== false) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper account must keep live money disabled.');
    }

    if (input.stake.productionMoneyAllowed !== false || input.stake.liveMoneyAuthorization !== false) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper stake must keep live money disabled.');
    }

    if (input.account.status !== 'ACTIVE') {
      return this.fail('PAPER_ACCOUNT_NOT_ACTIVE', 'Paper account must be ACTIVE to open a paper trade.');
    }

    if (input.stake.decision !== 'PAPER_COMPATIVEL' || input.stake.approvedStake <= 0) {
      return this.fail('PAPER_STAKE_NOT_COMPATIBLE', 'Paper trade requires positive PAPER_COMPATIVEL stake.');
    }

    if (!input.manualConfirmation) {
      return this.fail('MANUAL_CONFIRMATION_REQUIRED', 'Manual operator confirmation is required to open PAPER entry.');
    }

    const entry = this.createEntry(input);

    if (previousEntry !== undefined) {
      return this.replayOpen(entry, previousEntry);
    }

    return {
      ok: true,
      value: {
        state: 'PAPER_ENTRY_OPENED',
        reason: 'PAPER_ENTRY_OPENED_WITH_MANUAL_CONFIRMATION',
        entry,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation:
          'Entrada PAPER aberta após sugestão compatível e confirmação manual. Nenhuma autorização de dinheiro real foi criada.',
      },
    };
  }

  public settleTrade(
    input: PaperTradeSettlementInput,
    previousFinal?: PaperTradeFinalRecord,
  ): PaperTradeLifecycleResult {
    const invalidReason = this.validateSettlementInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_PAPER_TRADE_LIFECYCLE_INPUT', invalidReason);
    }

    if (this.hasLiveMoney(input.productionMoneyAllowed, input.liveMoneyAuthorization)) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper trade settlement cannot run with live money flags enabled.');
    }

    if (input.settlement.record.productionMoneyAllowed !== false || input.settlement.record.liveMoneyAuthorization !== false) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper settlement record must keep live money disabled.');
    }

    if (input.entry.accountId !== input.settlement.record.accountId) {
      return this.fail('SETTLEMENT_ACCOUNT_MISMATCH', 'Settlement account must match the opened paper trade account.');
    }

    if (input.entry.stakeAmount !== input.settlement.record.stakeAmount) {
      return this.fail('SETTLEMENT_STAKE_MISMATCH', 'Settlement stake must match the opened paper trade stake.');
    }

    const finalRecord = this.createFinalRecord(input);

    if (previousFinal !== undefined) {
      return this.replaySettlement(finalRecord, previousFinal);
    }

    return {
      ok: true,
      value: {
        state: 'SETTLED',
        reason: 'PAPER_TRADE_SETTLED',
        final: finalRecord,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation:
          'Trade PAPER encerrado com settlement auditável. O ciclo permanece fictício e supervisionado.',
      },
    };
  }

  private replayOpen(
    expectedEntry: PaperTradeEntryRecord,
    previousEntry: PaperTradeEntryRecord,
  ): PaperTradeLifecycleResult {
    if (previousEntry.tradeId !== expectedEntry.tradeId) {
      return this.fail('TRADE_ID_MISMATCH', 'Previous paper trade id does not match requested trade id.');
    }

    const sameEntry =
      previousEntry.suggestionId === expectedEntry.suggestionId &&
      previousEntry.strategyId === expectedEntry.strategyId &&
      previousEntry.accountId === expectedEntry.accountId &&
      previousEntry.stakeAmount === expectedEntry.stakeAmount &&
      previousEntry.openedAtEpochMs === expectedEntry.openedAtEpochMs &&
      previousEntry.productionMoneyAllowed === false &&
      previousEntry.liveMoneyAuthorization === false;

    if (!sameEntry) {
      return this.fail(
        'DUPLICATE_TRADE_ID_CONFLICT',
        'Repeated paper trade opening must preserve immutable trade fields.',
      );
    }

    return {
      ok: true,
      value: {
        state: 'PAPER_ENTRY_OPENED',
        reason: 'PAPER_ENTRY_REPLAYED_IDEMPOTENTLY',
        entry: previousEntry,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation: 'Abertura PAPER repetida detectada como replay idempotente.',
      },
    };
  }

  private replaySettlement(
    expectedFinal: PaperTradeFinalRecord,
    previousFinal: PaperTradeFinalRecord,
  ): PaperTradeLifecycleResult {
    if (previousFinal.tradeId !== expectedFinal.tradeId) {
      return this.fail('TRADE_ID_MISMATCH', 'Previous final trade id does not match requested trade id.');
    }

    const sameFinal =
      previousFinal.suggestionId === expectedFinal.suggestionId &&
      previousFinal.strategyId === expectedFinal.strategyId &&
      previousFinal.accountId === expectedFinal.accountId &&
      previousFinal.outcome === expectedFinal.outcome &&
      previousFinal.stakeAmount === expectedFinal.stakeAmount &&
      previousFinal.pnl === expectedFinal.pnl &&
      previousFinal.balanceAfter === expectedFinal.balanceAfter &&
      previousFinal.openedAtEpochMs === expectedFinal.openedAtEpochMs &&
      previousFinal.settledAtEpochMs === expectedFinal.settledAtEpochMs &&
      previousFinal.settlementId === expectedFinal.settlementId &&
      previousFinal.productionMoneyAllowed === false &&
      previousFinal.liveMoneyAuthorization === false;

    if (!sameFinal) {
      return this.fail(
        'DUPLICATE_TRADE_ID_CONFLICT',
        'Repeated paper settlement must preserve immutable final trade fields.',
      );
    }

    return {
      ok: true,
      value: {
        state: 'SETTLED',
        reason: 'PAPER_TRADE_SETTLEMENT_REPLAYED_IDEMPOTENTLY',
        final: previousFinal,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation: 'Settlement PAPER repetido detectado como replay idempotente.',
      },
    };
  }

  private createEntry(input: PaperTradeOpenInput): PaperTradeEntryRecord {
    return Object.freeze({
      tradeId: input.tradeId,
      suggestionId: input.suggestionId,
      strategyId: input.strategyId,
      accountId: input.account.accountId,
      state: 'PAPER_ENTRY_OPENED',
      stakeAmount: this.roundMoney(input.stake.approvedStake),
      openedAtEpochMs: input.openedAtEpochMs,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
      version: 1,
    });
  }

  private createFinalRecord(input: PaperTradeSettlementInput): PaperTradeFinalRecord {
    return Object.freeze({
      tradeId: input.entry.tradeId,
      suggestionId: input.entry.suggestionId,
      strategyId: input.entry.strategyId,
      accountId: input.entry.accountId,
      state: 'SETTLED',
      outcome: input.settlement.record.outcome,
      stakeAmount: input.settlement.record.stakeAmount,
      pnl: input.settlement.record.pnl,
      balanceAfter: input.settlement.record.balanceAfter,
      openedAtEpochMs: input.entry.openedAtEpochMs,
      settledAtEpochMs: input.settlement.record.settledAtEpochMs,
      settlementId: input.settlement.record.settlementId,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
      version: 1,
    });
  }

  private validateOpenInput(input: PaperTradeOpenInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'Input must be an object.';
    }

    if (!this.isSafeToken(input.tradeId, 3, 96)) {
      return 'tradeId must be a safe token with 3 to 96 characters.';
    }

    if (!this.isSafeToken(input.suggestionId, 3, 96)) {
      return 'suggestionId must be a safe token with 3 to 96 characters.';
    }

    if (!this.isSafeToken(input.strategyId, 2, 96)) {
      return 'strategyId must be a safe token with 2 to 96 characters.';
    }

    if (typeof input.account !== 'object' || input.account === null) {
      return 'account must be provided.';
    }

    if (typeof input.stake !== 'object' || input.stake === null) {
      return 'stake must be provided.';
    }

    if (!Number.isInteger(input.openedAtEpochMs) || input.openedAtEpochMs <= 0) {
      return 'openedAtEpochMs must be a positive integer.';
    }

    if (typeof input.manualConfirmation !== 'boolean') {
      return 'manualConfirmation must be boolean.';
    }

    return null;
  }

  private validateSettlementInput(input: PaperTradeSettlementInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'Input must be an object.';
    }

    if (typeof input.entry !== 'object' || input.entry === null) {
      return 'entry must be provided.';
    }

    if (typeof input.settlement !== 'object' || input.settlement === null) {
      return 'settlement must be provided.';
    }

    if (input.entry.state !== 'PAPER_ENTRY_OPENED') {
      return 'entry must be PAPER_ENTRY_OPENED.';
    }

    if (typeof input.settlement.record !== 'object' || input.settlement.record === null) {
      return 'settlement.record must be provided.';
    }

    if (!this.isSafeToken(input.entry.tradeId, 3, 96)) {
      return 'entry.tradeId must be valid.';
    }

    return null;
  }

  private isSafeToken(value: string, min: number, max: number): boolean {
    return typeof value === 'string' && value.length >= min && value.length <= max && /^[0-9A-Za-z._:-]+$/.test(value);
  }

  private hasLiveMoney(productionMoneyAllowed: boolean | undefined, liveMoneyAuthorization: boolean | undefined): boolean {
    return productionMoneyAllowed === true || liveMoneyAuthorization === true;
  }

  private fail(reason: PaperTradeLifecycleReason, message: string): PaperTradeLifecycleResult {
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

  private roundMoney(value: number): number {
    return Math.round(value * MONEY_PRECISION) / MONEY_PRECISION;
  }
}
