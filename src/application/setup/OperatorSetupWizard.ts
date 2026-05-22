import {
  OperatorRiskMode,
  OperatorRiskProfile,
  OperatorRiskProfileCalculator,
  RiskProfileRepository,
} from '../../domain/risk';

export interface OperatorSetupWizardInput {
  readonly bankroll: number;
  readonly riskMode: OperatorRiskMode;
  readonly allowMartingale: boolean;
}

export interface OperatorSetupWizardResult {
  readonly accepted: boolean;
  readonly profile: OperatorRiskProfile;
  readonly savedPath: string;
  readonly message: string;
}

/**
 * Application service that creates and persists the operator risk profile.
 *
 * It is intentionally UI-agnostic. CLI, mobile, or API adapters can collect
 * answers and pass a structured input here.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class OperatorSetupWizard {
  public constructor(
    private readonly repository: RiskProfileRepository,
    private readonly calculator: OperatorRiskProfileCalculator =
      new OperatorRiskProfileCalculator(),
  ) {}

  public async configure(
    input: OperatorSetupWizardInput,
  ): Promise<OperatorSetupWizardResult> {
    this.assertInput(input);

    const profile = this.calculator.calculate({
      bankroll: input.bankroll,
      riskMode: input.riskMode,
      allowMartingale: input.allowMartingale,
    });

    const saved = await this.repository.save(profile);

    return {
      accepted: saved.accepted,
      profile,
      savedPath: saved.path,
      message: this.message(profile),
    };
  }

  private assertInput(input: OperatorSetupWizardInput): void {
    if (!Number.isFinite(input.bankroll) || input.bankroll <= 0) {
      throw new Error('bankroll must be a positive finite number');
    }

    if (
      input.riskMode !== 'CONSERVATIVE' &&
      input.riskMode !== 'MODERATE' &&
      input.riskMode !== 'AGGRESSIVE'
    ) {
      throw new Error('riskMode must be valid');
    }
  }

  private message(profile: OperatorRiskProfile): string {
    return [
      'Perfil de risco configurado com sucesso.',
      `Banca: R$ ${this.money(profile.bankroll)}`,
      `Entrada base: R$ ${this.money(profile.baseStake)}`,
      `Stop win: R$ ${this.money(profile.dailyStopWin)}`,
      `Stop loss: R$ ${this.money(profile.dailyStopLoss)}`,
      `Exposição máxima: R$ ${this.money(profile.maxSingleExposure)}`,
      `Martingale máximo: ${profile.maxMartingaleSteps}`,
      profile.recommendedSessionGoal,
    ].join('\n');
  }

  private money(value: number): string {
    return value.toFixed(2).replace('.', ',');
  }
}
