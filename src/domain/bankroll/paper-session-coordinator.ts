import type { PaperBankrollAccountSnapshot } from './paper-bankroll-account-engine';
import type { PaperRiskGuardEvaluation } from './paper-risk-guard-aggregator';
import { PaperSettlementEngine } from './paper-settlement-engine';
import type {
  PaperSettlementOutcome,
  PaperSettlementRecord,
} from './paper-settlement-engine';
import type { PaperStakePolicyEvaluation } from './paper-stake-policy-engine';
import { PaperTradeLifecycleEngine } from './paper-trade-lifecycle-engine';
import type {
  PaperTradeEntryRecord,
  PaperTradeFinalRecord,
} from './paper-trade-lifecycle-engine';

export type PaperSessionCoordinatorDecision =
  | 'PAPER_ENTRY_OPENED'
  | 'PAPER_TRADE_SETTLED'
  | 'PAPER_REPLAYED_IDEMPOTENTLY'
  | 'AGUARDAR'
  | 'NAO_UTILIZAR';

export type PaperSessionCoordinatorReason =
  | 'PAPER_SESSION_ENTRY_COORDINATED'
  | 'PAPER_SESSION_ENTRY_REPLAYED_IDEMPOTENTLY'
  | 'PAPER_SESSION_TRADE_SETTLED'
  | 'PAPER_SESSION_SETTLEMENT_REPLAYED_IDEMPOTENTLY'
  | 'PAPER_RISK_GUARD_NOT_COMPATIBLE'
  | 'PAPER_LIFECYCLE_REJECTED'
  | 'PAPER_SETTLEMENT_REJECTED'
  | 'INVALID_PAPER_SESSION_COORDINATOR_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface PaperSessionOpenInput {
  readonly tradeId: string;
  readonly suggestionId: string;
  readonly strategyId: string;
  readonly account: PaperBankrollAccountSnapshot;
  readonly stake: PaperStakePolicyEvaluation;
  readonly riskGuard: PaperRiskGuardEvaluation;
  readonly openedAtEpochMs: number;
  readonly manualConfirmation: boolean;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface PaperSessionSettleInput {
  readonly entry: PaperTradeEntryRecord;
  readonly account: PaperBankrollAccountSnapshot;
  readonly stake: PaperStakePolicyEvaluation;
  readonly settlementId: string;
  readonly outcome: PaperSettlementOutcome;
  readonly settledAtEpochMs: number;
  readonly netPayoutMultiplier?: number;
  readonly previousSettlementRecord?: PaperSettlementRecord;
  readonly previousFinalRecord?: PaperTradeFinalRecord;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface PaperSessionCoordinatorEvaluation {
  readonly decision: PaperSessionCoordinatorDecision;
  readonly reason: PaperSessionCoordinatorReason;
  readonly account: PaperBankrollAccountSnapshot;
  readonly entry?: PaperTradeEntryRecord;
  readonly final?: PaperTradeFinalRecord;
  readonly settlement?: PaperSettlementRecord;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly explanation: string;
}

export type PaperSessionCoordinatorResult =
  | {
      readonly ok: true;
      readonly value: PaperSessionCoordinatorEvaluation;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: PaperSessionCoordinatorReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

/**
 * PaperSessionCoordinator
 *
 * Orquestrador de domínio que conecta os motores PAPER já existentes:
 * RiskGuard -> TradeLifecycle -> Settlement.
 *
 * Ele não executa apostas, não consulta infraestrutura, não grava arquivo e
 * não autoriza dinheiro real. O objetivo é produzir uma transição de sessão
 * PAPER auditável, idempotente e segura para dispositivos de baixa memória.
 *
 * Complexidade: O(1) em tempo e memória.
 */
export class PaperSessionCoordinator {
  private readonly lifecycleEngine: PaperTradeLifecycleEngine;
  private readonly settlementEngine: PaperSettlementEngine;

  public constructor(
    lifecycleEngine: PaperTradeLifecycleEngine = new PaperTradeLifecycleEngine(),
    settlementEngine: PaperSettlementEngine = new PaperSettlementEngine(),
  ) {
    this.lifecycleEngine = lifecycleEngine;
    this.settlementEngine = settlementEngine;
  }

  public openPaperEntry(
    input: PaperSessionOpenInput,
    previousEntry?: PaperTradeEntryRecord,
  ): PaperSessionCoordinatorResult {
    const invalidReason = this.validateOpenInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_PAPER_SESSION_COORDINATOR_INPUT', invalidReason);
    }

    if (this.hasLiveMoney(input.productionMoneyAllowed, input.liveMoneyAuthorization)) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper session coordinator cannot run with live money flags enabled.');
    }

    if (input.riskGuard.productionMoneyAllowed !== false || input.riskGuard.liveMoneyAuthorization !== false) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper risk guard must keep live money disabled.');
    }

    if (input.riskGuard.decision !== 'PAPER_COMPATIVEL') {
      return {
        ok: true,
        value: {
          decision: input.riskGuard.decision === 'AGUARDAR' ? 'AGUARDAR' : 'NAO_UTILIZAR',
          reason: 'PAPER_RISK_GUARD_NOT_COMPATIBLE',
          account: input.account,
          productionMoneyAllowed: false,
          liveMoneyAuthorization: false,
          explanation: 'Abertura PAPER bloqueada porque o Risk Guard não classificou o contexto como PAPER_COMPATIVEL.',
        },
      };
    }

    const lifecycleResult = this.lifecycleEngine.openTrade(
      {
        tradeId: input.tradeId,
        suggestionId: input.suggestionId,
        strategyId: input.strategyId,
        account: input.account,
        stake: input.stake,
        openedAtEpochMs: input.openedAtEpochMs,
        manualConfirmation: input.manualConfirmation,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      },
      previousEntry,
    );

    if (!lifecycleResult.ok) {
      return this.fail('PAPER_LIFECYCLE_REJECTED', lifecycleResult.error.message);
    }

    if (lifecycleResult.value.entry === undefined) {
      return this.fail('PAPER_LIFECYCLE_REJECTED', 'Lifecycle did not return an opened PAPER entry.');
    }

    return {
      ok: true,
      value: {
        decision:
          lifecycleResult.value.reason === 'PAPER_ENTRY_REPLAYED_IDEMPOTENTLY'
            ? 'PAPER_REPLAYED_IDEMPOTENTLY'
            : 'PAPER_ENTRY_OPENED',
        reason:
          lifecycleResult.value.reason === 'PAPER_ENTRY_REPLAYED_IDEMPOTENTLY'
            ? 'PAPER_SESSION_ENTRY_REPLAYED_IDEMPOTENTLY'
            : 'PAPER_SESSION_ENTRY_COORDINATED',
        account: input.account,
        entry: lifecycleResult.value.entry,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation: 'Sessão PAPER coordenou abertura manual com Risk Guard aprovado e live money bloqueado.',
      },
    };
  }

  public settlePaperTrade(input: PaperSessionSettleInput): PaperSessionCoordinatorResult {
    const invalidReason = this.validateSettleInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_PAPER_SESSION_COORDINATOR_INPUT', invalidReason);
    }

    if (this.hasLiveMoney(input.productionMoneyAllowed, input.liveMoneyAuthorization)) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper session settlement cannot run with live money flags enabled.');
    }

    const settlementResult = this.settlementEngine.settle(
      {
        settlementId: input.settlementId,
        account: input.account,
        stake: input.stake,
        outcome: input.outcome,
        settledAtEpochMs: input.settledAtEpochMs,
        netPayoutMultiplier: input.netPayoutMultiplier,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      },
      input.previousSettlementRecord,
    );

    if (!settlementResult.ok) {
      return this.fail('PAPER_SETTLEMENT_REJECTED', settlementResult.error.message);
    }

    const lifecycleResult = this.lifecycleEngine.settleTrade(
      {
        entry: input.entry,
        settlement: settlementResult.value,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      },
      input.previousFinalRecord,
    );

    if (!lifecycleResult.ok) {
      return this.fail('PAPER_LIFECYCLE_REJECTED', lifecycleResult.error.message);
    }

    if (lifecycleResult.value.final === undefined) {
      return this.fail('PAPER_LIFECYCLE_REJECTED', 'Lifecycle did not return a final PAPER trade record.');
    }

    return {
      ok: true,
      value: {
        decision:
          lifecycleResult.value.reason === 'PAPER_TRADE_SETTLEMENT_REPLAYED_IDEMPOTENTLY'
            ? 'PAPER_REPLAYED_IDEMPOTENTLY'
            : 'PAPER_TRADE_SETTLED',
        reason:
          lifecycleResult.value.reason === 'PAPER_TRADE_SETTLEMENT_REPLAYED_IDEMPOTENTLY'
            ? 'PAPER_SESSION_SETTLEMENT_REPLAYED_IDEMPOTENTLY'
            : 'PAPER_SESSION_TRADE_SETTLED',
        account: settlementResult.value.account,
        entry: input.entry,
        final: lifecycleResult.value.final,
        settlement: settlementResult.value.record,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation: 'Sessão PAPER coordenou settlement fictício e encerramento auditável do trade.',
      },
    };
  }

  private validateOpenInput(input: PaperSessionOpenInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'Input must be an object.';
    }

    if (typeof input.account !== 'object' || input.account === null) {
      return 'account must be provided.';
    }

    if (typeof input.stake !== 'object' || input.stake === null) {
      return 'stake must be provided.';
    }

    if (typeof input.riskGuard !== 'object' || input.riskGuard === null) {
      return 'riskGuard must be provided.';
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

    if (!Number.isInteger(input.openedAtEpochMs) || input.openedAtEpochMs <= 0) {
      return 'openedAtEpochMs must be a positive integer.';
    }

    if (typeof input.manualConfirmation !== 'boolean') {
      return 'manualConfirmation must be boolean.';
    }

    return null;
  }

  private validateSettleInput(input: PaperSessionSettleInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'Input must be an object.';
    }

    if (typeof input.entry !== 'object' || input.entry === null) {
      return 'entry must be provided.';
    }

    if (typeof input.account !== 'object' || input.account === null) {
      return 'account must be provided.';
    }

    if (typeof input.stake !== 'object' || input.stake === null) {
      return 'stake must be provided.';
    }

    if (!this.isSafeToken(input.settlementId, 3, 96)) {
      return 'settlementId must be a safe token with 3 to 96 characters.';
    }

    if (input.outcome !== 'WIN' && input.outcome !== 'LOSS' && input.outcome !== 'PUSH') {
      return 'outcome must be WIN, LOSS, or PUSH.';
    }

    if (!Number.isInteger(input.settledAtEpochMs) || input.settledAtEpochMs <= 0) {
      return 'settledAtEpochMs must be a positive integer.';
    }

    return null;
  }

  private isSafeToken(value: string, min: number, max: number): boolean {
    return typeof value === 'string' && value.length >= min && value.length <= max && /^[0-9A-Za-z._:-]+$/.test(value);
  }

  private hasLiveMoney(productionMoneyAllowed: boolean | undefined, liveMoneyAuthorization: boolean | undefined): boolean {
    return productionMoneyAllowed === true || liveMoneyAuthorization === true;
  }

  private fail(reason: PaperSessionCoordinatorReason, message: string): PaperSessionCoordinatorResult {
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
}
