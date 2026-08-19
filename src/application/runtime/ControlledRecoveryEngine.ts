export type ControlledRecoveryRiskMode =
  | 'conservative'
  | 'moderate'
  | 'aggressive';


export type ControlledRecoveryDecision =
  | 'NO_RECOVERY'
  | 'BASE_STAKE_ONLY'
  | 'RECOVERY_ALLOWED'
  | 'RECOVERY_REDUCED'
  | 'BLOCKED';


export interface ControlledRecoveryInput {
  readonly bankroll:
    number;

  readonly riskMode:
    ControlledRecoveryRiskMode;

  readonly martingaleEnabled:
    boolean;

  /**
   * Safe stake already calculated by PaperStakeRecommendationResolver.
   */
  readonly baseStake:
    number;

  /**
   * Outstanding PAPER loss that may be recovered gradually.
   *
   * This is session-level debt, not strategy-level debt.
   */
  readonly pendingLossDebt:
    number;

  /**
   * Current strategy risk normalized to 0..1.
   */
  readonly strategyRiskScore:
    number;

  /**
   * Current session drawdown normalized to 0..1.
   *
   * Example:
   * 0.08 = 8% drawdown from session peak.
   */
  readonly drawdownFraction:
    number;

  readonly minimumStake:
    number;
}


export interface ControlledRecoveryReport {
  readonly decision:
    ControlledRecoveryDecision;

  readonly bankroll:
    number;

  readonly riskMode:
    ControlledRecoveryRiskMode;

  readonly martingaleEnabled:
    boolean;

  readonly baseStake:
    number;

  readonly pendingLossDebt:
    number;

  readonly maximumRecoveryExposureFraction:
    number;

  readonly maximumRecoveryStake:
    number;

  readonly suggestedStake:
    number | null;

  readonly recoveryComponent:
    number;

  readonly remainingLossDebtIfWin:
    number;

  readonly strategyRiskScore:
    number;

  readonly drawdownFraction:
    number;

  readonly reasons:
    readonly string[];

  readonly warnings:
    readonly string[];

  readonly blockers:
    readonly string[];

  readonly recommendationOnly: true;

  readonly humanExecutionRequired: true;

  readonly automaticBetExecutionAllowed: false;
}


interface ControlledRecoveryPolicy {
  readonly maximumRecoveryExposureFraction:
    number;

  readonly maximumStrategyRisk:
    number;

  readonly drawdownCautionThreshold:
    number;

  readonly drawdownBlockThreshold:
    number;
}


const POLICY:
  Readonly<
    Record<
      ControlledRecoveryRiskMode,
      ControlledRecoveryPolicy
    >
  > =
    Object.freeze({
      conservative:
        Object.freeze({
          maximumRecoveryExposureFraction:
            0.015,

          maximumStrategyRisk:
            0.30,

          drawdownCautionThreshold:
            0.05,

          drawdownBlockThreshold:
            0.10,
        }),

      moderate:
        Object.freeze({
          maximumRecoveryExposureFraction:
            0.03,

          maximumStrategyRisk:
            0.42,

          drawdownCautionThreshold:
            0.08,

          drawdownBlockThreshold:
            0.15,
        }),

      aggressive:
        Object.freeze({
          maximumRecoveryExposureFraction:
            0.045,

          maximumStrategyRisk:
            0.55,

          drawdownCautionThreshold:
            0.10,

          drawdownBlockThreshold:
            0.20,
        }),
    });


/**
 * Controlled recovery for supervised PAPER operation.
 *
 * This is NOT classical Martingale.
 *
 * Important invariants:
 *
 * 1. A prior loss never causes an automatic new recommendation.
 * 2. Recovery exists only when another strategy opportunity exists.
 * 3. Martingale OFF disables recovery completely.
 * 4. Recovery stake is bounded by current bankroll.
 * 5. High strategy risk blocks recovery.
 * 6. Excessive drawdown blocks recovery.
 * 7. Recovery may be partial; debt does not have to be recovered at once.
 * 8. Nothing here executes a bet.
 *
 * For an even-money RED/BLACK opportunity:
 *
 * expected gross profit after a successful followed spin is
 * approximately equal to stake.
 *
 * Therefore:
 *
 * recoveryComponent =
 *   suggestedStake - baseStake
 *
 * and remainingLossDebtIfWin represents how much historical loss
 * would remain after the additional recovery component succeeds.
 *
 * This model is intentionally conservative and must be calibrated
 * prospectively before any production interpretation.
 */
export class ControlledRecoveryEngine {
  public evaluate(
    input:
      ControlledRecoveryInput,
  ): ControlledRecoveryReport {
    this.validateInput(
      input,
    );

    const policy =
      POLICY[
        input.riskMode
      ];

    const maximumRecoveryStake =
      this.floorToIncrement(
        input.bankroll *
        policy.maximumRecoveryExposureFraction,
        input.minimumStake,
      );

    const base =
      {
        bankroll:
          this.money(
            input.bankroll,
          ),

        riskMode:
          input.riskMode,

        martingaleEnabled:
          input.martingaleEnabled,

        baseStake:
          this.money(
            input.baseStake,
          ),

        pendingLossDebt:
          this.money(
            input.pendingLossDebt,
          ),

        maximumRecoveryExposureFraction:
          policy.maximumRecoveryExposureFraction,

        maximumRecoveryStake,

        strategyRiskScore:
          input.strategyRiskScore,

        drawdownFraction:
          input.drawdownFraction,

        recommendationOnly:
          true as const,

        humanExecutionRequired:
          true as const,

        automaticBetExecutionAllowed:
          false as const,
      };

    if (
      input.pendingLossDebt <=
      0
    ) {
      return Object.freeze({
        ...base,

        decision:
          'NO_RECOVERY' as const,

        suggestedStake:
          this.money(
            input.baseStake,
          ),

        recoveryComponent:
          0,

        remainingLossDebtIfWin:
          0,

        reasons:
          Object.freeze([
            'RECOVERY_NO_PENDING_LOSS_DEBT',
          ]),

        warnings:
          Object.freeze([]),

        blockers:
          Object.freeze([]),
      });
    }

    if (
      !input.martingaleEnabled
    ) {
      return Object.freeze({
        ...base,

        decision:
          'BASE_STAKE_ONLY' as const,

        suggestedStake:
          this.money(
            input.baseStake,
          ),

        recoveryComponent:
          0,

        remainingLossDebtIfWin:
          this.money(
            input.pendingLossDebt,
          ),

        reasons:
          Object.freeze([
            'RECOVERY_DISABLED_BY_OPERATOR_CONFIGURATION',
          ]),

        warnings:
          Object.freeze([
            'PENDING_LOSS_DEBT_NOT_RECOVERED',
          ]),

        blockers:
          Object.freeze([]),
      });
    }

    if (
      input.drawdownFraction >=
      policy.drawdownBlockThreshold
    ) {
      return Object.freeze({
        ...base,

        decision:
          'BLOCKED' as const,

        suggestedStake:
          null,

        recoveryComponent:
          0,

        remainingLossDebtIfWin:
          this.money(
            input.pendingLossDebt,
          ),

        reasons:
          Object.freeze([
            `DRAWDOWN:${input.drawdownFraction}`,
            `DRAWDOWN_BLOCK_THRESHOLD:${policy.drawdownBlockThreshold}`,
          ]),

        warnings:
          Object.freeze([]),

        blockers:
          Object.freeze([
            'RECOVERY_DRAWDOWN_LIMIT_REACHED',
          ]),
      });
    }

    if (
      input.strategyRiskScore >
      policy.maximumStrategyRisk
    ) {
      return Object.freeze({
        ...base,

        decision:
          'BASE_STAKE_ONLY' as const,

        suggestedStake:
          this.money(
            input.baseStake,
          ),

        recoveryComponent:
          0,

        remainingLossDebtIfWin:
          this.money(
            input.pendingLossDebt,
          ),

        reasons:
          Object.freeze([
            `STRATEGY_RISK:${input.strategyRiskScore}`,
            `MAX_RECOVERY_STRATEGY_RISK:${policy.maximumStrategyRisk}`,
          ]),

        warnings:
          Object.freeze([
            'RECOVERY_SUPPRESSED_BY_STRATEGY_RISK',
          ]),

        blockers:
          Object.freeze([]),
      });
    }

    if (
      maximumRecoveryStake <
      input.baseStake
    ) {
      return Object.freeze({
        ...base,

        decision:
          'BASE_STAKE_ONLY' as const,

        suggestedStake:
          this.money(
            input.baseStake,
          ),

        recoveryComponent:
          0,

        remainingLossDebtIfWin:
          this.money(
            input.pendingLossDebt,
          ),

        reasons:
          Object.freeze([
            'RECOVERY_BUDGET_BELOW_BASE_STAKE',
          ]),

        warnings:
          Object.freeze([
            'RECOVERY_CAPACITY_UNAVAILABLE',
          ]),

        blockers:
          Object.freeze([]),
      });
    }

    const availableRecoveryCapacity =
      this.money(
        maximumRecoveryStake -
        input.baseStake,
      );

    if (
      availableRecoveryCapacity <=
      0
    ) {
      return Object.freeze({
        ...base,

        decision:
          'BASE_STAKE_ONLY' as const,

        suggestedStake:
          this.money(
            input.baseStake,
          ),

        recoveryComponent:
          0,

        remainingLossDebtIfWin:
          this.money(
            input.pendingLossDebt,
          ),

        reasons:
          Object.freeze([
            'RECOVERY_NO_ADDITIONAL_EXPOSURE_CAPACITY',
          ]),

        warnings:
          Object.freeze([]),

        blockers:
          Object.freeze([]),
      });
    }

    /*
     * Recover historical debt gradually.
     *
     * We never add more recovery exposure than:
     *
     * - pending loss debt;
     * - current recovery exposure budget.
     */
    const requestedRecoveryComponent =
      Math.min(
        input.pendingLossDebt,
        availableRecoveryCapacity,
      );

    const rawSuggestedStake =
      input.baseStake +
      requestedRecoveryComponent;

    const suggestedStake =
      this.floorToIncrement(
        Math.min(
          rawSuggestedStake,
          maximumRecoveryStake,
        ),
        input.minimumStake,
      );

    const recoveryComponent =
      this.money(
        Math.max(
          0,
          suggestedStake -
          input.baseStake,
        ),
      );

    if (
      recoveryComponent <=
      0
    ) {
      return Object.freeze({
        ...base,

        decision:
          'BASE_STAKE_ONLY' as const,

        suggestedStake:
          this.money(
            input.baseStake,
          ),

        recoveryComponent:
          0,

        remainingLossDebtIfWin:
          this.money(
            input.pendingLossDebt,
          ),

        reasons:
          Object.freeze([
            'RECOVERY_INCREMENT_TOO_SMALL_FOR_PROVIDER_CHIP',
          ]),

        warnings:
          Object.freeze([]),

        blockers:
          Object.freeze([]),
      });
    }

    const remainingLossDebtIfWin =
      this.money(
        Math.max(
          0,
          input.pendingLossDebt -
          recoveryComponent,
        ),
      );

    const fullRecovery =
      remainingLossDebtIfWin ===
      0;

    const warnings:
      string[] = [];

    if (
      input.drawdownFraction >=
      policy.drawdownCautionThreshold
    ) {
      warnings.push(
        'RECOVERY_DRAWDOWN_CAUTION',
      );
    }

    if (
      !fullRecovery
    ) {
      warnings.push(
        'RECOVERY_PARTIAL_ONLY',
      );
    }

    return Object.freeze({
      ...base,

      decision:
        fullRecovery
          ? 'RECOVERY_ALLOWED' as const
          : 'RECOVERY_REDUCED' as const,

      suggestedStake,

      recoveryComponent,

      remainingLossDebtIfWin,

      reasons:
        Object.freeze([
          `BASE_STAKE:${input.baseStake}`,
          `PENDING_LOSS_DEBT:${input.pendingLossDebt}`,
          `RECOVERY_CAPACITY:${availableRecoveryCapacity}`,
          `RECOVERY_COMPONENT:${recoveryComponent}`,
          `RECOVERY_STAKE:${suggestedStake}`,
        ]),

      warnings:
        Object.freeze(
          warnings,
        ),

      blockers:
        Object.freeze([]),
    });
  }


  private validateInput(
    input:
      ControlledRecoveryInput,
  ): void {
    if (
      !Number.isFinite(
        input.bankroll,
      ) ||
      input.bankroll <= 0
    ) {
      throw new Error(
        'controlled_recovery_invalid_bankroll',
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
        'controlled_recovery_invalid_risk_mode',
      );
    }

    if (
      !Number.isFinite(
        input.baseStake,
      ) ||
      input.baseStake <= 0
    ) {
      throw new Error(
        'controlled_recovery_invalid_base_stake',
      );
    }

    if (
      !Number.isFinite(
        input.pendingLossDebt,
      ) ||
      input.pendingLossDebt < 0
    ) {
      throw new Error(
        'controlled_recovery_invalid_loss_debt',
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
        'controlled_recovery_invalid_strategy_risk',
      );
    }

    if (
      !Number.isFinite(
        input.drawdownFraction,
      ) ||
      input.drawdownFraction < 0 ||
      input.drawdownFraction > 1
    ) {
      throw new Error(
        'controlled_recovery_invalid_drawdown',
      );
    }

    if (
      !Number.isFinite(
        input.minimumStake,
      ) ||
      input.minimumStake <= 0
    ) {
      throw new Error(
        'controlled_recovery_invalid_minimum_stake',
      );
    }
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


  private money(
    value:
      number,
  ): number {
    return Math.round(
      value *
      100,
    ) / 100;
  }
}
