import type {
  PaperCapitalRiskMode,
} from './PaperCapitalPreservationGuard.js';


export interface PaperBaseExposureRiskProfile {
  readonly riskMode:
    PaperCapitalRiskMode;

  /**
   * Sovereign maximum simultaneous BASE exposure.
   *
   * This is deliberately distinct from:
   *
   * - Stop Win;
   * - Stop Loss;
   * - Max Drawdown;
   * - Controlled Recovery capacity.
   *
   * The fraction represents the maximum ordinary PAPER
   * financial exposure permitted against the current bankroll.
   */
  readonly exposureFraction:
    number;
}


const POLICY:
  Readonly<
    Record<
      PaperCapitalRiskMode,
      PaperBaseExposureRiskProfile
    >
  > =
    Object.freeze({
      conservative:
        Object.freeze({
          riskMode:
            'conservative',

          exposureFraction:
            0.01,
        }),

      moderate:
        Object.freeze({
          riskMode:
            'moderate',

          exposureFraction:
            0.02,
        }),

      aggressive:
        Object.freeze({
          riskMode:
            'aggressive',

          exposureFraction:
            0.03,
        }),
    });


/**
 * Canonical BASE exposure doctrine.
 *
 * Current certified doctrine:
 *
 * conservative -> 1%
 * moderate     -> 2%
 * aggressive   -> 3%
 *
 * IMPORTANT:
 *
 * This is not a Kelly policy.
 * This is not a recovery policy.
 * This is not a stop-loss policy.
 *
 * Kelly/recovery may propose less or request more, but no
 * downstream component may authorize ordinary aggregate
 * portfolio exposure above this sovereign BASE ceiling.
 */
export class PaperBaseExposureRiskPolicy {
  public resolve(
    riskMode:
      PaperCapitalRiskMode,
  ): PaperBaseExposureRiskProfile {
    this.validateRiskMode(
      riskMode,
    );

    return POLICY[
      riskMode
    ];
  }


  private validateRiskMode(
    riskMode:
      PaperCapitalRiskMode,
  ): void {
    if (
      riskMode !==
        'conservative' &&
      riskMode !==
        'moderate' &&
      riskMode !==
        'aggressive'
    ) {
      throw new Error(
        'paper_base_exposure_invalid_risk_mode',
      );
    }
  }
}
