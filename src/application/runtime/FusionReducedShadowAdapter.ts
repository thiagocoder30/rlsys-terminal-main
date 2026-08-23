import {
  FusionReducedDoctrineEngine,
  type FusionReducedDoctrineSnapshot,
} from './FusionReducedDoctrineEngine.js';

import {
  FusionReducedEvidenceEngine,
  type FusionReducedEvidenceOptions,
  type FusionReducedEvidenceReport,
} from './FusionReducedEvidenceEngine.js';

import {
  FusionReducedProspectiveDecisionSemantics,
  type FusionReducedProspectiveDecision,
} from './FusionReducedProspectiveDecisionSemantics.js';

import {
  PaperStakeRecommendationResolver,
} from './PaperStakeRecommendationResolver.js';

import {
  StrategyPaperStakePlan,
  type StrategyPaperStakePlanSnapshot,
} from './StrategyPaperStakePlan.js';

import {
  StraightUpPaperFinancialSettlement,
} from './StraightUpPaperFinancialSettlement.js';

import type {
  HistoricalShadowDecision,
  HistoricalShadowExecutableTrade,
  HistoricalShadowFinancialContext,
  HistoricalShadowSettlement,
  HistoricalShadowStrategyAdapter,
} from './HistoricalShadowReplayEngine.js';


export interface FusionReducedShadowAdapterConfiguration {
  readonly evidenceOptions?:
    FusionReducedEvidenceOptions;
}


export interface FusionReducedShadowDecisionMetadata
  extends Readonly<Record<string, unknown>> {

  readonly targetNumbers:
    readonly number[];

  readonly targetCenter:
    23;

  readonly targetCoverage:
    19;

  readonly confidenceScore:
    number;

  readonly riskScore:
    number;

  readonly observedHitRate:
    number;

  readonly recentHitRate:
    number;

  readonly rateDrift:
    number;
}


export interface FusionReducedShadowTradeMetadata
  extends Readonly<Record<string, unknown>> {

  readonly targetNumbers:
    readonly number[];

  readonly targetCenter:
    23;

  readonly targetCoverage:
    19;

  readonly stakePlan:
    StrategyPaperStakePlanSnapshot;

  readonly authorizedMaximumTotalStake:
    number;

  readonly stakePerNumber:
    number;

  readonly chipsPerNumber:
    number;

  readonly confidenceScore:
    number;

  readonly riskScore:
    number;
}


/**
 * Historical SHADOW adapter for FUSION REDUZIDA.
 *
 * Responsibilities:
 *
 * evaluate():
 * - run canonical Fusion evidence only on history visible at t;
 * - run canonical prospective semantics;
 * - expose a decision only when status=PAPER_READY.
 *
 * prepare():
 * - use current simulated bankroll;
 * - ask PaperStakeRecommendationResolver for the sovereign
 *   maximum TOTAL exposure;
 * - quantize that total exposure into the fixed 19-number layout;
 * - block if one complete physical layout cannot fit safely.
 *
 * settle():
 * - settle the frozen 19-number layout against t+1;
 * - return BRL stake, gross return and net P&L.
 *
 * It never:
 * - changes real bankroll;
 * - changes doctrine;
 * - changes evidence thresholds during replay;
 * - authorizes automatic execution.
 */
export class FusionReducedShadowAdapter
  implements HistoricalShadowStrategyAdapter {

  public readonly strategyId =
    'fusion-reduced';

  /**
   * Canonical evidence default requires two complete
   * European-wheel samples.
   */
  public readonly minimumHistorySize:
    number;

  private readonly doctrine:
    FusionReducedDoctrineSnapshot;

  private readonly evidenceEngine:
    FusionReducedEvidenceEngine;

  private readonly decisionSemantics:
    FusionReducedProspectiveDecisionSemantics;

  private readonly evidenceOptions:
    FusionReducedEvidenceOptions;

  public constructor(
    configuration:
      FusionReducedShadowAdapterConfiguration = {},

    private readonly stakeResolver:
      PaperStakeRecommendationResolver =
        new PaperStakeRecommendationResolver(),

    private readonly stakePlan:
      StrategyPaperStakePlan =
        new StrategyPaperStakePlan(),

    private readonly financialSettlement:
      StraightUpPaperFinancialSettlement =
        new StraightUpPaperFinancialSettlement(),
  ) {
    this.doctrine =
      new FusionReducedDoctrineEngine()
        .snapshot();

    this.evidenceEngine =
      new FusionReducedEvidenceEngine(
        this.doctrine,
      );

    this.decisionSemantics =
      new FusionReducedProspectiveDecisionSemantics(
        this.doctrine,
      );

    this.evidenceOptions =
      Object.freeze({
        ...configuration.evidenceOptions,
      });

    this.minimumHistorySize =
      configuration
        .evidenceOptions
        ?.minimumSampleSize ??
      74;
  }


  public evaluate(
    visibleHistory:
      readonly number[],
  ): HistoricalShadowDecision | null {
    const evidence =
      this.evidenceEngine
        .analyze(
          visibleHistory,
          this.evidenceOptions,
        );

    const decision =
      this.decisionSemantics
        .resolve(
          evidence,
        );

    if (
      decision.status !==
        'PAPER_READY' ||
      decision.hypothesis ===
        null
    ) {
      return null;
    }

    this.assertCanonicalDecision(
      decision,
      evidence,
    );

    const metadata:
      FusionReducedShadowDecisionMetadata =
      Object.freeze({
        targetNumbers:
          Object.freeze([
            ...decision
              .hypothesis
              .targetNumbers,
          ]),

        targetCenter:
          23 as const,

        targetCoverage:
          19 as const,

        confidenceScore:
          evidence.confidenceScore,

        riskScore:
          evidence.riskScore,

        observedHitRate:
          evidence.observedHitRate,

        recentHitRate:
          evidence.recentHitRate,

        rateDrift:
          evidence.rateDrift,
      });

    return Object.freeze({
      strategyId:
        this.strategyId,

      strategyRiskScore:
        evidence.riskScore,

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
        'fusion_reduced_shadow_decision_strategy_mismatch',
      );
    }

    const metadata =
      this.decisionMetadata(
        decision,
      );

    /*
     * Sovereign financial authority.
     *
     * suggestedStake is interpreted as the maximum TOTAL
     * hypothesis exposure, never stake per number.
     */
    const recommendation =
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
      recommendation.status !==
        'RECOMMENDED' ||
      recommendation.suggestedStake ===
        null
    ) {
      return null;
    }

    const layout =
      this.stakePlan
        .resolve({
          strategyId:
            this.strategyId,

          provider:
            context.provider,

          minimumChipValue:
            context.minimumChipValue,

          targetCount:
            19,

          maximumTotalStake:
            recommendation.suggestedStake,
        });

    if (
      layout.status !==
      'READY'
    ) {
      return null;
    }

    /*
     * Defense in depth:
     * physical layout cannot exceed financial sovereignty.
     */
    if (
      layout.totalStake >
      recommendation.suggestedStake +
      Number.EPSILON
    ) {
      throw new Error(
        'fusion_reduced_shadow_layout_exceeds_authorized_stake',
      );
    }

    const tradeMetadata:
      FusionReducedShadowTradeMetadata =
      Object.freeze({
        targetNumbers:
          Object.freeze([
            ...metadata
              .targetNumbers,
          ]),

        targetCenter:
          23 as const,

        targetCoverage:
          19 as const,

        stakePlan:
          layout,

        authorizedMaximumTotalStake:
          recommendation.suggestedStake,

        stakePerNumber:
          layout.stakePerTarget,

        chipsPerNumber:
          layout.chipsPerTarget,

        confidenceScore:
          metadata.confidenceScore,

        riskScore:
          metadata.riskScore,
      });

    return Object.freeze({
      strategyId:
        this.strategyId,

      stake:
        layout.totalStake,

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
        'fusion_reduced_shadow_trade_strategy_mismatch',
      );
    }

    const metadata =
      this.tradeMetadata(
        trade,
      );

    const settlement =
      this.financialSettlement
        .settle({
          strategyId:
            this.strategyId,

          targetNumbers:
            metadata.targetNumbers,

          resultNumber:
            nextSpin,

          stakePlan:
            metadata.stakePlan,
        });

    return Object.freeze({
      outcome:
        settlement.outcome,

      stake:
        settlement.totalStake,

      grossReturn:
        settlement.grossReturn,

      pnl:
        settlement.pnl,

      metadata:
        Object.freeze({
          targetNumbers:
            settlement.targetNumbers,

          targetCount:
            settlement.targetCount,

          provider:
            settlement.provider,

          minimumChipValue:
            settlement.minimumChipValue,

          stakePerNumber:
            settlement.stakePerTarget,

          chipsPerNumber:
            settlement.chipsPerTarget,
        }),
    });
  }


  public doctrineSnapshot():
    FusionReducedDoctrineSnapshot {
    return this.doctrine;
  }


  private assertCanonicalDecision(
    decision:
      FusionReducedProspectiveDecision,

    evidence:
      FusionReducedEvidenceReport,
  ): void {
    if (
      decision.hypothesis ===
      null
    ) {
      throw new Error(
        'fusion_reduced_shadow_hypothesis_missing',
      );
    }

    if (
      decision.hypothesis.targetCenter !==
        23 ||
      decision.hypothesis.targetCoverage !==
        19 ||
      decision.hypothesis.targetNumbers.length !==
        19
    ) {
      throw new Error(
        'fusion_reduced_shadow_noncanonical_target',
      );
    }

    if (
      evidence.targetNumbers.length !==
        19
    ) {
      throw new Error(
        'fusion_reduced_shadow_noncanonical_evidence_target',
      );
    }
  }


  private decisionMetadata(
    decision:
      HistoricalShadowDecision,
  ): FusionReducedShadowDecisionMetadata {
    const metadata =
      decision.metadata;

    if (
      metadata ===
        undefined ||
      !Array.isArray(
        metadata.targetNumbers,
      ) ||
      metadata.targetNumbers.length !==
        19 ||
      metadata.targetCenter !==
        23 ||
      metadata.targetCoverage !==
        19 ||
      typeof metadata.confidenceScore !==
        'number' ||
      typeof metadata.riskScore !==
        'number' ||
      typeof metadata.observedHitRate !==
        'number' ||
      typeof metadata.recentHitRate !==
        'number' ||
      typeof metadata.rateDrift !==
        'number'
    ) {
      throw new Error(
        'fusion_reduced_shadow_invalid_decision_metadata',
      );
    }

    return metadata as unknown as
      FusionReducedShadowDecisionMetadata;
  }


  private tradeMetadata(
    trade:
      HistoricalShadowExecutableTrade,
  ): FusionReducedShadowTradeMetadata {
    const metadata =
      trade.metadata;

    if (
      metadata ===
        undefined ||
      !Array.isArray(
        metadata.targetNumbers,
      ) ||
      metadata.targetNumbers.length !==
        19 ||
      metadata.targetCenter !==
        23 ||
      metadata.targetCoverage !==
        19 ||
      typeof metadata.stakePerNumber !==
        'number' ||
      typeof metadata.chipsPerNumber !==
        'number' ||
      typeof metadata.authorizedMaximumTotalStake !==
        'number' ||
      metadata.stakePlan ===
        undefined
    ) {
      throw new Error(
        'fusion_reduced_shadow_invalid_trade_metadata',
      );
    }

    return metadata as unknown as
      FusionReducedShadowTradeMetadata;
  }
}
