import { OperatorRiskProfile } from '../../domain/risk';
import { RuntimeRiskDecisionResult } from '../runtime';

export interface BankrollHudSnapshotInput {
  readonly profile: OperatorRiskProfile;
  readonly currentBalance: number;
  readonly currentSessionPnl: number;
  readonly riskDecision: RuntimeRiskDecisionResult;
}

export interface BankrollHudSnapshot {
  readonly bankroll: number;
  readonly currentBalance: number;
  readonly currentSessionPnl: number;
  readonly baseStake: number;
  readonly dailyStopWin: number;
  readonly dailyStopLoss: number;
  readonly maxSingleExposure: number;
  readonly maxMartingaleSteps: number;
  readonly riskMode: string;
  readonly riskVerdict: string;
  readonly profitState: string;
  readonly cooldownState: string;
  readonly guidanceSeverity: string;
  readonly guidanceTitle: string;
  readonly guidanceBody: string;
  readonly recommendedAction: string;
}

/**
 * Builds a financial HUD snapshot for the operator.
 *
 * This composer does not decide risk. It only projects already-computed
 * profile and gateway decisions into a stable HUD DTO.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class BankrollHudSnapshotComposer {
  public compose(input: BankrollHudSnapshotInput): BankrollHudSnapshot {
    this.assertInput(input);

    return {
      bankroll: this.money(input.profile.bankroll),
      currentBalance: this.money(input.currentBalance),
      currentSessionPnl: this.money(input.currentSessionPnl),
      baseStake: this.money(input.profile.baseStake),
      dailyStopWin: this.money(input.profile.dailyStopWin),
      dailyStopLoss: this.money(input.profile.dailyStopLoss),
      maxSingleExposure: this.money(input.profile.maxSingleExposure),
      maxMartingaleSteps: input.profile.maxMartingaleSteps,
      riskMode: input.profile.riskMode,
      riskVerdict: input.riskDecision.verdict,
      profitState: input.riskDecision.profit.state,
      cooldownState: input.riskDecision.cooldown.cooldown.state,
      guidanceSeverity: input.riskDecision.guidance.severity,
      guidanceTitle: input.riskDecision.guidance.title,
      guidanceBody: input.riskDecision.guidance.body,
      recommendedAction: input.riskDecision.guidance.recommendedAction,
    };
  }

  public render(snapshot: BankrollHudSnapshot): string {
    return [
      '╔════ RL.SYS BANKROLL HUD ════╗',
      `Banca: R$ ${this.format(snapshot.bankroll)}`,
      `Saldo atual: R$ ${this.format(snapshot.currentBalance)}`,
      `PNL sessão: R$ ${this.format(snapshot.currentSessionPnl)}`,
      `Entrada base: R$ ${this.format(snapshot.baseStake)}`,
      `Stop Win: R$ ${this.format(snapshot.dailyStopWin)}`,
      `Stop Loss: R$ ${this.format(snapshot.dailyStopLoss)}`,
      `Exposição máx.: R$ ${this.format(snapshot.maxSingleExposure)}`,
      `MG máx.: ${snapshot.maxMartingaleSteps}`,
      `Modo: ${snapshot.riskMode}`,
      `Risco: ${snapshot.riskVerdict}`,
      `Lucro: ${snapshot.profitState}`,
      `Cooldown: ${snapshot.cooldownState}`,
      `Alerta: ${snapshot.guidanceSeverity}`,
      `Título: ${snapshot.guidanceTitle}`,
      `Mensagem: ${snapshot.guidanceBody}`,
      `Ação: ${snapshot.recommendedAction}`,
      '╚══════════════════════════════╝',
    ].join('\n');
  }

  private assertInput(input: BankrollHudSnapshotInput): void {
    if (!Number.isFinite(input.currentBalance) || input.currentBalance < 0) {
      throw new Error('currentBalance must be a non-negative finite number');
    }

    if (!Number.isFinite(input.currentSessionPnl)) {
      throw new Error('currentSessionPnl must be finite');
    }
  }

  private money(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private format(value: number): string {
    return value.toFixed(2).replace('.', ',');
  }
}
