import type {
  FusionHeatmapIntegrationReport,
  FusionHeatmapTargetRegion,
} from './FusionHeatmapIntegrationEngine.js';


export type HeatmapDynamicProspectiveDecisionStatus =
  | 'BLOCKED'
  | 'OBSERVE'
  | 'PAPER_READY';


export interface HeatmapDynamicProspectiveHypothesis {
  readonly strategyId:
    'heatmap-dynamic';

  readonly targetRegionId:
    string;

  readonly targetNumbers:
    readonly number[];

  readonly source:
    FusionHeatmapTargetRegion['source'];

  readonly heatScore:
    number;

  readonly confidenceScore:
    number;

  readonly riskScore:
    number;

  readonly signalStrength:
    FusionHeatmapIntegrationReport['signalStrength'];

  readonly paperOnly:
    true;

  readonly liveMoneyAuthorization:
    false;

  readonly automaticBetExecutionAllowed:
    false;

  readonly operatorDecisionRequired:
    true;
}


export interface HeatmapDynamicProspectiveDecision {
  readonly status:
    HeatmapDynamicProspectiveDecisionStatus;

  readonly hypothesis:
    HeatmapDynamicProspectiveHypothesis | null;

  readonly blockers:
    readonly string[];

  readonly warnings:
    readonly string[];

  readonly reasons:
    readonly string[];

  readonly paperOnly:
    true;

  readonly recommendationOnly:
    true;

  readonly liveMoneyAuthorization:
    false;

  readonly automaticBetExecutionAllowed:
    false;

  readonly operatorDecisionRequired:
    true;
}


/**
 * Prospective decision semantics for HEATMAP DYNAMIC.
 *
 * This strategy is intentionally distinct from Fusion Reduzida.
 *
 * HEATMAP DYNAMIC:
 * - target may vary every decision;
 * - target may be HOT_NUMBER_X;
 * - target may be a canonical hot sector;
 * - top-ranked analytical region becomes the prospective target.
 *
 * FUSION REDUZIDA:
 * - fixed center 23;
 * - fixed radius 9;
 * - fixed target size 19;
 * - implemented separately.
 */
export class HeatmapDynamicProspectiveDecisionSemantics {
  public resolve(
    report:
      FusionHeatmapIntegrationReport,
  ): HeatmapDynamicProspectiveDecision {
    if (
      report.mode ===
      'BLOCKED'
    ) {
      return this.decision({
        status:
          'BLOCKED',

        hypothesis:
          null,

        blockers:
          report.blockers,

        warnings:
          report.warnings,

        reasons: [
          ...report.reasons,
          'HEATMAP_DYNAMIC_PROSPECTIVE_BLOCKED',
        ],
      });
    }


    if (
      report.mode !==
      'FUSION_READY'
    ) {
      return this.decision({
        status:
          'OBSERVE',

        hypothesis:
          null,

        blockers:
          report.blockers,

        warnings:
          report.warnings,

        reasons: [
          ...report.reasons,
          'HEATMAP_DYNAMIC_PROSPECTIVE_OBSERVE',
        ],
      });
    }


    if (
      report.blockers.length >
      0
    ) {
      return this.decision({
        status:
          'BLOCKED',

        hypothesis:
          null,

        blockers:
          report.blockers,

        warnings:
          report.warnings,

        reasons: [
          ...report.reasons,
          'HEATMAP_DYNAMIC_READY_WITH_BLOCKERS_REJECTED',
        ],
      });
    }


    const targetRegion =
      report.targetRegions[0] ??
      null;

    if (
      targetRegion ===
      null
    ) {
      return this.decision({
        status:
          'BLOCKED',

        hypothesis:
          null,

        blockers: [
          ...report.blockers,
          'HEATMAP_DYNAMIC_TARGET_REGION_MISSING',
        ],

        warnings:
          report.warnings,

        reasons: [
          ...report.reasons,
          'HEATMAP_DYNAMIC_TARGET_REGION_REQUIRED',
        ],
      });
    }


    const hypothesis:
      HeatmapDynamicProspectiveHypothesis =
      Object.freeze({
        strategyId:
          'heatmap-dynamic' as const,

        targetRegionId:
          targetRegion.regionId,

        targetNumbers:
          Object.freeze([
            ...targetRegion.numbers,
          ]),

        source:
          targetRegion.source,

        heatScore:
          targetRegion.heatScore,

        confidenceScore:
          report.fusionConfidenceScore,

        riskScore:
          report.fusionRiskScore,

        signalStrength:
          report.signalStrength,

        paperOnly:
          true as const,

        liveMoneyAuthorization:
          false as const,

        automaticBetExecutionAllowed:
          false as const,

        operatorDecisionRequired:
          true as const,
      });


    return this.decision({
      status:
        'PAPER_READY',

      hypothesis,

      blockers:
        Object.freeze([]),

      warnings:
        report.warnings,

      reasons: [
        ...report.reasons,
        `HEATMAP_DYNAMIC_TARGET:${targetRegion.regionId}`,
        'HEATMAP_DYNAMIC_PROSPECTIVE_PAPER_READY',
      ],
    });
  }


  private decision(
    input: {
      readonly status:
        HeatmapDynamicProspectiveDecisionStatus;

      readonly hypothesis:
        HeatmapDynamicProspectiveHypothesis | null;

      readonly blockers:
        readonly string[];

      readonly warnings:
        readonly string[];

      readonly reasons:
        readonly string[];
    },
  ): HeatmapDynamicProspectiveDecision {
    return Object.freeze({
      status:
        input.status,

      hypothesis:
        input.hypothesis,

      blockers:
        Object.freeze([
          ...input.blockers,
        ]),

      warnings:
        Object.freeze([
          ...input.warnings,
        ]),

      reasons:
        Object.freeze([
          ...input.reasons,
        ]),

      paperOnly:
        true as const,

      recommendationOnly:
        true as const,

      liveMoneyAuthorization:
        false as const,

      automaticBetExecutionAllowed:
        false as const,

      operatorDecisionRequired:
        true as const,
    });
  }
}
