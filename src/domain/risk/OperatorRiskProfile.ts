export type OperatorRiskMode = 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';

export interface OperatorRiskProfileInput {
  readonly bankroll: number;
  readonly riskMode: OperatorRiskMode;
  readonly allowMartingale: boolean;
}

export interface OperatorRiskProfile {
  readonly bankroll: number;
  readonly riskMode: OperatorRiskMode;
  readonly baseStake: number;
  readonly dailyStopWin: number;
  readonly dailyStopLoss: number;
  readonly maxSingleExposure: number;
  readonly maxMartingaleSteps: number;
  readonly recommendedSessionGoal: string;
}

/**
 * Calculates a defensive operator risk profile from bankroll and risk mode.
 *
 * The calculator is intentionally conservative. Its primary goal is not to
 * maximize profit, but to preserve bankroll and prevent emotional escalation.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class OperatorRiskProfileCalculator {
  public calculate(input: OperatorRiskProfileInput): OperatorRiskProfile {
    this.assertValidInput(input);

    const policy = this.policyFor(input.riskMode);

    const baseStake = this.roundMoney(input.bankroll * policy.baseStakeRatio);
    const dailyStopWin = this.roundMoney(input.bankroll * policy.stopWinRatio);
    const dailyStopLoss = this.roundMoney(input.bankroll * policy.stopLossRatio);
    const maxSingleExposure = this.roundMoney(input.bankroll * policy.maxExposureRatio);

    const maxMartingaleSteps = input.allowMartingale
      ? policy.maxMartingaleSteps
      : 0;

    return {
      bankroll: this.roundMoney(input.bankroll),
      riskMode: input.riskMode,
      baseStake,
      dailyStopWin,
      dailyStopLoss,
      maxSingleExposure,
      maxMartingaleSteps,
      recommendedSessionGoal: this.sessionGoalFor(input.riskMode),
    };
  }

  private policyFor(mode: OperatorRiskMode): {
    readonly baseStakeRatio: number;
    readonly stopWinRatio: number;
    readonly stopLossRatio: number;
    readonly maxExposureRatio: number;
    readonly maxMartingaleSteps: number;
  } {
    if (mode === 'AGGRESSIVE') {
      return {
        baseStakeRatio: 0.03,
        stopWinRatio: 0.18,
        stopLossRatio: 0.12,
        maxExposureRatio: 0.09,
        maxMartingaleSteps: 2,
      };
    }

    if (mode === 'MODERATE') {
      return {
        baseStakeRatio: 0.02,
        stopWinRatio: 0.12,
        stopLossRatio: 0.08,
        maxExposureRatio: 0.06,
        maxMartingaleSteps: 1,
      };
    }

    return {
      baseStakeRatio: 0.01,
      stopWinRatio: 0.08,
      stopLossRatio: 0.05,
      maxExposureRatio: 0.03,
      maxMartingaleSteps: 1,
    };
  }

  private sessionGoalFor(mode: OperatorRiskMode): string {
    if (mode === 'AGGRESSIVE') {
      return 'Operar com alta cautela. Encerrar ao atingir a meta. Não perseguir perdas.';
    }

    if (mode === 'MODERATE') {
      return 'Buscar lucro consciente com baixa frequência de entradas.';
    }

    return 'Preservar banca primeiro. Lucro pequeno e consistente é o objetivo.';
  }

  private assertValidInput(input: OperatorRiskProfileInput): void {
    if (!Number.isFinite(input.bankroll) || input.bankroll <= 0) {
      throw new Error('bankroll must be a positive finite number');
    }
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
