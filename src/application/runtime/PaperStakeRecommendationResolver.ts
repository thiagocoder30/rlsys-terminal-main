import {
  PaperBaseExposureRiskPolicy,
} from './PaperBaseExposureRiskPolicy.js';


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

  /**
   * Monetary representation of the sovereign exposure ceiling.
   *
   * CRITICAL:
   *
   * This value is always rounded DOWN to cents and can therefore
   * never exceed:
   *
   * bankroll × exposureLimitFraction
   */
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

  readonly recommendationOnly:
    true;

  readonly humanExecutionRequired:
    true;

  readonly automaticBetExecutionAllowed:
    false;
}


interface PaperStakeProfilePolicy {
  readonly maximumStrategyRisk:
    number;
}


/**
 * Strategy-risk admissibility remains local to the stake resolver.
 *
 * IMPORTANT:
 *
 * Base financial exposure does NOT live here.
 *
 * The canonical authority for the risk-mode exposure fraction is
 * PaperBaseExposureRiskPolicy.
 */
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
        maximumStrategyRisk:
          0.34,
      }),

    moderate:
      Object.freeze({
        maximumStrategyRisk:
          0.48,
      }),

    aggressive:
      Object.freeze({
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
 * 2. Base exposure comes from the canonical
 *    PaperBaseExposureRiskPolicy.
 * 3. Stake never exceeds the risk-mode exposure cap.
 * 4. Monetary exposure ceiling is rounded DOWN, never nearest/up.
 * 5. Stake is rounded DOWN to the provider minimum-chip increment.
 * 6. If even the minimum chip exceeds safe exposure, operation blocks.
 * 7. Strategy confidence never increases financial exposure.
 * 8. High strategy risk may block but never increase stake.
 * 9. Nothing in this class executes a bet.
 */
export class PaperStakeRecommendationResolver {
  private readonly baseExposureRiskPolicy =
    new PaperBaseExposureRiskPolicy();


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

    /*
     * Canonical financial doctrine.
     *
     * The resolver intentionally does not own the numerical
     * conservative/moderate/aggressive exposure fractions.
     */
    const exposureLimitFraction =
      this.baseExposureRiskPolicy
        .resolve(
          input.riskMode,
        )
        .exposureFraction;

    /*
     * IMPORTANT:
     *
     * Do not use ordinary monetary rounding here.
     *
     * Example:
     *
     * bankroll = 119.80
     * moderate = 2%
     *
     * mathematical cap = 2.396
     *
     * Math.round(..., 2 decimals) => 2.40
     *
     * 2.40 / 119.80 > 2%
     *
     * Therefore the sovereign cap itself must always be
     * represented conservatively.
     */
    const rawExposureLimitAmount =
      input.bankroll *
      exposureLimitFraction;

    const exposureLimitAmount =
      this.floorMoney(
        rawExposureLimitAmount,
      );

    const base =
      {
        bankroll:
          this.money(
            input.bankroll,
          ),

        riskMode:
          input.riskMode,

        exposureLimitFraction,

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
      rawExposureLimitAmount <
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


    /*
     * Quantization happens from the unrounded mathematical cap.
     *
     * This guarantees that an intermediate cent-rounding step
     * can never accidentally increase the authorized exposure.
     */
    const suggestedStake =
      this.floorToIncrement(
        rawExposureLimitAmount,
        input.minimumStake,
      );


    if (
      suggestedStake <=
      0
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


    /*
     * Defense in depth against any future regression in money
     * or increment quantization.
     */
    if (
      suggestedStake >
      rawExposureLimitAmount +
      1e-9
    ) {
      throw new Error(
        'paper_stake_exposure_amount_invariant_violated',
      );
    }


    const effectiveExposureFraction =
      suggestedStake /
      input.bankroll;


    if (
      effectiveExposureFraction >
      exposureLimitFraction +
      1e-12
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
          `EXPOSURE_LIMIT_FRACTION:${exposureLimitFraction}`,
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

    const value =
      units *
      increment;

    return this.money(
      value,
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
      input.bankroll <=
        0
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
      input.minimumStake <=
        0
    ) {
      throw new Error(
        'paper_stake_invalid_minimum',
      );
    }

    if (
      !Number.isFinite(
        input.strategyRiskScore,
      ) ||
      input.strategyRiskScore <
        0 ||
      input.strategyRiskScore >
        1
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
    ) /
    100;
  }


  private floorMoney(
    value:
      number,
  ): number {
    return Math.floor(
      (
        value +
        1e-9
      ) *
      100,
    ) /
    100;
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
