import {
  TriplicacaoAdvancedProbabilityEngine,
  type TriplicacaoAdvancedProbabilityAnalysis,
  type TriplicacaoAdvancedProbabilityOptions,
} from '../../domain/analytics/TriplicacaoAdvancedProbabilityEngine.js';

import {
  TriplicacaoActionSemantics,
  type TriplicacaoActionColor,
} from './TriplicacaoActionSemantics.js';

import {
  PaperStakeRecommendationResolver,
} from './PaperStakeRecommendationResolver.js';

import {
  ControlledRecoveryEngine,
  type ControlledRecoveryReport,
} from './ControlledRecoveryEngine.js';

import {
  PaperRecoveryLedger,
  type PaperRecoveryLedgerSnapshot,
} from './PaperRecoveryLedger.js';

import type {
  HistoricalShadowDecision,
  HistoricalShadowExecutableTrade,
  HistoricalShadowFinancialContext,
  HistoricalShadowSettlement,
  HistoricalShadowStrategyAdapter,
} from './HistoricalShadowReplayEngine.js';


export interface TriplicacaoShadowAdapterConfiguration {
  readonly analysisOptions?:
    TriplicacaoAdvancedProbabilityOptions;

  readonly martingaleEnabled?:
    boolean;
}


export interface TriplicacaoShadowDecisionMetadata
  extends Readonly<Record<string, unknown>> {

  readonly selectedPatternKind:
    string;

  readonly firstNumber:
    number;

  readonly secondNumber:
    number;

  readonly targetColor:
    TriplicacaoActionColor;

  readonly confidenceScore:
    number;

  readonly evidenceScore:
    number;

  readonly riskScore:
    number;

  readonly probabilityMode:
    'PAPER_ONLY';
}


export interface TriplicacaoShadowTradeMetadata
  extends Readonly<Record<string, unknown>> {

  readonly selectedPatternKind:
    string;

  readonly firstNumber:
    number;

  readonly secondNumber:
    number;

  readonly targetColor:
    TriplicacaoActionColor;

  readonly baseStakeAmount:
    number;

  readonly recoveryComponent:
    number;

  readonly pendingLossDebtBefore:
    number;

  readonly recovery:
    ControlledRecoveryReport | null;

  readonly confidenceScore:
    number;

  readonly evidenceScore:
    number;

  readonly riskScore:
    number;
}


/**
 * Historical SHADOW adapter for Triplicação.
 *
 * Temporal doctrine:
 *
 *   fixed trio:
 *
 *   first
 *     ↓
 *   second
 *     ↓
 *   decision boundary
 *     ↓
 *   third = settlement
 *
 * Only prefixes whose length % 3 === 2 can create an entry.
 *
 * Financial doctrine:
 *
 * - HistoricalShadowReplayEngine remains sovereign owner of bankroll;
 * - PaperStakeRecommendationResolver owns base exposure;
 * - ControlledRecoveryEngine owns optional controlled recovery;
 * - PaperRecoveryLedger owns recovery debt;
 * - this adapter never mutates real bankroll;
 * - this adapter never executes a bet.
 */
export class TriplicacaoShadowAdapter
  implements HistoricalShadowStrategyAdapter {

  public readonly strategyId =
    'triplicacao';

  /**
   * 12 valid completed trios + opening pair of prospective trio.
   *
   * Zero-discarded historical trios may require more than 38 spins
   * before AdvancedProbability actually becomes eligible.
   */
  public readonly minimumHistorySize =
    38;

  private readonly analysisOptions:
    TriplicacaoAdvancedProbabilityOptions;

  private readonly martingaleEnabled:
    boolean;


  public constructor(
    configuration:
      TriplicacaoShadowAdapterConfiguration = {},

    private readonly probabilityEngine:
      TriplicacaoAdvancedProbabilityEngine =
        new TriplicacaoAdvancedProbabilityEngine(),

    private readonly actionSemantics:
      TriplicacaoActionSemantics =
        new TriplicacaoActionSemantics(),

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
    this.analysisOptions =
      Object.freeze({
        ...configuration.analysisOptions,
      });

    this.martingaleEnabled =
      configuration.martingaleEnabled ??
      false;
  }


  public evaluate(
    visibleHistory:
      readonly number[],
  ): HistoricalShadowDecision | null {
    /*
     * Fixed trio alignment.
     *
     * 0,1,2 = trio
     * 3,4,5 = trio
     *
     * Decision exists only after positions:
     *
     * 0,1
     * 3,4
     * 6,7
     *
     * Therefore visible history size must be 2 modulo 3.
     */
    if (
      visibleHistory.length %
      3 !==
      2
    ) {
      return null;
    }

    if (
      visibleHistory.length <
      this.minimumHistorySize
    ) {
      return null;
    }

    const firstNumber =
      visibleHistory[
        visibleHistory.length -
        2
      ];

    const secondNumber =
      visibleHistory[
        visibleHistory.length -
        1
      ];

    /*
     * Zero opening invalidates the fixed trio.
     *
     * ActionSemantics also enforces this, but the explicit boundary
     * avoids unnecessary analytical work.
     */
    if (
      firstNumber ===
        0 ||
      secondNumber ===
        0
    ) {
      return null;
    }

    const analysis =
      this.probabilityEngine
        .analyze(
          visibleHistory,
          this.analysisOptions,
        );

    if (
      analysis.probabilityMode !==
        'PAPER_ONLY' ||
      analysis.selectedPatternKind ===
        null
    ) {
      return null;
    }

    const action =
      this.actionSemantics
        .resolve({
          analysis,

          firstNumber,

          secondNumber,
        });

    if (
      action.status !==
        'ACTION' ||
      action.targetColor ===
        null
    ) {
      return null;
    }

    const metadata:
      TriplicacaoShadowDecisionMetadata =
      Object.freeze({
        selectedPatternKind:
          analysis.selectedPatternKind,

        firstNumber,

        secondNumber,

        targetColor:
          action.targetColor,

        confidenceScore:
          analysis.advancedConfidenceScore,

        evidenceScore:
          analysis.advancedEvidenceScore,

        riskScore:
          analysis.advancedRiskScore,

        probabilityMode:
          'PAPER_ONLY' as const,
      });

    return Object.freeze({
      strategyId:
        this.strategyId,

      strategyRiskScore:
        analysis.advancedRiskScore,

      metadata,
    });
  }


  public prepare(
    decision:
      HistoricalShadowDecision,

    context:
      HistoricalShadowFinancialContext,
  ): HistoricalShadowExecutableTrade | null {
    if (
      decision.strategyId !==
      this.strategyId
    ) {
      throw new Error(
        'triplicacao_shadow_decision_strategy_mismatch',
      );
    }

    const metadata =
      this.decisionMetadata(
        decision,
      );

    const baseStake =
      this.stakeResolver
        .resolve({
          bankroll:
            context.currentBankroll,

          riskMode:
            context.riskMode,

          minimumStake:
            context.minimumChipValue,

          strategyRiskScore:
            decision.strategyRiskScore,
        });

    if (
      baseStake.status !==
        'RECOMMENDED' ||
      baseStake.suggestedStake ===
        null
    ) {
      return null;
    }

    const ledger =
      this.recoveryLedger
        .snapshot();

    const drawdownFraction =
      context.peakBankroll >
        0
        ? Math.max(
            0,
            (
              context.peakBankroll -
              context.currentBankroll
            ) /
            context.peakBankroll,
          )
        : 0;

    let suggestedStake =
      baseStake.suggestedStake;

    let recoveryComponent =
      0;

    let recovery:
      ControlledRecoveryReport | null =
      null;

    /*
     * Capital Preservation outranks recovery.
     *
     * CAUTION may still permit base stake but disables recovery.
     */
    if (
      this.martingaleEnabled &&
      ledger.pendingLossDebt >
        0 &&
      context.capital.recoveryAllowed
    ) {
      recovery =
        this.recoveryEngine
          .evaluate({
            bankroll:
              context.currentBankroll,

            riskMode:
              context.riskMode,

            martingaleEnabled:
              true,

            baseStake:
              baseStake.suggestedStake,

            pendingLossDebt:
              ledger.pendingLossDebt,

            strategyRiskScore:
              decision.strategyRiskScore,

            drawdownFraction,

            minimumStake:
              context.minimumChipValue,
          });

      if (
        (
          recovery.decision ===
            'RECOVERY_ALLOWED' ||
          recovery.decision ===
            'RECOVERY_REDUCED'
        ) &&
        recovery.suggestedStake !==
          null &&
        recovery.recoveryComponent >
          0
      ) {
        suggestedStake =
          recovery.suggestedStake;

        recoveryComponent =
          recovery.recoveryComponent;
      }
    }

    if (
      suggestedStake >
      context.currentBankroll +
      Number.EPSILON
    ) {
      throw new Error(
        'triplicacao_shadow_stake_exceeds_bankroll',
      );
    }

    const tradeMetadata:
      TriplicacaoShadowTradeMetadata =
      Object.freeze({
        selectedPatternKind:
          metadata.selectedPatternKind,

        firstNumber:
          metadata.firstNumber,

        secondNumber:
          metadata.secondNumber,

        targetColor:
          metadata.targetColor,

        baseStakeAmount:
          baseStake.suggestedStake,

        recoveryComponent,

        pendingLossDebtBefore:
          ledger.pendingLossDebt,

        recovery,

        confidenceScore:
          metadata.confidenceScore,

        evidenceScore:
          metadata.evidenceScore,

        riskScore:
          metadata.riskScore,
      });

    return Object.freeze({
      strategyId:
        this.strategyId,

      stake:
        suggestedStake,

      metadata:
        tradeMetadata,
    });
  }


  public settle(
    trade:
      HistoricalShadowExecutableTrade,

    nextSpin:
      number,
  ): HistoricalShadowSettlement {
    if (
      trade.strategyId !==
      this.strategyId
    ) {
      throw new Error(
        'triplicacao_shadow_trade_strategy_mismatch',
      );
    }

    this.validateSpin(
      nextSpin,
    );

    const metadata =
      this.tradeMetadata(
        trade,
      );

    const resultColor =
      this.color(
        nextSpin,
      );

    let outcome:
      'WIN' |
      'LOSS' |
      'VOID';

    let pnl:
      number;

    let grossReturn:
      number;

    if (
      resultColor ===
      'ZERO'
    ) {
      /*
       * Statistical Triplicação semantics:
       *
       * third-position zero = VOID.
       *
       * Financial roulette semantics:
       *
       * an actually exposed RED/BLACK stake loses.
       */
      outcome =
        'VOID';

      pnl =
        -trade.stake;

      grossReturn =
        0;

      this.recoveryLedger
        .apply({
          settlement:
            'ZERO_LOSS',

          stake:
            trade.stake,

          recoveryComponent:
            metadata.recoveryComponent,
        });
    } else if (
      resultColor ===
      metadata.targetColor
    ) {
      outcome =
        'WIN';

      /*
       * Even-money roulette:
       *
       * gross return includes the original stake.
       */
      grossReturn =
        this.money(
          trade.stake *
          2,
        );

      pnl =
        this.money(
          trade.stake,
        );

      this.recoveryLedger
        .apply({
          settlement:
            'WIN',

          stake:
            trade.stake,

          recoveryComponent:
            metadata.recoveryComponent,
        });
    } else {
      outcome =
        'LOSS';

      grossReturn =
        0;

      pnl =
        -trade.stake;

      this.recoveryLedger
        .apply({
          settlement:
            'LOSS',

          stake:
            trade.stake,

          recoveryComponent:
            metadata.recoveryComponent,
        });
    }

    return Object.freeze({
      outcome,

      stake:
        this.money(
          trade.stake,
        ),

      grossReturn:
        this.money(
          grossReturn,
        ),

      pnl:
        this.money(
          pnl,
        ),

      metadata:
        Object.freeze({
          selectedPatternKind:
            metadata.selectedPatternKind,

          firstNumber:
            metadata.firstNumber,

          secondNumber:
            metadata.secondNumber,

          targetColor:
            metadata.targetColor,

          resultColor,

          baseStakeAmount:
            metadata.baseStakeAmount,

          recoveryComponent:
            metadata.recoveryComponent,

          recoveryLedger:
            this.recoveryLedger
              .snapshot(),
        }),
    });
  }


  public recoverySnapshot():
    PaperRecoveryLedgerSnapshot {
    return this.recoveryLedger
      .snapshot();
  }


  private decisionMetadata(
    decision:
      HistoricalShadowDecision,
  ): TriplicacaoShadowDecisionMetadata {
    const metadata =
      decision.metadata;

    if (
      metadata ===
        undefined ||
      typeof metadata.selectedPatternKind !==
        'string' ||
      !Number.isInteger(
        metadata.firstNumber,
      ) ||
      !Number.isInteger(
        metadata.secondNumber,
      ) ||
      (
        metadata.targetColor !==
          'RED' &&
        metadata.targetColor !==
          'BLACK'
      ) ||
      typeof metadata.confidenceScore !==
        'number' ||
      typeof metadata.evidenceScore !==
        'number' ||
      typeof metadata.riskScore !==
        'number' ||
      metadata.probabilityMode !==
        'PAPER_ONLY'
    ) {
      throw new Error(
        'triplicacao_shadow_invalid_decision_metadata',
      );
    }

    return metadata as unknown as
      TriplicacaoShadowDecisionMetadata;
  }


  private tradeMetadata(
    trade:
      HistoricalShadowExecutableTrade,
  ): TriplicacaoShadowTradeMetadata {
    const metadata =
      trade.metadata;

    if (
      metadata ===
        undefined ||
      typeof metadata.selectedPatternKind !==
        'string' ||
      !Number.isInteger(
        metadata.firstNumber,
      ) ||
      !Number.isInteger(
        metadata.secondNumber,
      ) ||
      (
        metadata.targetColor !==
          'RED' &&
        metadata.targetColor !==
          'BLACK'
      ) ||
      typeof metadata.baseStakeAmount !==
        'number' ||
      typeof metadata.recoveryComponent !==
        'number' ||
      typeof metadata.pendingLossDebtBefore !==
        'number' ||
      typeof metadata.confidenceScore !==
        'number' ||
      typeof metadata.evidenceScore !==
        'number' ||
      typeof metadata.riskScore !==
        'number'
    ) {
      throw new Error(
        'triplicacao_shadow_invalid_trade_metadata',
      );
    }

    return metadata as unknown as
      TriplicacaoShadowTradeMetadata;
  }


  private color(
    number:
      number,
  ):
    | TriplicacaoActionColor
    | 'ZERO' {
    if (
      number ===
        0
    ) {
      return 'ZERO';
    }

    const red =
      new Set([
        1, 3, 5, 7, 9,
        12, 14, 16, 18,
        19, 21, 23, 25,
        27, 30, 32, 34,
        36,
      ]);

    return red.has(
      number,
    )
      ? 'RED'
      : 'BLACK';
  }


  private validateSpin(
    spin:
      number,
  ): void {
    if (
      !Number.isInteger(
        spin,
      ) ||
      spin <
        0 ||
      spin >
        36
    ) {
      throw new Error(
        'triplicacao_shadow_invalid_spin',
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
}
