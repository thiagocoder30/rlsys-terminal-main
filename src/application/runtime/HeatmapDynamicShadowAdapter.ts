import {
  HeatmapDynamicIntegrationEngine,
  type HeatmapDynamicIntegrationOptions,
  type HeatmapDynamicIntegrationReport,
} from './HeatmapDynamicIntegrationEngine.js';

import {
  HeatmapDynamicProspectiveDecisionSemantics,
  type HeatmapDynamicProspectiveDecision,
} from './HeatmapDynamicProspectiveDecisionSemantics.js';

import type {
  FusionHeatmapTargetRegion,
  FusionHeatmapSignalStrength,
} from './FusionHeatmapIntegrationEngine.js';

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


export interface HeatmapDynamicShadowAdapterConfiguration {
  readonly analysisOptions?:
    HeatmapDynamicIntegrationOptions;
}


export interface HeatmapDynamicShadowAnalyticsPort {
  analyze(
    history:
      readonly number[],

    options?:
      HeatmapDynamicIntegrationOptions,
  ): HeatmapDynamicIntegrationReport;
}


export interface HeatmapDynamicShadowDecisionPort {
  resolve(
    report:
      HeatmapDynamicIntegrationReport,
  ): HeatmapDynamicProspectiveDecision;
}


export interface HeatmapDynamicShadowDecisionMetadata
  extends Readonly<Record<string, unknown>> {

  readonly targetRegionId:
    string;

  readonly targetNumbers:
    readonly number[];

  readonly targetCount:
    number;

  readonly coveragePercent:
    number;

  readonly source:
    FusionHeatmapTargetRegion['source'];

  readonly heatScore:
    number;

  readonly confidenceScore:
    number;

  readonly riskScore:
    number;

  readonly signalStrength:
    FusionHeatmapSignalStrength;

  readonly fusionPressureScore:
    number;

  readonly recencyPressureScore:
    number;

  readonly dispersionScore:
    number;
}


export interface HeatmapDynamicShadowTradeMetadata
  extends Readonly<Record<string, unknown>> {

  readonly targetRegionId:
    string;

  readonly targetNumbers:
    readonly number[];

  readonly targetCount:
    number;

  readonly coveragePercent:
    number;

  readonly source:
    FusionHeatmapTargetRegion['source'];

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

  readonly heatScore:
    number;

  readonly signalStrength:
    FusionHeatmapSignalStrength;
}


/**
 * Historical SHADOW adapter for HEATMAP DYNAMIC.
 *
 * evaluate():
 * - analyzes only the historical prefix visible at t;
 * - applies canonical Heatmap Dynamic prospective semantics;
 * - exposes only PAPER_READY decisions;
 * - freezes the exact dynamic region selected at t.
 *
 * prepare():
 * - uses CURRENT simulated bankroll;
 * - obtains sovereign total exposure from
 *   PaperStakeRecommendationResolver;
 * - quantizes that budget according to the variable target count;
 * - may reduce or block exposure, never increase it.
 *
 * settle():
 * - settles the frozen target exclusively against t+1;
 * - uses equal straight-up stake across every frozen target number;
 * - produces BRL stake, gross return and net P&L.
 *
 * This adapter has no:
 * - live-money authority;
 * - bankroll mutation authority;
 * - automatic execution;
 * - target recalculation during settlement.
 */
export class HeatmapDynamicShadowAdapter
  implements HistoricalShadowStrategyAdapter {

  public readonly strategyId =
    'heatmap-dynamic';

  public readonly minimumHistorySize:
    number;

  private readonly analysisOptions:
    HeatmapDynamicIntegrationOptions;


  public constructor(
    configuration:
      HeatmapDynamicShadowAdapterConfiguration = {},

    private readonly analytics:
      HeatmapDynamicShadowAnalyticsPort =
        new HeatmapDynamicIntegrationEngine(),

    private readonly decisionSemantics:
      HeatmapDynamicShadowDecisionPort =
        new HeatmapDynamicProspectiveDecisionSemantics(),

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
    this.analysisOptions =
      Object.freeze({
        ...configuration
          .analysisOptions,
      });

    this.minimumHistorySize =
      configuration
        .analysisOptions
        ?.minSampleSize ??
      60;
  }


  public evaluate(
    visibleHistory:
      readonly number[],
  ): HistoricalShadowDecision | null {
    const analysis =
      this.analytics
        .analyze(
          visibleHistory,
          this.analysisOptions,
        );

    const decision =
      this.decisionSemantics
        .resolve(
          analysis,
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
      analysis,
    );

    const targetNumbers =
      this.freezeTargets(
        decision
          .hypothesis
          .targetNumbers,
      );

    const targetCount =
      targetNumbers.length;

    if (
      targetCount ===
      0
    ) {
      throw new Error(
        'heatmap_dynamic_shadow_empty_target',
      );
    }

    const metadata:
      HeatmapDynamicShadowDecisionMetadata =
      Object.freeze({
        targetRegionId:
          decision
            .hypothesis
            .targetRegionId,

        targetNumbers,

        targetCount,

        coveragePercent:
          this.coveragePercent(
            targetCount,
          ),

        source:
          decision
            .hypothesis
            .source,

        heatScore:
          decision
            .hypothesis
            .heatScore,

        confidenceScore:
          analysis
            .fusionConfidenceScore,

        riskScore:
          analysis
            .fusionRiskScore,

        signalStrength:
          analysis.signalStrength,

        fusionPressureScore:
          analysis
            .fusionPressureScore,

        recencyPressureScore:
          analysis
            .recencyPressureScore,

        dispersionScore:
          analysis
            .dispersionScore,
      });

    return Object.freeze({
      strategyId:
        this.strategyId,

      strategyRiskScore:
        analysis
          .fusionRiskScore,

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
        'heatmap_dynamic_shadow_decision_strategy_mismatch',
      );
    }

    const metadata =
      this.decisionMetadata(
        decision,
      );

    /*
     * Sovereign risk layer.
     *
     * suggestedStake is a maximum TOTAL exposure.
     * It is never interpreted as stake per number.
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
            metadata.targetCount,

          maximumTotalStake:
            recommendation.suggestedStake,
        });

    if (
      layout.status !==
        'READY'
    ) {
      return null;
    }

    if (
      layout.totalStake >
      recommendation.suggestedStake +
      Number.EPSILON
    ) {
      throw new Error(
        'heatmap_dynamic_shadow_layout_exceeds_authorized_stake',
      );
    }

    if (
      layout.targetCount !==
      metadata.targetCount
    ) {
      throw new Error(
        'heatmap_dynamic_shadow_layout_target_count_mismatch',
      );
    }

    const tradeMetadata:
      HeatmapDynamicShadowTradeMetadata =
      Object.freeze({
        targetRegionId:
          metadata.targetRegionId,

        targetNumbers:
          Object.freeze([
            ...metadata
              .targetNumbers,
          ]),

        targetCount:
          metadata.targetCount,

        coveragePercent:
          metadata.coveragePercent,

        source:
          metadata.source,

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

        heatScore:
          metadata.heatScore,

        signalStrength:
          metadata.signalStrength,
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
        'heatmap_dynamic_shadow_trade_strategy_mismatch',
      );
    }

    const metadata =
      this.tradeMetadata(
        trade,
      );

    /*
     * CRITICAL:
     *
     * Settlement uses the exact target frozen at decision time.
     * No analytical engine is called here.
     */
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
          targetRegionId:
            metadata.targetRegionId,

          targetNumbers:
            settlement.targetNumbers,

          targetCount:
            settlement.targetCount,

          coveragePercent:
            metadata.coveragePercent,

          source:
            metadata.source,

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


  private assertCanonicalDecision(
    decision:
      HeatmapDynamicProspectiveDecision,

    analysis:
      HeatmapDynamicIntegrationReport,
  ): void {
    const hypothesis =
      decision.hypothesis;

    if (
      hypothesis ===
      null
    ) {
      throw new Error(
        'heatmap_dynamic_shadow_hypothesis_missing',
      );
    }

    if (
      hypothesis.strategyId !==
      'heatmap-dynamic'
    ) {
      throw new Error(
        'heatmap_dynamic_shadow_identity_mismatch',
      );
    }

    if (
      typeof hypothesis.targetRegionId !==
        'string' ||
      hypothesis
        .targetRegionId
        .trim()
        .length ===
        0
    ) {
      throw new Error(
        'heatmap_dynamic_shadow_invalid_region_id',
      );
    }

    if (
      hypothesis.source !==
        'HOT_SECTOR' &&
      hypothesis.source !==
        'HOT_NUMBER_CLUSTER'
    ) {
      throw new Error(
        'heatmap_dynamic_shadow_invalid_source',
      );
    }

    if (
      !Number.isFinite(
        analysis.fusionRiskScore,
      ) ||
      analysis.fusionRiskScore <
        0 ||
      analysis.fusionRiskScore >
        1
    ) {
      throw new Error(
        'heatmap_dynamic_shadow_invalid_risk',
      );
    }

    if (
      !Number.isFinite(
        analysis.fusionConfidenceScore,
      ) ||
      analysis.fusionConfidenceScore <
        0 ||
      analysis.fusionConfidenceScore >
        1
    ) {
      throw new Error(
        'heatmap_dynamic_shadow_invalid_confidence',
      );
    }

    if (
      Math.abs(
        hypothesis.riskScore -
        analysis.fusionRiskScore,
      ) >
      0.001
    ) {
      throw new Error(
        'heatmap_dynamic_shadow_risk_mismatch',
      );
    }

    if (
      Math.abs(
        hypothesis.confidenceScore -
        analysis.fusionConfidenceScore,
      ) >
      0.001
    ) {
      throw new Error(
        'heatmap_dynamic_shadow_confidence_mismatch',
      );
    }
  }


  private freezeTargets(
    targets:
      readonly number[],
  ): readonly number[] {
    if (
      !Array.isArray(
        targets,
      ) ||
      targets.length ===
        0
    ) {
      throw new Error(
        'heatmap_dynamic_shadow_invalid_targets',
      );
    }

    const unique =
      new Set<number>();

    const frozen:
      number[] =
      [];

    for (
      const target of
      targets
    ) {
      if (
        !Number.isInteger(
          target,
        ) ||
      target <
        0 ||
      target >
        36
      ) {
        throw new Error(
          'heatmap_dynamic_shadow_invalid_target_number',
        );
      }

      if (
        unique.has(
          target,
        )
      ) {
        throw new Error(
          'heatmap_dynamic_shadow_duplicate_target',
        );
      }

      unique.add(
        target,
      );

      frozen.push(
        target,
      );
    }

    return Object.freeze([
      ...frozen,
    ]);
  }


  private decisionMetadata(
    decision:
      HistoricalShadowDecision,
  ): HeatmapDynamicShadowDecisionMetadata {
    const metadata =
      decision.metadata;

    if (
      metadata ===
        undefined ||
      typeof metadata.targetRegionId !==
        'string' ||
      !Array.isArray(
        metadata.targetNumbers,
      ) ||
      metadata.targetNumbers.length ===
        0 ||
      !Number.isInteger(
        metadata.targetCount,
      ) ||
      metadata.targetCount !==
        metadata.targetNumbers.length ||
      typeof metadata.coveragePercent !==
        'number' ||
      (
        metadata.source !==
          'HOT_SECTOR' &&
        metadata.source !==
          'HOT_NUMBER_CLUSTER'
      ) ||
      typeof metadata.heatScore !==
        'number' ||
      typeof metadata.confidenceScore !==
        'number' ||
      typeof metadata.riskScore !==
        'number' ||
      typeof metadata.signalStrength !==
        'string' ||
      typeof metadata.fusionPressureScore !==
        'number' ||
      typeof metadata.recencyPressureScore !==
        'number' ||
      typeof metadata.dispersionScore !==
        'number'
    ) {
      throw new Error(
        'heatmap_dynamic_shadow_invalid_decision_metadata',
      );
    }

    return metadata as unknown as
      HeatmapDynamicShadowDecisionMetadata;
  }


  private tradeMetadata(
    trade:
      HistoricalShadowExecutableTrade,
  ): HeatmapDynamicShadowTradeMetadata {
    const metadata =
      trade.metadata;

    if (
      metadata ===
        undefined ||
      typeof metadata.targetRegionId !==
        'string' ||
      !Array.isArray(
        metadata.targetNumbers,
      ) ||
      metadata.targetNumbers.length ===
        0 ||
      !Number.isInteger(
        metadata.targetCount,
      ) ||
      metadata.targetCount !==
        metadata.targetNumbers.length ||
      typeof metadata.coveragePercent !==
        'number' ||
      (
        metadata.source !==
          'HOT_SECTOR' &&
        metadata.source !==
          'HOT_NUMBER_CLUSTER'
      ) ||
      typeof metadata.authorizedMaximumTotalStake !==
        'number' ||
      typeof metadata.stakePerNumber !==
        'number' ||
      typeof metadata.chipsPerNumber !==
        'number' ||
      typeof metadata.confidenceScore !==
        'number' ||
      typeof metadata.riskScore !==
        'number' ||
      typeof metadata.heatScore !==
        'number' ||
      typeof metadata.signalStrength !==
        'string' ||
      metadata.stakePlan ===
        undefined
    ) {
      throw new Error(
        'heatmap_dynamic_shadow_invalid_trade_metadata',
      );
    }

    return metadata as unknown as
      HeatmapDynamicShadowTradeMetadata;
  }


  private coveragePercent(
    targetCount:
      number,
  ): number {
    return Math.round(
      (
        targetCount /
        37
      ) *
      1000,
    ) /
    10;
  }
}
