import type { PaperBankrollAccountSnapshot } from './paper-bankroll-account-engine';

export type PaperStakePolicyDecision = 'PAPER_COMPATIVEL' | 'AGUARDAR' | 'NAO_UTILIZAR';

export type PaperStakePolicyReason =
  | 'PAPER_STAKE_APPROVED_BY_INSTITUTIONAL_POLICY'
  | 'USER_STAKE_REDUCED_BELOW_DEFAULT'
  | 'USER_STAKE_CAPPED_BY_INSTITUTIONAL_LIMIT'
  | 'INSUFFICIENT_AVAILABLE_PAPER_BALANCE'
  | 'PAPER_BANKROLL_ACCOUNT_BLOCKED'
  | 'INVALID_PAPER_STAKE_POLICY_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface PaperStakePolicyConfig {
  readonly minStake: number;
  readonly defaultStake: number;
  readonly maxStake: number;
  readonly maxStakePercentOfAvailableBalance: number;
  readonly maxSessionExposure: number;
}

export interface PaperStakePolicyInput {
  readonly account: PaperBankrollAccountSnapshot;
  readonly policy: PaperStakePolicyConfig;
  readonly requestedStake?: number;
  readonly currentSessionExposure: number;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface PaperStakePolicyEvaluation {
  readonly decision: PaperStakePolicyDecision;
  readonly reason: PaperStakePolicyReason;
  readonly approvedStake: number;
  readonly requestedStake: number;
  readonly institutionalMaximumStake: number;
  readonly remainingSessionExposure: number;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly explanation: string;
}

export type PaperStakePolicyResult =
  | {
      readonly ok: true;
      readonly value: PaperStakePolicyEvaluation;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: PaperStakePolicyReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

const MONEY_PRECISION = 100;

/**
 * PaperStakePolicyEngine
 *
 * Motor de domínio responsável por calcular a stake fictícia autorizável
 * para Paper Trading. O usuário pode reduzir a exposição, mas nunca ampliar
 * acima do teto institucional calculado pelo sistema.
 *
 * Complexidade: O(1) em tempo e memória.
 */
export class PaperStakePolicyEngine {
  public evaluate(input: PaperStakePolicyInput): PaperStakePolicyResult {
    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_PAPER_STAKE_POLICY_INPUT', invalidReason);
    }

    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper stake policy cannot run with live money flags enabled.');
    }

    if (input.account.productionMoneyAllowed !== false || input.account.liveMoneyAuthorization !== false) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper bankroll account invariants must keep live money disabled.');
    }

    if (input.account.status !== 'ACTIVE') {
      return this.approvedEvaluation(
        'NAO_UTILIZAR',
        'PAPER_BANKROLL_ACCOUNT_BLOCKED',
        0,
        this.resolveRequestedStake(input),
        0,
        0,
        'Conta PAPER bloqueada. Nenhuma stake fictícia pode ser autorizada.',
      );
    }

    const requestedStake = this.resolveRequestedStake(input);
    const institutionalMaximumStake = this.calculateInstitutionalMaximumStake(input);
    const remainingSessionExposure = this.roundMoney(input.policy.maxSessionExposure - input.currentSessionExposure);
    const effectiveMaximum = this.roundMoney(Math.min(institutionalMaximumStake, remainingSessionExposure));

    if (effectiveMaximum < input.policy.minStake || input.account.availableBalance < input.policy.minStake) {
      return this.approvedEvaluation(
        'AGUARDAR',
        'INSUFFICIENT_AVAILABLE_PAPER_BALANCE',
        0,
        requestedStake,
        institutionalMaximumStake,
        Math.max(0, remainingSessionExposure),
        'Saldo PAPER disponível ou exposição restante insuficiente para respeitar a stake mínima institucional.',
      );
    }

    if (requestedStake > effectiveMaximum) {
      return this.approvedEvaluation(
        'PAPER_COMPATIVEL',
        'USER_STAKE_CAPPED_BY_INSTITUTIONAL_LIMIT',
        effectiveMaximum,
        requestedStake,
        institutionalMaximumStake,
        remainingSessionExposure,
        'Stake solicitada acima do teto institucional. O sistema reduziu para o máximo PAPER permitido; aumento manual é bloqueado.',
      );
    }

    if (requestedStake < input.policy.defaultStake) {
      return this.approvedEvaluation(
        'PAPER_COMPATIVEL',
        'USER_STAKE_REDUCED_BELOW_DEFAULT',
        requestedStake,
        requestedStake,
        institutionalMaximumStake,
        remainingSessionExposure,
        'Usuário reduziu a stake abaixo do padrão institucional. Redução é permitida por regra defensiva.',
      );
    }

    return this.approvedEvaluation(
      'PAPER_COMPATIVEL',
      'PAPER_STAKE_APPROVED_BY_INSTITUTIONAL_POLICY',
      requestedStake,
      requestedStake,
      institutionalMaximumStake,
      remainingSessionExposure,
      'Stake PAPER compatível com saldo fictício, exposição de sessão e teto institucional.',
    );
  }

  private resolveRequestedStake(input: PaperStakePolicyInput): number {
    return this.roundMoney(input.requestedStake ?? input.policy.defaultStake);
  }

  private calculateInstitutionalMaximumStake(input: PaperStakePolicyInput): number {
    const balanceBoundedStake =
      input.account.availableBalance * input.policy.maxStakePercentOfAvailableBalance;

    return this.roundMoney(Math.min(input.policy.maxStake, balanceBoundedStake, input.account.availableBalance));
  }

  private validateInput(input: PaperStakePolicyInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'Input must be an object.';
    }

    if (typeof input.account !== 'object' || input.account === null) {
      return 'account must be provided.';
    }

    if (typeof input.policy !== 'object' || input.policy === null) {
      return 'policy must be provided.';
    }

    if (!Number.isFinite(input.account.availableBalance) || input.account.availableBalance < 0) {
      return 'account.availableBalance must be a non-negative finite number.';
    }

    if (!Number.isFinite(input.policy.minStake) || input.policy.minStake <= 0) {
      return 'policy.minStake must be a positive finite number.';
    }

    if (!Number.isFinite(input.policy.defaultStake) || input.policy.defaultStake <= 0) {
      return 'policy.defaultStake must be a positive finite number.';
    }

    if (!Number.isFinite(input.policy.maxStake) || input.policy.maxStake <= 0) {
      return 'policy.maxStake must be a positive finite number.';
    }

    if (input.policy.minStake > input.policy.defaultStake || input.policy.defaultStake > input.policy.maxStake) {
      return 'policy must satisfy minStake <= defaultStake <= maxStake.';
    }

    if (
      !Number.isFinite(input.policy.maxStakePercentOfAvailableBalance) ||
      input.policy.maxStakePercentOfAvailableBalance <= 0 ||
      input.policy.maxStakePercentOfAvailableBalance > 1
    ) {
      return 'policy.maxStakePercentOfAvailableBalance must be within (0, 1].';
    }

    if (!Number.isFinite(input.policy.maxSessionExposure) || input.policy.maxSessionExposure <= 0) {
      return 'policy.maxSessionExposure must be a positive finite number.';
    }

    if (!Number.isFinite(input.currentSessionExposure) || input.currentSessionExposure < 0) {
      return 'currentSessionExposure must be a non-negative finite number.';
    }

    if (input.requestedStake !== undefined && (!Number.isFinite(input.requestedStake) || input.requestedStake <= 0)) {
      return 'requestedStake must be a positive finite number when provided.';
    }

    return null;
  }

  private approvedEvaluation(
    decision: PaperStakePolicyDecision,
    reason: PaperStakePolicyReason,
    approvedStake: number,
    requestedStake: number,
    institutionalMaximumStake: number,
    remainingSessionExposure: number,
    explanation: string,
  ): PaperStakePolicyResult {
    return {
      ok: true,
      value: {
        decision,
        reason,
        approvedStake: this.roundMoney(Math.max(0, approvedStake)),
        requestedStake: this.roundMoney(Math.max(0, requestedStake)),
        institutionalMaximumStake: this.roundMoney(Math.max(0, institutionalMaximumStake)),
        remainingSessionExposure: this.roundMoney(Math.max(0, remainingSessionExposure)),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        explanation,
      },
    };
  }

  private fail(reason: PaperStakePolicyReason, message: string): PaperStakePolicyResult {
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
