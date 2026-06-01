import type { PaperBankrollAccountSnapshot } from './paper-bankroll-account-engine';
import type { PaperStakePolicyEvaluation } from './paper-stake-policy-engine';

export type PaperRiskGuardDecision = 'PAPER_COMPATIVEL' | 'AGUARDAR' | 'NAO_UTILIZAR';

export type PaperRiskGuardReason =
  | 'PAPER_RISK_GUARDS_APPROVED'
  | 'OPERATOR_NOT_READY'
  | 'PAPER_ACCOUNT_BLOCKED'
  | 'PAPER_STAKE_NOT_COMPATIBLE'
  | 'SESSION_EXPOSURE_LIMIT_REACHED'
  | 'DAILY_LOSS_LIMIT_REACHED'
  | 'DRAWDOWN_LIMIT_REACHED'
  | 'COOLDOWN_ACTIVE'
  | 'INVALID_PAPER_RISK_GUARD_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface PaperRiskGuardInput {
  readonly account: PaperBankrollAccountSnapshot;
  readonly stake: PaperStakePolicyEvaluation;
  readonly operatorReady: boolean;
  readonly cooldownActive: boolean;
  readonly currentSessionExposure: number;
  readonly maxSessionExposure: number;
  readonly currentDailyLoss: number;
  readonly maxDailyLoss: number;
  readonly currentDrawdown: number;
  readonly maxDrawdown: number;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface PaperRiskGuardEvaluation {
  readonly decision: PaperRiskGuardDecision;
  readonly reason: PaperRiskGuardReason;
  readonly approvedStake: number;
  readonly blockingFactors: readonly PaperRiskGuardReason[];
  readonly cautionFactors: readonly PaperRiskGuardReason[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly explanation: string;
}

export type PaperRiskGuardResult =
  | {
      readonly ok: true;
      readonly value: PaperRiskGuardEvaluation;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: PaperRiskGuardReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

const MONEY_PRECISION = 100;

/**
 * PaperRiskGuardAggregator
 *
 * Camada defensiva de domínio que consolida os sinais críticos antes de um
 * ciclo PAPER operacional. Ela não abre trade, não liquida resultado e não
 * executa aposta. Apenas classifica o contexto em PAPER_COMPATIVEL, AGUARDAR
 * ou NAO_UTILIZAR.
 *
 * Complexidade: O(1) em tempo e memória.
 */
export class PaperRiskGuardAggregator {
  public evaluate(input: PaperRiskGuardInput): PaperRiskGuardResult {
    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_PAPER_RISK_GUARD_INPUT', invalidReason);
    }

    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper risk guard cannot run with live money flags enabled.');
    }

    if (input.account.productionMoneyAllowed !== false || input.account.liveMoneyAuthorization !== false) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper account must keep live money disabled.');
    }

    if (input.stake.productionMoneyAllowed !== false || input.stake.liveMoneyAuthorization !== false) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper stake must keep live money disabled.');
    }

    const blockingFactors: PaperRiskGuardReason[] = [];
    const cautionFactors: PaperRiskGuardReason[] = [];

    if (input.account.status !== 'ACTIVE') {
      blockingFactors.push('PAPER_ACCOUNT_BLOCKED');
    }

    if (!input.operatorReady) {
      blockingFactors.push('OPERATOR_NOT_READY');
    }

    if (input.cooldownActive) {
      cautionFactors.push('COOLDOWN_ACTIVE');
    }

    if (input.stake.decision !== 'PAPER_COMPATIVEL' || input.stake.approvedStake <= 0) {
      blockingFactors.push('PAPER_STAKE_NOT_COMPATIBLE');
    }

    if (input.currentSessionExposure >= input.maxSessionExposure) {
      blockingFactors.push('SESSION_EXPOSURE_LIMIT_REACHED');
    }

    if (input.currentDailyLoss >= input.maxDailyLoss) {
      blockingFactors.push('DAILY_LOSS_LIMIT_REACHED');
    }

    if (input.currentDrawdown >= input.maxDrawdown) {
      blockingFactors.push('DRAWDOWN_LIMIT_REACHED');
    }

    if (blockingFactors.length > 0) {
      return this.success(
        'NAO_UTILIZAR',
        blockingFactors[0],
        0,
        blockingFactors,
        cautionFactors,
        'Contexto PAPER bloqueado por fator crítico de risco. Nenhuma abertura PAPER deve ser permitida.',
      );
    }

    if (cautionFactors.length > 0) {
      return this.success(
        'AGUARDAR',
        cautionFactors[0],
        0,
        blockingFactors,
        cautionFactors,
        'Contexto PAPER exige espera defensiva por cooldown ativo ou cautela operacional.',
      );
    }

    return this.success(
      'PAPER_COMPATIVEL',
      'PAPER_RISK_GUARDS_APPROVED',
      input.stake.approvedStake,
      blockingFactors,
      cautionFactors,
      'Contexto PAPER compatível: banca fictícia ativa, operador apto, stake válida e limites preservados.',
    );
  }

  private validateInput(input: PaperRiskGuardInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'Input must be an object.';
    }

    if (typeof input.account !== 'object' || input.account === null) {
      return 'account must be provided.';
    }

    if (typeof input.stake !== 'object' || input.stake === null) {
      return 'stake must be provided.';
    }

    if (typeof input.operatorReady !== 'boolean') {
      return 'operatorReady must be boolean.';
    }

    if (typeof input.cooldownActive !== 'boolean') {
      return 'cooldownActive must be boolean.';
    }

    if (!this.isNonNegativeFinite(input.currentSessionExposure)) {
      return 'currentSessionExposure must be a non-negative finite number.';
    }

    if (!this.isPositiveFinite(input.maxSessionExposure)) {
      return 'maxSessionExposure must be a positive finite number.';
    }

    if (!this.isNonNegativeFinite(input.currentDailyLoss)) {
      return 'currentDailyLoss must be a non-negative finite number.';
    }

    if (!this.isPositiveFinite(input.maxDailyLoss)) {
      return 'maxDailyLoss must be a positive finite number.';
    }

    if (!this.isNonNegativeFinite(input.currentDrawdown)) {
      return 'currentDrawdown must be a non-negative finite number.';
    }

    if (!this.isPositiveFinite(input.maxDrawdown)) {
      return 'maxDrawdown must be a positive finite number.';
    }

    if (!Number.isFinite(input.stake.approvedStake) || input.stake.approvedStake < 0) {
      return 'stake.approvedStake must be a non-negative finite number.';
    }

    return null;
  }

  private success(
    decision: PaperRiskGuardDecision,
    reason: PaperRiskGuardReason,
    approvedStake: number,
    blockingFactors: readonly PaperRiskGuardReason[],
    cautionFactors: readonly PaperRiskGuardReason[],
    explanation: string,
  ): PaperRiskGuardResult {
    return {
      ok: true,
      value: {
        decision,
        reason,
        approvedStake: this.roundMoney(Math.max(0, approvedStake)),
        blockingFactors: Object.freeze([...blockingFactors]),
        cautionFactors: Object.freeze([...cautionFactors]),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation,
      },
    };
  }

  private fail(reason: PaperRiskGuardReason, message: string): PaperRiskGuardResult {
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

  private isPositiveFinite(value: number): boolean {
    return Number.isFinite(value) && value > 0;
  }

  private isNonNegativeFinite(value: number): boolean {
    return Number.isFinite(value) && value >= 0;
  }

  private roundMoney(value: number): number {
    return Math.round(value * MONEY_PRECISION) / MONEY_PRECISION;
  }
}
