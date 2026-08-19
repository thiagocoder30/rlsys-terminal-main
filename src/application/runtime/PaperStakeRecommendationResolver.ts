export type PaperStakeRiskMode =
  | 'conservative'
  | 'moderate'
  | 'aggressive';


export type PaperStakeRecommendationStatus =
  | 'RECOMMENDED'
  | 'BLOCKED';


export interface PaperStakeRecommendationInput {
  readonly bankroll:
    number;

  readonly riskMode:
    PaperStakeRiskMode;

  /**
   * Smallest chip/financial unit accepted by the provider.
   *
   * Pragmatic currently uses R$ 0,10.
   * Evolution currently uses R$ 0,50.
   *
   * The resolver remains provider-agnostic and receives the value
   * from session configuration.
   */
  readonly minimumStake:
    number;

  /**
   * Current strategy risk score, normalized to 0..1.
   *
   * This does not increase stake.
   * It may only block a recommendation.
   */
  readonly strategyRiskScore:
    number;
}


export interface PaperStakeRecommendation {
  readonly status:
    PaperStakeRecommendationStatus;

  readonly bankroll:
    number;

  readonly riskMode:
    PaperStakeRiskMode;

  readonly exposureLimitFraction:
    number;

  readonly exposureLimitAmount:
    number;

  readonly minimumStake:
    number;

  readonly suggestedStake:
    number | null;

  readonly effectiveExposureFraction:
    number | null;

  readonly strategyRiskScore:
    number;

  readonly maximumStrategyRisk:
    number;

  readonly reasons:
    readonly string[];

  readonly blockers:
    readonly string[];

  readonly recommendationOnly: true;

  readonly humanExecutionRequired: true;

  readonly automaticBetExecutionAllowed: false;
}


interface PaperStakeProfilePolicy {
  readonly exposureFraction:
    number;

  readonly maximumStrategyRisk:
    number;
}


const POLICY:
  Readonly<
    Record<
      PaperStakeRiskMode,
      PaperStakeProfilePolicy
    >
  > =
    Object.freeze({
      conservative:
        Object.freeze({
          exposureFraction:
            0.01,

          maximumStrategyRisk:
            0.34,
        }),

      moderate:
        Object.freeze({
          exposureFraction:
            0.02,

          maximumStrategyRisk:
            0.48,
        }),

      aggressive:
        Object.freeze({
          exposureFraction:
            0.03,

          maximumStrategyRisk:
            0.62,
        }),
    });


/**
 * Determines the maximum PAPER stake that may be recommended.
 *
 * Critical invariants:
 *
 * 1. Stake is derived from CURRENT bankroll.
 * 2. Stake never exceeds the risk-mode exposure cap.
 * 3. Stake is rounded DOWN to the provider minimum-chip increment.
 * 4. If even the minimum chip exceeds safe exposure, operation blocks.
 * 5. Strategy confidence never increases financial exposure.
 * 6. High strategy risk may block but never increase stake.
 * 7. Nothing in this class executes a bet.
 */
export class PaperStakeRecommendationResolver {
  public resolve(
    input:
      PaperStakeRecommendationInput,
  ): PaperStakeRecommendation {
    this.validateInput(
      input,
    );

    const policy =
      POLICY[
        input.riskMode
      ];

    const exposureLimitAmount =
      this.money(
        input.bankroll *
        policy.exposureFraction,
      );

    const base =
      {
        bankroll:
          this.money(
            input.bankroll,
          ),

        riskMode:
          input.riskMode,

        exposureLimitFraction:
          policy.exposureFraction,

        exposureLimitAmount,

        minimumStake:
          input.minimumStake,

        strategyRiskScore:
          input.strategyRiskScore,

        maximumStrategyRisk:
          policy.maximumStrategyRisk,

        recommendationOnly:
          true as const,

        humanExecutionRequired:
          true as const,

        automaticBetExecutionAllowed:
          false as const,
      };

    if (
      input.strategyRiskScore >
      policy.maximumStrategyRisk
    ) {
      return Object.freeze({
        ...base,

        status:
          'BLOCKED' as const,

        suggestedStake:
          null,

        effectiveExposureFraction:
          null,

        reasons:
          Object.freeze([
            `RISK_MODE:${input.riskMode}`,
            `STRATEGY_RISK:${input.strategyRiskScore}`,
            `MAXIMUM_STRATEGY_RISK:${policy.maximumStrategyRisk}`,
          ]),

        blockers:
          Object.freeze([
            'PAPER_STAKE_STRATEGY_RISK_TOO_HIGH',
          ]),
      });
    }

    if (
      exposureLimitAmount <
      input.minimumStake
    ) {
      return Object.freeze({
        ...base,

        status:
          'BLOCKED' as const,

        suggestedStake:
          null,

        effectiveExposureFraction:
          null,

        reasons:
          Object.freeze([
            `EXPOSURE_LIMIT_AMOUNT:${exposureLimitAmount}`,
            `MINIMUM_STAKE:${input.minimumStake}`,
          ]),

        blockers:
          Object.freeze([
            'PAPER_STAKE_MINIMUM_EXCEEDS_SAFE_EXPOSURE',
          ]),
      });
    }

    const suggestedStake =
      this.floorToIncrement(
        exposureLimitAmount,
        input.minimumStake,
      );

    if (
      suggestedStake <= 0
    ) {
      return Object.freeze({
        ...base,

        status:
          'BLOCKED' as const,

        suggestedStake:
          null,

        effectiveExposureFraction:
          null,

        reasons:
          Object.freeze([
            'PAPER_STAKE_NO_SAFE_INCREMENT',
          ]),

        blockers:
          Object.freeze([
            'PAPER_STAKE_MINIMUM_EXCEEDS_SAFE_EXPOSURE',
          ]),
      });
    }

    const effectiveExposureFraction =
      suggestedStake /
      input.bankroll;

    if (
      effectiveExposureFraction >
      policy.exposureFraction +
      Number.EPSILON
    ) {
      throw new Error(
        'paper_stake_exposure_invariant_violated',
      );
    }

    return Object.freeze({
      ...base,

      status:
        'RECOMMENDED' as const,

      suggestedStake,

      effectiveExposureFraction:
        this.round6(
          effectiveExposureFraction,
        ),

      reasons:
        Object.freeze([
          `RISK_MODE:${input.riskMode}`,
          `EXPOSURE_LIMIT_FRACTION:${policy.exposureFraction}`,
          `EXPOSURE_LIMIT_AMOUNT:${exposureLimitAmount}`,
          `SUGGESTED_STAKE:${suggestedStake}`,
          `STRATEGY_RISK:${input.strategyRiskScore}`,
        ]),

      blockers:
        Object.freeze([]),
    });
  }


  private floorToIncrement(
    amount:
      number,

    increment:
      number,
  ): number {
    const units =
      Math.floor(
        (
          amount +
          1e-9
        ) /
        increment,
      );

    return this.money(
      units *
      increment,
    );
  }


  private validateInput(
    input:
      PaperStakeRecommendationInput,
  ): void {
    if (
      !Number.isFinite(
        input.bankroll,
      ) ||
      input.bankroll <= 0
    ) {
      throw new Error(
        'paper_stake_invalid_bankroll',
      );
    }

    if (
      input.riskMode !==
        'conservative' &&
      input.riskMode !==
        'moderate' &&
      input.riskMode !==
        'aggressive'
    ) {
      throw new Error(
        'paper_stake_invalid_risk_mode',
      );
    }

    if (
      !Number.isFinite(
        input.minimumStake,
      ) ||
      input.minimumStake <= 0
    ) {
      throw new Error(
        'paper_stake_invalid_minimum',
      );
    }

    if (
      !Number.isFinite(
        input.strategyRiskScore,
      ) ||
      input.strategyRiskScore < 0 ||
      input.strategyRiskScore > 1
    ) {
      throw new Error(
        'paper_stake_invalid_strategy_risk',
      );
    }
  }


  private money(
    value:
      number,
  ): number {
    return Math.round(
      value *
      100,
    ) / 100;
  }


  private round6(
    value:
      number,
  ): number {
    return Number(
      value.toFixed(
        6,
      ),
    );
  }
}
