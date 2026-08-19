export type PaperCapitalRiskMode =
  | 'conservative'
  | 'moderate'
  | 'aggressive';


export type PaperCapitalPreservationDecision =
  | 'ALLOW'
  | 'CAUTION'
  | 'STOP';


export type PaperCapitalStopReason =
  | 'STOP_WIN_REACHED'
  | 'STOP_LOSS_REACHED'
  | 'MAX_DRAWDOWN_REACHED';


export interface PaperCapitalPreservationInput {
  readonly initialBankroll:
    number;

  readonly currentBankroll:
    number;

  readonly peakBankroll:
    number;

  readonly riskMode:
    PaperCapitalRiskMode;
}


export interface PaperCapitalPreservationReport {
  readonly decision:
    PaperCapitalPreservationDecision;

  readonly stopReason:
    PaperCapitalStopReason | null;

  readonly initialBankroll:
    number;

  readonly currentBankroll:
    number;

  readonly peakBankroll:
    number;

  readonly sessionProfitAmount:
    number;

  readonly sessionReturnFraction:
    number;

  readonly drawdownAmount:
    number;

  readonly drawdownFraction:
    number;

  readonly stopWinFraction:
    number;

  readonly stopLossFraction:
    number;

  readonly maxDrawdownFraction:
    number;

  readonly stopWinBankroll:
    number;

  readonly stopLossBankroll:
    number;

  readonly caution:
    boolean;

  readonly reasons:
    readonly string[];

  readonly warnings:
    readonly string[];

  readonly blockers:
    readonly string[];

  readonly newRecommendationsAllowed:
    boolean;

  readonly recoveryAllowed:
    boolean;

  readonly bankrollExposureAllowed:
    boolean;

  readonly recommendationOnly: true;

  readonly humanExecutionRequired: true;

  readonly automaticBetExecutionAllowed: false;
}


interface PaperCapitalPreservationPolicy {
  readonly stopWinFraction:
    number;

  readonly stopLossFraction:
    number;

  readonly maxDrawdownFraction:
    number;
}


const POLICY:
  Readonly<
    Record<
      PaperCapitalRiskMode,
      PaperCapitalPreservationPolicy
    >
  > =
    Object.freeze({
      conservative:
        Object.freeze({
          stopWinFraction:
            0.10,

          stopLossFraction:
            0.05,

          maxDrawdownFraction:
            0.05,
        }),

      moderate:
        Object.freeze({
          stopWinFraction:
            0.20,

          stopLossFraction:
            0.10,

          maxDrawdownFraction:
            0.10,
        }),

      aggressive:
        Object.freeze({
          stopWinFraction:
            0.30,

          stopLossFraction:
            0.15,

          maxDrawdownFraction:
            0.15,
        }),
    });


const CAUTION_RATIO =
  0.75;


/**
 * Sovereign capital-preservation gate for a supervised PAPER session.
 *
 * Evaluation order:
 *
 * 1. STOP WIN
 * 2. STOP LOSS
 * 3. MAX DRAWDOWN
 * 4. CAUTION
 * 5. ALLOW
 *
 * The guard must execute before:
 *
 * - strategy recommendation;
 * - stake sizing;
 * - controlled recovery;
 * - any operator-facing entry suggestion.
 *
 * STOP WIN and STOP LOSS are measured from initial bankroll.
 *
 * Drawdown is measured from session peak bankroll.
 *
 * CAUTION begins when at least 75% of Stop Loss or Max Drawdown
 * capacity has already been consumed.
 *
 * Financial ratios are normalized before threshold comparison so
 * IEEE-754 floating-point representation cannot incorrectly miss an
 * exact institutional boundary such as 75%.
 *
 * No automatic betting capability exists here.
 */
export class PaperCapitalPreservationGuard {
  public evaluate(
    input:
      PaperCapitalPreservationInput,
  ): PaperCapitalPreservationReport {
    this.validateInput(
      input,
    );

    const policy =
      POLICY[
        input.riskMode
      ];

    const initialBankroll =
      this.money(
        input.initialBankroll,
      );

    const currentBankroll =
      this.money(
        input.currentBankroll,
      );

    const peakBankroll =
      this.money(
        input.peakBankroll,
      );

    const sessionProfitAmount =
      this.money(
        currentBankroll -
        initialBankroll,
      );

    const sessionReturnFraction =
      this.round6(
        sessionProfitAmount /
        initialBankroll,
      );

    const drawdownAmount =
      this.money(
        Math.max(
          0,
          peakBankroll -
          currentBankroll,
        ),
      );

    const drawdownFraction =
      peakBankroll > 0
        ? this.round6(
            drawdownAmount /
            peakBankroll,
          )
        : 0;

    const stopWinBankroll =
      this.money(
        initialBankroll *
        (
          1 +
          policy.stopWinFraction
        ),
      );

    const stopLossBankroll =
      this.money(
        initialBankroll *
        (
          1 -
          policy.stopLossFraction
        ),
      );

    const base =
      {
        initialBankroll,

        currentBankroll,

        peakBankroll,

        sessionProfitAmount,

        sessionReturnFraction,

        drawdownAmount,

        drawdownFraction,

        stopWinFraction:
          policy.stopWinFraction,

        stopLossFraction:
          policy.stopLossFraction,

        maxDrawdownFraction:
          policy.maxDrawdownFraction,

        stopWinBankroll,

        stopLossBankroll,

        recommendationOnly:
          true as const,

        humanExecutionRequired:
          true as const,

        automaticBetExecutionAllowed:
          false as const,
      };

    /*
     * Successful-session preservation has highest priority.
     */
    if (
      currentBankroll >=
      stopWinBankroll
    ) {
      return Object.freeze({
        ...base,

        decision:
          'STOP' as const,

        stopReason:
          'STOP_WIN_REACHED' as const,

        caution:
          false,

        reasons:
          Object.freeze([
            `CURRENT_BANKROLL:${currentBankroll}`,
            `STOP_WIN_BANKROLL:${stopWinBankroll}`,
            `SESSION_RETURN:${sessionReturnFraction}`,
          ]),

        warnings:
          Object.freeze([]),

        blockers:
          Object.freeze([
            'CAPITAL_PRESERVATION_STOP_WIN_REACHED',
          ]),

        newRecommendationsAllowed:
          false,

        recoveryAllowed:
          false,

        bankrollExposureAllowed:
          false,
      });
    }

    /*
     * Absolute loss measured from session initial bankroll.
     */
    if (
      currentBankroll <=
      stopLossBankroll
    ) {
      return Object.freeze({
        ...base,

        decision:
          'STOP' as const,

        stopReason:
          'STOP_LOSS_REACHED' as const,

        caution:
          false,

        reasons:
          Object.freeze([
            `CURRENT_BANKROLL:${currentBankroll}`,
            `STOP_LOSS_BANKROLL:${stopLossBankroll}`,
            `SESSION_RETURN:${sessionReturnFraction}`,
          ]),

        warnings:
          Object.freeze([]),

        blockers:
          Object.freeze([
            'CAPITAL_PRESERVATION_STOP_LOSS_REACHED',
          ]),

        newRecommendationsAllowed:
          false,

        recoveryAllowed:
          false,

        bankrollExposureAllowed:
          false,
      });
    }

    /*
     * Profit-protection loss measured from session peak.
     */
    if (
      drawdownFraction >=
      policy.maxDrawdownFraction
    ) {
      return Object.freeze({
        ...base,

        decision:
          'STOP' as const,

        stopReason:
          'MAX_DRAWDOWN_REACHED' as const,

        caution:
          false,

        reasons:
          Object.freeze([
            `PEAK_BANKROLL:${peakBankroll}`,
            `CURRENT_BANKROLL:${currentBankroll}`,
            `DRAWDOWN:${drawdownFraction}`,
            `MAX_DRAWDOWN:${policy.maxDrawdownFraction}`,
          ]),

        warnings:
          Object.freeze([]),

        blockers:
          Object.freeze([
            'CAPITAL_PRESERVATION_MAX_DRAWDOWN_REACHED',
          ]),

        newRecommendationsAllowed:
          false,

        recoveryAllowed:
          false,

        bankrollExposureAllowed:
          false,
      });
    }

    /*
     * Normalize utilization ratios BEFORE comparisons.
     *
     * Example:
     *
     * 0.075 / 0.10 may be represented internally as something
     * slightly below 0.75.
     *
     * Institutional threshold semantics require the exact
     * 75% boundary to enter CAUTION.
     */
    const stopLossUsage =
      this.round6(
        currentBankroll <
        initialBankroll
          ? (
              (
                initialBankroll -
                currentBankroll
              ) /
              (
                initialBankroll *
                policy.stopLossFraction
              )
            )
          : 0,
      );

    const drawdownUsage =
      this.round6(
        policy.maxDrawdownFraction >
        0
          ? (
              drawdownFraction /
              policy.maxDrawdownFraction
            )
          : 0,
      );

    const stopLossCaution =
      stopLossUsage >=
      CAUTION_RATIO;

    const drawdownCaution =
      drawdownUsage >=
      CAUTION_RATIO;

    const caution =
      stopLossCaution ||
      drawdownCaution;

    if (
      caution
    ) {
      const warnings:
        string[] = [];

      if (
        stopLossCaution
      ) {
        warnings.push(
          'CAPITAL_PRESERVATION_STOP_LOSS_CAUTION',
        );
      }

      if (
        drawdownCaution
      ) {
        warnings.push(
          'CAPITAL_PRESERVATION_DRAWDOWN_CAUTION',
        );
      }

      return Object.freeze({
        ...base,

        decision:
          'CAUTION' as const,

        stopReason:
          null,

        caution:
          true,

        reasons:
          Object.freeze([
            `STOP_LOSS_LIMIT_USAGE:${stopLossUsage}`,
            `DRAWDOWN_LIMIT_USAGE:${drawdownUsage}`,
          ]),

        warnings:
          Object.freeze(
            warnings,
          ),

        blockers:
          Object.freeze([]),

        /*
         * Normal low-exposure recommendations may still be evaluated.
         *
         * Recovery is disabled because capital preservation outranks
         * historical-loss recovery.
         */
        newRecommendationsAllowed:
          true,

        recoveryAllowed:
          false,

        bankrollExposureAllowed:
          true,
      });
    }

    return Object.freeze({
      ...base,

      decision:
        'ALLOW' as const,

      stopReason:
        null,

      caution:
        false,

      reasons:
        Object.freeze([
          'CAPITAL_PRESERVATION_WITHIN_LIMITS',
          `STOP_LOSS_LIMIT_USAGE:${stopLossUsage}`,
          `DRAWDOWN_LIMIT_USAGE:${drawdownUsage}`,
        ]),

      warnings:
        Object.freeze([]),

      blockers:
        Object.freeze([]),

      newRecommendationsAllowed:
        true,

      recoveryAllowed:
        true,

      bankrollExposureAllowed:
        true,
    });
  }


  private validateInput(
    input:
      PaperCapitalPreservationInput,
  ): void {
    if (
      !Number.isFinite(
        input.initialBankroll,
      ) ||
      input.initialBankroll <= 0
    ) {
      throw new Error(
        'capital_preservation_invalid_initial_bankroll',
      );
    }

    if (
      !Number.isFinite(
        input.currentBankroll,
      ) ||
      input.currentBankroll < 0
    ) {
      throw new Error(
        'capital_preservation_invalid_current_bankroll',
      );
    }

    if (
      !Number.isFinite(
        input.peakBankroll,
      ) ||
      input.peakBankroll <= 0
    ) {
      throw new Error(
        'capital_preservation_invalid_peak_bankroll',
      );
    }

    if (
      input.peakBankroll <
      input.currentBankroll
    ) {
      throw new Error(
        'capital_preservation_peak_below_current_bankroll',
      );
    }

    if (
      input.peakBankroll <
      input.initialBankroll
    ) {
      throw new Error(
        'capital_preservation_peak_below_initial_bankroll',
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
        'capital_preservation_invalid_risk_mode',
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
