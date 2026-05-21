import { OperatorRiskProfile } from './OperatorRiskProfile';

export type BankrollSafetyVerdict = 'SAFE' | 'REVIEW' | 'BLOCKED';

export interface BankrollSafetyGateInput {
  readonly profile: OperatorRiskProfile;
  readonly currentBalance: number;
  readonly requestedStake: number;
  readonly currentSessionPnl: number;
  readonly martingaleStep: number;
}

export interface BankrollSafetyGateResult {
  readonly verdict: BankrollSafetyVerdict;
  readonly reason: string;
  readonly allowedStake: number;
  readonly remainingLossBudget: number;
  readonly remainingProfitTarget: number;
}

/**
 * Defensive financial gate for operator bankroll protection.
 *
 * The gate does not search for entries. It validates whether a requested
 * operation is financially healthy according to the user's risk profile.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class BankrollSafetyGate {
  public evaluate(input: BankrollSafetyGateInput): BankrollSafetyGateResult {
    this.assertValidInput(input);

    const remainingLossBudget = this.roundMoney(
      Math.max(0, input.profile.dailyStopLoss + input.currentSessionPnl),
    );

    const remainingProfitTarget = this.roundMoney(
      Math.max(0, input.profile.dailyStopWin - input.currentSessionPnl),
    );

    if (input.currentSessionPnl <= -input.profile.dailyStopLoss) {
      return this.block(
        'Stop loss diário atingido. Encerrar sessão para preservar a banca.',
        0,
        remainingLossBudget,
        remainingProfitTarget,
      );
    }

    if (input.currentSessionPnl >= input.profile.dailyStopWin) {
      return this.block(
        'Stop win diário atingido. Preservar lucro é prioridade.',
        0,
        remainingLossBudget,
        remainingProfitTarget,
      );
    }

    if (input.requestedStake > input.profile.maxSingleExposure) {
      return this.block(
        'Entrada bloqueada: exposição acima do limite saudável da banca.',
        input.profile.maxSingleExposure,
        remainingLossBudget,
        remainingProfitTarget,
      );
    }

    if (input.requestedStake > remainingLossBudget) {
      return this.block(
        'Entrada bloqueada: risco ultrapassa o orçamento restante de perda.',
        remainingLossBudget,
        remainingLossBudget,
        remainingProfitTarget,
      );
    }

    if (input.martingaleStep > input.profile.maxMartingaleSteps) {
      return this.block(
        'Martingale bloqueado: limite seguro de progressão atingido.',
        input.profile.baseStake,
        remainingLossBudget,
        remainingProfitTarget,
      );
    }

    if (input.requestedStake > input.profile.baseStake) {
      return {
        verdict: 'REVIEW',
        reason: 'Entrada acima da base recomendada. Operar apenas se houver justificativa forte.',
        allowedStake: this.roundMoney(input.requestedStake),
        remainingLossBudget,
        remainingProfitTarget,
      };
    }

    return {
      verdict: 'SAFE',
      reason: 'Entrada compatível com a banca e com o perfil de risco.',
      allowedStake: this.roundMoney(input.requestedStake),
      remainingLossBudget,
      remainingProfitTarget,
    };
  }

  private block(
    reason: string,
    allowedStake: number,
    remainingLossBudget: number,
    remainingProfitTarget: number,
  ): BankrollSafetyGateResult {
    return {
      verdict: 'BLOCKED',
      reason,
      allowedStake: this.roundMoney(Math.max(0, allowedStake)),
      remainingLossBudget,
      remainingProfitTarget,
    };
  }

  private assertValidInput(input: BankrollSafetyGateInput): void {
    if (!Number.isFinite(input.currentBalance) || input.currentBalance < 0) {
      throw new Error('currentBalance must be a non-negative finite number');
    }

    if (!Number.isFinite(input.requestedStake) || input.requestedStake <= 0) {
      throw new Error('requestedStake must be a positive finite number');
    }

    if (!Number.isFinite(input.currentSessionPnl)) {
      throw new Error('currentSessionPnl must be finite');
    }

    if (!Number.isInteger(input.martingaleStep) || input.martingaleStep < 0) {
      throw new Error('martingaleStep must be a non-negative integer');
    }
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
