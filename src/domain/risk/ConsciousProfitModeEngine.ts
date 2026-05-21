import { OperatorRiskProfile } from './OperatorRiskProfile';

export type ConsciousProfitModeState =
  | 'PROFIT_OPEN'
  | 'PROFIT_PROTECT'
  | 'PROFIT_LOCKED';

export interface ConsciousProfitModeInput {
  readonly profile: OperatorRiskProfile;
  readonly currentSessionPnl: number;
}

export interface ConsciousProfitModeResult {
  readonly state: ConsciousProfitModeState;
  readonly exposureMultiplier: number;
  readonly shouldSuggestStop: boolean;
  readonly reason: string;
}

/**
 * Protects conscious profit by reducing exposure as the session approaches
 * the user's stop win and locking new entries once the target is reached.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class ConsciousProfitModeEngine {
  public evaluate(input: ConsciousProfitModeInput): ConsciousProfitModeResult {
    this.assertValidInput(input);

    if (input.currentSessionPnl >= input.profile.dailyStopWin) {
      return {
        state: 'PROFIT_LOCKED',
        exposureMultiplier: 0,
        shouldSuggestStop: true,
        reason: 'Meta de lucro atingida. Encerrar a sessão preserva o resultado positivo.',
      };
    }

    const protectionThreshold = input.profile.dailyStopWin * 0.75;

    if (input.currentSessionPnl >= protectionThreshold) {
      return {
        state: 'PROFIT_PROTECT',
        exposureMultiplier: 0.5,
        shouldSuggestStop: true,
        reason: 'Lucro próximo da meta. Reduzir exposição protege o ganho já conquistado.',
      };
    }

    return {
      state: 'PROFIT_OPEN',
      exposureMultiplier: 1,
      shouldSuggestStop: false,
      reason: 'Lucro ainda abaixo da zona de proteção. Manter disciplina e exposição padrão.',
    };
  }

  private assertValidInput(input: ConsciousProfitModeInput): void {
    if (!Number.isFinite(input.currentSessionPnl)) {
      throw new Error('currentSessionPnl must be finite');
    }

    if (!Number.isFinite(input.profile.dailyStopWin) || input.profile.dailyStopWin <= 0) {
      throw new Error('profile.dailyStopWin must be positive');
    }
  }
}
