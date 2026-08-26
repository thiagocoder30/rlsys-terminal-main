import {
  PaperCapitalPreservationGuard,
  type PaperCapitalPreservationReport,
  type PaperCapitalRiskMode,
} from './PaperCapitalPreservationGuard.js';

import {
  PaperStakeRecommendationResolver,
  type PaperStakeRecommendation,
} from './PaperStakeRecommendationResolver.js';

import {
  ControlledRecoveryEngine,
  type ControlledRecoveryReport,
} from './ControlledRecoveryEngine.js';

import {
  PaperRecoveryLedger,
  type PaperRecoveryLedgerSnapshot,
} from './PaperRecoveryLedger.js';


export type PaperInstitutionalStakeDecision =
  | 'BASE_STAKE'
  | 'RECOVERY_STAKE'
  | 'STAKE_BLOCKED'
  | 'CAPITAL_STOP';


export type PaperInstitutionalFinancialSettlement =
  | 'WIN'
  | 'LOSS'
  | 'ZERO_LOSS'
  | 'NO_EXPOSURE';


export type PaperInstitutionalOperatorDecision =
  | 'FOLLOWED'
  | 'IGNORED'
  | 'UNDECIDED';


export interface PaperInstitutionalRecoveryConfiguration {
  readonly initialBankroll:
    number;

  readonly riskMode:
    PaperCapitalRiskMode;

  readonly minimumStake:
    number;

  readonly martingaleEnabled:
    boolean;
}


export interface PaperInstitutionalExternalCapitalState {
  readonly currentBankroll:
    number;

  readonly peakBankroll:
    number;
}


export interface PaperInstitutionalStakeRecommendation {
  readonly decision:
    PaperInstitutionalStakeDecision;

  readonly capital:
    PaperCapitalPreservationReport;

  readonly baseStake:
    PaperStakeRecommendation | null;

  readonly recovery:
    ControlledRecoveryReport | null;

  readonly suggestedStake:
    number | null;

  readonly baseStakeAmount:
    number | null;

  readonly recoveryComponent:
    number;

  readonly currentBankroll:
    number;

  readonly peakBankroll:
    number;

  readonly pendingLossDebt:
    number;

  readonly martingaleEnabled:
    boolean;

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


export interface PaperInstitutionalSettlementInput {
  readonly operatorDecision:
    PaperInstitutionalOperatorDecision;

  /**
   * Strategy-level prospective result.
   *
   * Triplicação:
   * WIN / LOSS / VOID
   */
  readonly statisticalResult:
    'WIN' | 'LOSS' | 'VOID';

  /**
   * Needed because Triplicação considers zero a statistical VOID,
   * while an actually followed RED/BLACK entry loses financially.
   */
  readonly thirdColor:
    'RED' | 'BLACK' | 'ZERO';

  readonly suggestedStake:
    number;

  readonly recoveryComponent:
    number;
}


export interface PaperInstitutionalSettlementReport {
  readonly financialSettlement:
    PaperInstitutionalFinancialSettlement;

  readonly bankrollBefore:
    number;

  readonly bankrollDelta:
    number;

  readonly bankrollAfter:
    number;

  readonly peakBankroll:
    number;

  readonly drawdownFraction:
    number;

  readonly recoveryLedger:
    PaperRecoveryLedgerSnapshot;

  readonly capital:
    PaperCapitalPreservationReport;

  readonly recommendationOnly: true;

  readonly humanExecutionRequired: true;

  readonly automaticBetExecutionAllowed: false;
}


/**
 * Session-level financial authority for supervised PAPER operation.
 *
 * Hierarchy:
 *
 *   Capital Preservation
 *        ↓
 *   Base Stake Resolver
 *        ↓
 *   Controlled Recovery
 *        ↓
 *   Human recommendation
 *
 * Capital preservation is sovereign.
 *
 * If Capital Preservation says STOP:
 * - no strategy recommendation may create financial exposure;
 * - recovery is blocked;
 * - Martingale configuration becomes irrelevant.
 *
 * CAUTION:
 * - base stake may remain available;
 * - recovery is disabled.
 *
 * Martingale ON means only:
 * "controlled recovery may be considered if all higher-level
 * capital-preservation gates permit it."
 *
 * This controller NEVER performs an external bet.
 */
export class PaperInstitutionalRecoveryController {
  private readonly initialBankroll:
    number;

  private currentBankroll:
    number;

  private peakBankroll:
    number;

  private readonly riskMode:
    PaperCapitalRiskMode;

  private readonly minimumStake:
    number;

  private readonly martingaleEnabled:
    boolean;


  public constructor(
    configuration:
      PaperInstitutionalRecoveryConfiguration,

    private readonly capitalGuard:
      PaperCapitalPreservationGuard =
        new PaperCapitalPreservationGuard(),

    private readonly stakeResolver:
      PaperStakeRecommendationResolver =
        new PaperStakeRecommendationResolver(),

    private readonly recoveryEngine:
      ControlledRecoveryEngine =
        new ControlledRecoveryEngine(),

    private readonly recoveryLedger:
      PaperRecoveryLedger =
        new PaperRecoveryLedger(),
  ) {
    this.validateConfiguration(
      configuration,
    );

    this.initialBankroll =
      this.money(
        configuration.initialBankroll,
      );

    this.currentBankroll =
      this.initialBankroll;

    this.peakBankroll =
      this.initialBankroll;

    this.riskMode =
      configuration.riskMode;

    this.minimumStake =
      configuration.minimumStake;

    this.martingaleEnabled =
      configuration.martingaleEnabled;
  }


  public recommend(
    strategyRiskScore:
      number,

    externalCapitalState?:
      PaperInstitutionalExternalCapitalState,
  ): PaperInstitutionalStakeRecommendation {
    this.validateRisk(
      strategyRiskScore,
    );

    const financialState =
      this.resolveFinancialState(
        externalCapitalState,
      );

    const capital =
      this.evaluateCapitalFrom(
        financialState,
      );

    const ledger =
      this.recoveryLedger.snapshot();

    if (
      capital.decision ===
      'STOP'
    ) {
      return this.recommendationResult({
        decision:
          'CAPITAL_STOP',

        capital,

        baseStake:
          null,

        recovery:
          null,

        suggestedStake:
          null,

        baseStakeAmount:
          null,

        recoveryComponent:
          0,

        reasons: [
          `CAPITAL_STOP_REASON:${capital.stopReason}`,
        ],

        warnings:
          capital.warnings,

        blockers:
          capital.blockers,
      });
    }

    const baseStake =
      this.stakeResolver.resolve({
        bankroll:
          financialState.currentBankroll,

        riskMode:
          this.riskMode,

        minimumStake:
          this.minimumStake,

        strategyRiskScore,
      });

    if (
      baseStake.status ===
        'BLOCKED' ||
      baseStake.suggestedStake ===
        null
    ) {
      return this.recommendationResult({
        decision:
          'STAKE_BLOCKED',

        capital,

        baseStake,

        recovery:
          null,

        suggestedStake:
          null,

        baseStakeAmount:
          null,

        recoveryComponent:
          0,

        reasons:
          baseStake.reasons,

        warnings: [
          ...capital.warnings,
        ],

        blockers:
          baseStake.blockers,
      });
    }

    /*
     * CAUTION has authority over Martingale.
     *
     * We still allow the safe base stake because that is the
     * explicit semantics currently defined by Capital Preservation.
     */
    if (
      !capital.recoveryAllowed ||
      !this.martingaleEnabled ||
      ledger.pendingLossDebt <=
        0
    ) {
      return this.recommendationResult({
        decision:
          'BASE_STAKE',

        capital,

        baseStake,

        recovery:
          null,

        suggestedStake:
          baseStake.suggestedStake,

        baseStakeAmount:
          baseStake.suggestedStake,

        recoveryComponent:
          0,

        reasons: [
          ...baseStake.reasons,

          ...(
            !this.martingaleEnabled
              ? [
                  'RECOVERY_DISABLED_MARTINGALE_OFF',
                ]
              : []
          ),

          ...(
            !capital.recoveryAllowed
              ? [
                  'RECOVERY_DISABLED_BY_CAPITAL_PRESERVATION',
                ]
              : []
          ),

          ...(
            ledger.pendingLossDebt <=
            0
              ? [
                  'RECOVERY_NO_PENDING_DEBT',
                ]
              : []
          ),
        ],

        warnings:
          capital.warnings,

        blockers: [],
      });
    }

    const recovery =
      this.recoveryEngine.evaluate({
        bankroll:
          financialState.currentBankroll,

        riskMode:
          this.riskMode,

        martingaleEnabled:
          this.martingaleEnabled,

        baseStake:
          baseStake.suggestedStake,

        pendingLossDebt:
          ledger.pendingLossDebt,

        strategyRiskScore,

        drawdownFraction:
          capital.drawdownFraction,

        minimumStake:
          this.minimumStake,
      });

    if (
      recovery.decision ===
        'BLOCKED' ||
      recovery.suggestedStake ===
        null
    ) {
      /*
       * Recovery block does not automatically destroy an otherwise
       * valid base recommendation.
       *
       * Capital STOP is the only sovereign full-stop above.
       */
      return this.recommendationResult({
        decision:
          'BASE_STAKE',

        capital,

        baseStake,

        recovery,

        suggestedStake:
          baseStake.suggestedStake,

        baseStakeAmount:
          baseStake.suggestedStake,

        recoveryComponent:
          0,

        reasons: [
          ...baseStake.reasons,
          'RECOVERY_BLOCKED_FALLBACK_TO_BASE_STAKE',
        ],

        warnings: [
          ...capital.warnings,
          ...recovery.warnings,
          ...recovery.blockers,
        ],

        blockers: [],
      });
    }

    if (
      recovery.recoveryComponent <=
      0
    ) {
      return this.recommendationResult({
        decision:
          'BASE_STAKE',

        capital,

        baseStake,

        recovery,

        suggestedStake:
          baseStake.suggestedStake,

        baseStakeAmount:
          baseStake.suggestedStake,

        recoveryComponent:
          0,

        reasons: [
          ...baseStake.reasons,
          ...recovery.reasons,
        ],

        warnings: [
          ...capital.warnings,
          ...recovery.warnings,
        ],

        blockers: [],
      });
    }

    return this.recommendationResult({
      decision:
        'RECOVERY_STAKE',

      capital,

      baseStake,

      recovery,

      suggestedStake:
        recovery.suggestedStake,

      baseStakeAmount:
        baseStake.suggestedStake,

      recoveryComponent:
        recovery.recoveryComponent,

      reasons: [
        ...baseStake.reasons,
        ...recovery.reasons,
      ],

      warnings: [
        ...capital.warnings,
        ...recovery.warnings,
      ],

      blockers: [],
    });
  }


  public settle(
    input:
      PaperInstitutionalSettlementInput,

    externalCapitalState?:
      PaperInstitutionalExternalCapitalState,
  ): PaperInstitutionalSettlementReport {
    this.validateSettlementInput(
      input,
    );

    const financialState =
      this.resolveFinancialState(
        externalCapitalState,
      );

    const bankrollBefore =
      financialState.currentBankroll;

    if (
      input.operatorDecision !==
      'FOLLOWED'
    ) {
      const recoveryLedger =
        this.recoveryLedger.apply({
          settlement:
            'NO_EXPOSURE',

          stake:
            0,

          recoveryComponent:
            0,
        });

      const capital =
        this.evaluateCapitalFrom(
          financialState,
        );

      return Object.freeze({
        financialSettlement:
          'NO_EXPOSURE' as const,

        bankrollBefore,

        bankrollDelta:
          0,

        bankrollAfter:
          financialState.currentBankroll,

        peakBankroll:
          financialState.peakBankroll,

        drawdownFraction:
          capital.drawdownFraction,

        recoveryLedger,

        capital,

        recommendationOnly:
          true as const,

        humanExecutionRequired:
          true as const,

        automaticBetExecutionAllowed:
          false as const,
      });
    }

    const financialSettlement =
      this.resolveFinancialSettlement(
        input,
      );

    const bankrollDelta =
      financialSettlement ===
      'WIN'
        ? input.suggestedStake
        : -input.suggestedStake;

    const bankrollAfter =
      this.money(
        bankrollBefore +
        bankrollDelta,
      );

    if (
      bankrollAfter <
      0
    ) {
      throw new Error(
        'institutional_recovery_bankroll_negative',
      );
    }

    const peakBankroll =
      this.money(
        Math.max(
          financialState.peakBankroll,
          bankrollAfter,
        ),
      );

    /*
     * Backward-compatible legacy mode.
     *
     * Once the prospective Portfolio becomes the sole session
     * authority, callers will always supply externalCapitalState
     * and these internal fields will no longer mutate.
     */
    if (
      externalCapitalState ===
      undefined
    ) {
      this.currentBankroll =
        bankrollAfter;

      this.peakBankroll =
        peakBankroll;
    }

    const recoveryLedger =
      this.recoveryLedger.apply({
        settlement:
          financialSettlement,

        stake:
          input.suggestedStake,

        recoveryComponent:
          financialSettlement ===
            'WIN'
            ? input.recoveryComponent
            : 0,
      });

    const capital =
      this.evaluateCapitalFrom({
        currentBankroll:
          bankrollAfter,

        peakBankroll,
      });

    return Object.freeze({
      financialSettlement,

      bankrollBefore,

      bankrollDelta:
        this.money(
          bankrollDelta,
        ),

      bankrollAfter,

      peakBankroll,

      drawdownFraction:
        capital.drawdownFraction,

      recoveryLedger,

      capital,

      recommendationOnly:
        true as const,

      humanExecutionRequired:
        true as const,

      automaticBetExecutionAllowed:
        false as const,
    });
  }


  public snapshot(): {
    readonly initialBankroll:
      number;

    readonly currentBankroll:
      number;

    readonly peakBankroll:
      number;

    readonly riskMode:
      PaperCapitalRiskMode;

    readonly minimumStake:
      number;

    readonly martingaleEnabled:
      boolean;

    readonly recoveryLedger:
      PaperRecoveryLedgerSnapshot;

    readonly capital:
      PaperCapitalPreservationReport;

    readonly recommendationOnly: true;

    readonly humanExecutionRequired: true;

    readonly automaticBetExecutionAllowed: false;
  } {
    return Object.freeze({
      initialBankroll:
        this.initialBankroll,

      currentBankroll:
        this.currentBankroll,

      peakBankroll:
        this.peakBankroll,

      riskMode:
        this.riskMode,

      minimumStake:
        this.minimumStake,

      martingaleEnabled:
        this.martingaleEnabled,

      recoveryLedger:
        this.recoveryLedger.snapshot(),

      capital:
        this.evaluateCapital(),

      recommendationOnly:
        true as const,

      humanExecutionRequired:
        true as const,

      automaticBetExecutionAllowed:
        false as const,
    });
  }


  private resolveFinancialSettlement(
    input:
      PaperInstitutionalSettlementInput,
  ): Exclude<
    PaperInstitutionalFinancialSettlement,
    'NO_EXPOSURE'
  > {
    if (
      input.statisticalResult ===
      'WIN'
    ) {
      return 'WIN';
    }

    if (
      input.statisticalResult ===
      'LOSS'
    ) {
      return 'LOSS';
    }

    if (
      input.thirdColor ===
      'ZERO'
    ) {
      return 'ZERO_LOSS';
    }

    throw new Error(
      'institutional_recovery_void_without_zero',
    );
  }


  private evaluateCapital():
    PaperCapitalPreservationReport {
    return this.evaluateCapitalFrom({
      currentBankroll:
        this.currentBankroll,

      peakBankroll:
        this.peakBankroll,
    });
  }


  private evaluateCapitalFrom(
    state:
      PaperInstitutionalExternalCapitalState,
  ): PaperCapitalPreservationReport {
    return this.capitalGuard.evaluate({
      initialBankroll:
        this.initialBankroll,

      currentBankroll:
        state.currentBankroll,

      peakBankroll:
        state.peakBankroll,

      riskMode:
        this.riskMode,
    });
  }


  private resolveFinancialState(
    externalCapitalState:
      PaperInstitutionalExternalCapitalState | undefined,
  ): PaperInstitutionalExternalCapitalState {
    if (
      externalCapitalState ===
      undefined
    ) {
      return Object.freeze({
        currentBankroll:
          this.currentBankroll,

        peakBankroll:
          this.peakBankroll,
      });
    }

    if (
      !Number.isFinite(
        externalCapitalState.currentBankroll,
      ) ||
      externalCapitalState.currentBankroll <=
        0
    ) {
      throw new Error(
        'institutional_recovery_invalid_external_bankroll',
      );
    }

    if (
      !Number.isFinite(
        externalCapitalState.peakBankroll,
      ) ||
      externalCapitalState.peakBankroll <
        externalCapitalState.currentBankroll
    ) {
      throw new Error(
        'institutional_recovery_invalid_external_peak_bankroll',
      );
    }

    return Object.freeze({
      currentBankroll:
        this.money(
          externalCapitalState.currentBankroll,
        ),

      peakBankroll:
        this.money(
          externalCapitalState.peakBankroll,
        ),
    });
  }


  private recommendationResult(
    input: {
      readonly decision:
        PaperInstitutionalStakeDecision;

      readonly capital:
        PaperCapitalPreservationReport;

      readonly baseStake:
        PaperStakeRecommendation | null;

      readonly recovery:
        ControlledRecoveryReport | null;

      readonly suggestedStake:
        number | null;

      readonly baseStakeAmount:
        number | null;

      readonly recoveryComponent:
        number;

      readonly reasons:
        readonly string[];

      readonly warnings:
        readonly string[];

      readonly blockers:
        readonly string[];
    },
  ): PaperInstitutionalStakeRecommendation {
    return Object.freeze({
      decision:
        input.decision,

      capital:
        input.capital,

      baseStake:
        input.baseStake,

      recovery:
        input.recovery,

      suggestedStake:
        input.suggestedStake,

      baseStakeAmount:
        input.baseStakeAmount,

      recoveryComponent:
        input.recoveryComponent,

      currentBankroll:
        input.capital.currentBankroll,

      peakBankroll:
        input.capital.peakBankroll,

      pendingLossDebt:
        this.recoveryLedger
          .snapshot()
          .pendingLossDebt,

      martingaleEnabled:
        this.martingaleEnabled,

      reasons:
        Object.freeze([
          ...input.reasons,
        ]),

      warnings:
        Object.freeze([
          ...input.warnings,
        ]),

      blockers:
        Object.freeze([
          ...input.blockers,
        ]),

      recommendationOnly:
        true as const,

      humanExecutionRequired:
        true as const,

      automaticBetExecutionAllowed:
        false as const,
    });
  }


  private validateConfiguration(
    input:
      PaperInstitutionalRecoveryConfiguration,
  ): void {
    if (
      !Number.isFinite(
        input.initialBankroll,
      ) ||
      input.initialBankroll <=
      0
    ) {
      throw new Error(
        'institutional_recovery_invalid_initial_bankroll',
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
        'institutional_recovery_invalid_risk_mode',
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
        'institutional_recovery_invalid_minimum_stake',
      );
    }
  }


  private validateRisk(
    value:
      number,
  ): void {
    if (
      !Number.isFinite(
        value,
      ) ||
      value < 0 ||
      value > 1
    ) {
      throw new Error(
        'institutional_recovery_invalid_strategy_risk',
      );
    }
  }


  private validateSettlementInput(
    input:
      PaperInstitutionalSettlementInput,
  ): void {
    if (
      input.operatorDecision !==
        'FOLLOWED' &&
      input.operatorDecision !==
        'IGNORED' &&
      input.operatorDecision !==
        'UNDECIDED'
    ) {
      throw new Error(
        'institutional_recovery_invalid_operator_decision',
      );
    }

    if (
      input.statisticalResult !==
        'WIN' &&
      input.statisticalResult !==
        'LOSS' &&
      input.statisticalResult !==
        'VOID'
    ) {
      throw new Error(
        'institutional_recovery_invalid_statistical_result',
      );
    }

    if (
      !Number.isFinite(
        input.suggestedStake,
      ) ||
      input.suggestedStake <=
      0
    ) {
      throw new Error(
        'institutional_recovery_invalid_stake',
      );
    }

    if (
      !Number.isFinite(
        input.recoveryComponent,
      ) ||
      input.recoveryComponent < 0 ||
      input.recoveryComponent >
      input.suggestedStake
    ) {
      throw new Error(
        'institutional_recovery_invalid_recovery_component',
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
}
