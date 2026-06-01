import type { PaperBankrollAccountSnapshot } from './paper-bankroll-account-engine';
import type { PaperStakePolicyEvaluation } from './paper-stake-policy-engine';

export type PaperSettlementOutcome = 'WIN' | 'LOSS' | 'PUSH';
export type PaperSettlementDecision = 'SETTLED' | 'REPLAYED_IDEMPOTENTLY' | 'REJECTED';

export type PaperSettlementReason =
  | 'PAPER_WIN_SETTLED'
  | 'PAPER_LOSS_SETTLED'
  | 'PAPER_PUSH_SETTLED'
  | 'PAPER_SETTLEMENT_REPLAYED_IDEMPOTENTLY'
  | 'PAPER_STAKE_NOT_COMPATIBLE'
  | 'INSUFFICIENT_AVAILABLE_PAPER_BALANCE'
  | 'DUPLICATE_SETTLEMENT_ID_CONFLICT'
  | 'INVALID_PAPER_SETTLEMENT_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface PaperSettlementInput {
  readonly settlementId: string;
  readonly account: PaperBankrollAccountSnapshot;
  readonly stake: PaperStakePolicyEvaluation;
  readonly outcome: PaperSettlementOutcome;
  readonly settledAtEpochMs: number;
  readonly netPayoutMultiplier?: number;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface PaperSettlementRecord {
  readonly settlementId: string;
  readonly accountId: string;
  readonly outcome: PaperSettlementOutcome;
  readonly stakeAmount: number;
  readonly pnl: number;
  readonly balanceBefore: number;
  readonly balanceAfter: number;
  readonly settledAtEpochMs: number;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly version: 1;
}

export interface PaperSettlementEvaluation {
  readonly decision: PaperSettlementDecision;
  readonly reason: PaperSettlementReason;
  readonly record: PaperSettlementRecord;
  readonly account: PaperBankrollAccountSnapshot;
  readonly explanation: string;
}

export type PaperSettlementResult =
  | {
      readonly ok: true;
      readonly value: PaperSettlementEvaluation;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: PaperSettlementReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

const MONEY_PRECISION = 100;

/**
 * PaperSettlementEngine
 *
 * Liquida resultados fictícios do Paper Trading sem qualquer autorização de
 * dinheiro real. O motor é idempotente por settlementId: repetir a mesma
 * liquidação retorna o mesmo registro; tentar reutilizar o id com dados
 * divergentes é rejeitado.
 *
 * Complexidade: O(1) em tempo e memória.
 */
export class PaperSettlementEngine {
  public settle(input: PaperSettlementInput, previousRecord?: PaperSettlementRecord): PaperSettlementResult {
    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_PAPER_SETTLEMENT_INPUT', invalidReason);
    }

    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper settlement cannot run with live money flags enabled.');
    }

    if (input.account.productionMoneyAllowed !== false || input.account.liveMoneyAuthorization !== false) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper bankroll account must keep live money disabled.');
    }

    if (input.stake.productionMoneyAllowed !== false || input.stake.liveMoneyAuthorization !== false) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper stake policy must keep live money disabled.');
    }

    if (input.stake.decision !== 'PAPER_COMPATIVEL' || input.stake.approvedStake <= 0) {
      return this.fail('PAPER_STAKE_NOT_COMPATIBLE', 'Settlement requires a positive PAPER_COMPATIVEL stake.');
    }

    if (input.outcome === 'LOSS' && input.account.availableBalance < input.stake.approvedStake) {
      return this.fail(
        'INSUFFICIENT_AVAILABLE_PAPER_BALANCE',
        'Available PAPER balance is insufficient to settle the loss.',
      );
    }

    const record = this.createRecord(input);

    if (previousRecord !== undefined) {
      return this.replaySettlement(input, record, previousRecord);
    }

    return this.success(
      this.reasonForOutcome(input.outcome),
      record,
      input,
      'Resultado PAPER liquidado e refletido na banca fictícia auditável.',
    );
  }

  private replaySettlement(
    input: PaperSettlementInput,
    expectedRecord: PaperSettlementRecord,
    previousRecord: PaperSettlementRecord,
  ): PaperSettlementResult {
    if (previousRecord.settlementId !== input.settlementId) {
      return this.fail(
        'DUPLICATE_SETTLEMENT_ID_CONFLICT',
        'Previous settlement id does not match the requested settlement id.',
      );
    }

    const isSameRecord =
      previousRecord.accountId === expectedRecord.accountId &&
      previousRecord.outcome === expectedRecord.outcome &&
      previousRecord.stakeAmount === expectedRecord.stakeAmount &&
      previousRecord.pnl === expectedRecord.pnl &&
      previousRecord.balanceBefore === expectedRecord.balanceBefore &&
      previousRecord.balanceAfter === expectedRecord.balanceAfter &&
      previousRecord.settledAtEpochMs === expectedRecord.settledAtEpochMs &&
      previousRecord.productionMoneyAllowed === false &&
      previousRecord.liveMoneyAuthorization === false;

    if (!isSameRecord) {
      return this.fail(
        'DUPLICATE_SETTLEMENT_ID_CONFLICT',
        'Repeated settlement must preserve all immutable settlement fields.',
      );
    }

    return this.success(
      'PAPER_SETTLEMENT_REPLAYED_IDEMPOTENTLY',
      previousRecord,
      input,
      'Liquidação repetida detectada como replay idempotente; nenhum saldo adicional foi aplicado.',
    );
  }

  private createRecord(input: PaperSettlementInput): PaperSettlementRecord {
    const stakeAmount = this.roundMoney(input.stake.approvedStake);
    const pnl = this.calculatePnl(input.outcome, stakeAmount, input.netPayoutMultiplier ?? 1);
    const balanceBefore = this.roundMoney(input.account.currentBalance);
    const balanceAfter = this.roundMoney(balanceBefore + pnl);

    return Object.freeze({
      settlementId: input.settlementId,
      accountId: input.account.accountId,
      outcome: input.outcome,
      stakeAmount,
      pnl,
      balanceBefore,
      balanceAfter,
      settledAtEpochMs: input.settledAtEpochMs,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
      version: 1,
    });
  }

  private success(
    reason: PaperSettlementReason,
    record: PaperSettlementRecord,
    input: PaperSettlementInput,
    explanation: string,
  ): PaperSettlementResult {
    const account = this.applyRecordToAccount(input.account, record);

    return {
      ok: true,
      value: {
        decision: reason === 'PAPER_SETTLEMENT_REPLAYED_IDEMPOTENTLY' ? 'REPLAYED_IDEMPOTENTLY' : 'SETTLED',
        reason,
        record,
        account,
        explanation,
      },
    };
  }

  private applyRecordToAccount(
    account: PaperBankrollAccountSnapshot,
    record: PaperSettlementRecord,
  ): PaperBankrollAccountSnapshot {
    const currentBalance = this.roundMoney(record.balanceAfter);
    const reservedBalance = this.roundMoney(Math.min(account.reservedBalance, Math.max(0, currentBalance)));
    const availableBalance = this.roundMoney(Math.max(0, currentBalance - reservedBalance));

    return Object.freeze({
      ...account,
      currentBalance,
      reservedBalance,
      availableBalance,
      realizedPnL: this.roundMoney(account.realizedPnL + record.pnl),
      status: currentBalance > 0 ? 'ACTIVE' : 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
      updatedAtEpochMs: record.settledAtEpochMs,
      version: 1,
    });
  }

  private calculatePnl(outcome: PaperSettlementOutcome, stakeAmount: number, netPayoutMultiplier: number): number {
    if (outcome === 'WIN') {
      return this.roundMoney(stakeAmount * netPayoutMultiplier);
    }

    if (outcome === 'LOSS') {
      return this.roundMoney(-stakeAmount);
    }

    return 0;
  }

  private reasonForOutcome(outcome: PaperSettlementOutcome): PaperSettlementReason {
    if (outcome === 'WIN') {
      return 'PAPER_WIN_SETTLED';
    }

    if (outcome === 'LOSS') {
      return 'PAPER_LOSS_SETTLED';
    }

    return 'PAPER_PUSH_SETTLED';
  }

  private validateInput(input: PaperSettlementInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'Input must be an object.';
    }

    if (!/^[0-9A-Za-z._:-]{3,96}$/.test(input.settlementId)) {
      return 'settlementId must be a safe token with 3 to 96 characters.';
    }

    if (typeof input.account !== 'object' || input.account === null) {
      return 'account must be provided.';
    }

    if (typeof input.stake !== 'object' || input.stake === null) {
      return 'stake must be provided.';
    }

    if (input.outcome !== 'WIN' && input.outcome !== 'LOSS' && input.outcome !== 'PUSH') {
      return 'outcome must be WIN, LOSS, or PUSH.';
    }

    if (!Number.isInteger(input.settledAtEpochMs) || input.settledAtEpochMs <= 0) {
      return 'settledAtEpochMs must be a positive integer.';
    }

    if (!Number.isFinite(input.account.currentBalance) || input.account.currentBalance < 0) {
      return 'account.currentBalance must be a non-negative finite number.';
    }

    if (!Number.isFinite(input.account.availableBalance) || input.account.availableBalance < 0) {
      return 'account.availableBalance must be a non-negative finite number.';
    }

    if (!Number.isFinite(input.stake.approvedStake) || input.stake.approvedStake < 0) {
      return 'stake.approvedStake must be a non-negative finite number.';
    }

    if (
      input.netPayoutMultiplier !== undefined &&
      (!Number.isFinite(input.netPayoutMultiplier) || input.netPayoutMultiplier < 0)
    ) {
      return 'netPayoutMultiplier must be a non-negative finite number when provided.';
    }

    return null;
  }

  private fail(reason: PaperSettlementReason, message: string): PaperSettlementResult {
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
