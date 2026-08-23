import {
  FusionHeatmapIntegrationEngine,
  type FusionHeatmapIntegrationOptions,
  type FusionHeatmapIntegrationReport,
} from './FusionHeatmapIntegrationEngine.js';


export type HeatmapDynamicIntegrationOptions =
  FusionHeatmapIntegrationOptions;


export type HeatmapDynamicIntegrationReport =
  FusionHeatmapIntegrationReport;


export interface HeatmapDynamicConsensusSignal {
  readonly strategyId:
    'heatmap-dynamic';

  readonly source:
    'HEATMAP_DYNAMIC';

  readonly enabled:
    true;

  readonly confidenceScore:
    number;

  readonly riskScore:
    number;

  readonly evidenceScore:
    number;

  readonly blockers:
    readonly string[];

  readonly warnings:
    readonly string[];

  readonly reasons:
    readonly string[];

  readonly suggestedMode:
    'PAPER_ONLY' |
    'OBSERVE' |
    'BLOCKED';
}


/**
 * Canonical identity boundary for the dynamic Heatmap strategy.
 *
 * IMPORTANT:
 *
 * This component intentionally reuses the already-certified
 * FusionHeatmapIntegrationEngine analytical mathematics.
 *
 * The previous implementation was analytically valid but incorrectly
 * identified as "fusion-reduzida".
 *
 * Heatmap Dynamic:
 * - selects dynamic HOT_SECTOR / HOT_NUMBER_CLUSTER targets;
 * - uses pressure, recency, dispersion, confidence and risk;
 * - remains PAPER-only;
 * - has no bankroll or execution authority.
 *
 * The fixed 23 ± 9 strategy is a different strategy and will remain
 * identified as "fusion-reduzida".
 */
export class HeatmapDynamicIntegrationEngine {
  public constructor(
    private readonly analyticalEngine:
      FusionHeatmapIntegrationEngine =
        new FusionHeatmapIntegrationEngine(),
  ) {}


  public analyze(
    history:
      readonly number[],

    options:
      HeatmapDynamicIntegrationOptions = {},
  ): HeatmapDynamicIntegrationReport {
    return this.analyticalEngine
      .analyze(
        history,
        options,
      );
  }


  public toConsensusSignal(
    report:
      HeatmapDynamicIntegrationReport,
  ): HeatmapDynamicConsensusSignal {
    return Object.freeze({
      strategyId:
        'heatmap-dynamic' as const,

      source:
        'HEATMAP_DYNAMIC' as const,

      enabled:
        true as const,

      confidenceScore:
        report.fusionConfidenceScore,

      riskScore:
        report.fusionRiskScore,

      evidenceScore:
        Math.round(
          report.fusionConfidenceScore *
          100,
        ),

      blockers:
        report.mode ===
          'FUSION_READY'
          ? Object.freeze([])
          : Object.freeze([
              ...report.blockers,
            ]),

      warnings:
        Object.freeze([
          ...report.warnings,
        ]),

      reasons:
        Object.freeze([
          ...report.reasons,
          'HEATMAP_DYNAMIC_IDENTITY',
        ]),

      suggestedMode:
        report.mode ===
          'FUSION_READY'
          ? 'PAPER_ONLY'
          : report.mode ===
              'BLOCKED'
            ? 'BLOCKED'
            : 'OBSERVE',
    });
  }
}
