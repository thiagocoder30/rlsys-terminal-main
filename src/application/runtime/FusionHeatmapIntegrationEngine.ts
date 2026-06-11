import {
  WheelHeatmapAnalyticsEngine,
  type WheelHeatmapReport,
  type WheelNumberHeat,
  type WheelSectorHeat,
} from '../../domain/analytics/WheelHeatmapAnalyticsEngine.js';

export type FusionHeatmapMode = 'BLOCKED' | 'OBSERVE' | 'FUSION_READY';
export type FusionHeatmapSignalStrength = 'NONE' | 'WEAK' | 'MODERATE' | 'STRONG';

export interface FusionHeatmapIntegrationOptions {
  readonly recentWindow?: number;
  readonly neighborRadius?: number;
  readonly minSampleSize?: number;
  readonly minFusionPressureScore?: number;
  readonly minRecencyPressureScore?: number;
  readonly maxDispersionScore?: number;
}

export interface FusionHeatmapTargetRegion {
  readonly regionId: string;
  readonly source: 'HOT_SECTOR' | 'HOT_NUMBER_CLUSTER';
  readonly numbers: readonly number[];
  readonly heatScore: number;
  readonly confidenceContribution: number;
}

export interface FusionHeatmapIntegrationReport {
  readonly heatmap: WheelHeatmapReport;
  readonly mode: FusionHeatmapMode;
  readonly signalStrength: FusionHeatmapSignalStrength;
  readonly fusionConfidenceScore: number;
  readonly fusionRiskScore: number;
  readonly targetRegions: readonly FusionHeatmapTargetRegion[];
  readonly hotNumberCount: number;
  readonly coldNumberCount: number;
  readonly fusionPressureScore: number;
  readonly recencyPressureScore: number;
  readonly dispersionScore: number;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly reasons: readonly string[];
  readonly auditText: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorized: false;
  readonly productionMoneyAllowed: false;
}

const DEFAULT_MIN_SAMPLE_SIZE = 60;
const DEFAULT_MIN_FUSION_PRESSURE = 45;
const DEFAULT_MIN_RECENCY_PRESSURE = 45;
const DEFAULT_MAX_DISPERSION = 75;

export class FusionHeatmapIntegrationEngine {
  private readonly heatmapEngine: WheelHeatmapAnalyticsEngine;

  public constructor(heatmapEngine: WheelHeatmapAnalyticsEngine = new WheelHeatmapAnalyticsEngine()) {
    this.heatmapEngine = heatmapEngine;
  }

  public analyze(
    history: readonly number[],
    options: FusionHeatmapIntegrationOptions = {},
  ): FusionHeatmapIntegrationReport {
    const minSampleSize = this.positiveIntegerOrDefault(options.minSampleSize, DEFAULT_MIN_SAMPLE_SIZE);
    const minFusionPressureScore = this.scoreOrDefault(options.minFusionPressureScore, DEFAULT_MIN_FUSION_PRESSURE);
    const minRecencyPressureScore = this.scoreOrDefault(options.minRecencyPressureScore, DEFAULT_MIN_RECENCY_PRESSURE);
    const maxDispersionScore = this.scoreOrDefault(options.maxDispersionScore, DEFAULT_MAX_DISPERSION);

    const heatmap = this.heatmapEngine.analyze(history, {
      recentWindow: options.recentWindow,
      neighborRadius: options.neighborRadius,
    });

    const targetRegions = this.targetRegions(heatmap);
    const fusionPressureScore = heatmap.fusionPressureScore;
    const recencyPressureScore = heatmap.recencyPressureScore;
    const dispersionScore = heatmap.dispersionScore;
    const fusionConfidenceScore = this.confidenceScore({
      heatmap,
      targetRegions,
      fusionPressureScore,
      recencyPressureScore,
      dispersionScore,
    });
    const fusionRiskScore = this.riskScore({
      heatmap,
      targetRegions,
      fusionConfidenceScore,
      dispersionScore,
    });

    const blockers: string[] = [];
    const warnings: string[] = [];
    const reasons: string[] = [
      `FUSION_HEATMAP_SAMPLE:${heatmap.sampleSize}`,
      `FUSION_HEATMAP_PRESSURE:${fusionPressureScore}`,
      `FUSION_HEATMAP_RECENCY:${recencyPressureScore}`,
      `FUSION_HEATMAP_DISPERSION:${dispersionScore}`,
      `FUSION_HEATMAP_TARGET_REGIONS:${targetRegions.length}`,
    ];

    if (heatmap.sampleSize < minSampleSize) {
      blockers.push('FUSION_HEATMAP_SAMPLE_INSUFFICIENT');
    }

    if (fusionPressureScore < minFusionPressureScore) {
      blockers.push('FUSION_HEATMAP_PRESSURE_BELOW_THRESHOLD');
    }

    if (recencyPressureScore < minRecencyPressureScore) {
      warnings.push('FUSION_HEATMAP_RECENCY_PRESSURE_WEAK');
    }

    if (dispersionScore > maxDispersionScore) {
      blockers.push('FUSION_HEATMAP_DISPERSION_TOO_HIGH');
    }

    if (targetRegions.length === 0) {
      blockers.push('FUSION_HEATMAP_NO_TARGET_REGION');
    }

    if (fusionRiskScore > 0.62) {
      blockers.push('FUSION_HEATMAP_RISK_TOO_HIGH');
    }

    const signalStrength = this.signalStrength(fusionConfidenceScore, fusionRiskScore, targetRegions.length);
    const mode: FusionHeatmapMode =
      blockers.length === 0 && (signalStrength === 'STRONG' || signalStrength === 'MODERATE')
        ? 'FUSION_READY'
        : blockers.length > 0
          ? 'BLOCKED'
          : 'OBSERVE';

    return Object.freeze({
      heatmap,
      mode,
      signalStrength,
      fusionConfidenceScore,
      fusionRiskScore,
      targetRegions: Object.freeze(targetRegions),
      hotNumberCount: heatmap.hotNumbers.length,
      coldNumberCount: heatmap.coldNumbers.length,
      fusionPressureScore,
      recencyPressureScore,
      dispersionScore,
      blockers: Object.freeze(blockers),
      warnings: Object.freeze(warnings),
      reasons: Object.freeze(reasons),
      auditText: this.composeAuditText({
        mode,
        signalStrength,
        fusionConfidenceScore,
        fusionRiskScore,
        targetRegions,
        blockers,
        warnings,
        heatmap,
      }),
      paperOnly: true,
      liveMoneyAuthorized: false,
      productionMoneyAllowed: false,
    });
  }

  public toConsensusSignal(report: FusionHeatmapIntegrationReport): {
    readonly strategyId: 'fusion-reduzida';
    readonly source: 'FUSION_REDUZIDA';
    readonly enabled: true;
    readonly confidenceScore: number;
    readonly riskScore: number;
    readonly evidenceScore: number;
    readonly blockers: readonly string[];
    readonly warnings: readonly string[];
    readonly reasons: readonly string[];
    readonly suggestedMode: 'PAPER_ONLY' | 'OBSERVE' | 'BLOCKED';
  } {
    return Object.freeze({
      strategyId: 'fusion-reduzida',
      source: 'FUSION_REDUZIDA',
      enabled: true,
      confidenceScore: report.fusionConfidenceScore,
      riskScore: report.fusionRiskScore,
      evidenceScore: Math.round(report.fusionConfidenceScore * 100),
      blockers: report.mode === 'FUSION_READY' ? Object.freeze([]) : report.blockers,
      warnings: report.warnings,
      reasons: report.reasons,
      suggestedMode: report.mode === 'FUSION_READY'
        ? 'PAPER_ONLY'
        : report.mode === 'BLOCKED'
          ? 'BLOCKED'
          : 'OBSERVE',
    });
  }

  private targetRegions(heatmap: WheelHeatmapReport): readonly FusionHeatmapTargetRegion[] {
    const sectors = heatmap.hotSectors.slice(0, 3).map((sector) => this.fromSector(sector));
    const clusters = this.hotNumberClusters(heatmap.hotNumbers).slice(0, 3);
    return Object.freeze([...sectors, ...clusters].sort((a, b) => b.heatScore - a.heatScore));
  }

  private fromSector(sector: WheelSectorHeat): FusionHeatmapTargetRegion {
    return Object.freeze({
      regionId: sector.sectorId,
      source: 'HOT_SECTOR',
      numbers: Object.freeze([...sector.numbers]),
      heatScore: sector.heatScore,
      confidenceContribution: this.score(sector.heatScore * 0.8),
    });
  }

  private hotNumberClusters(hotNumbers: readonly WheelNumberHeat[]): readonly FusionHeatmapTargetRegion[] {
    return Object.freeze(hotNumbers.map((numberHeat) => {
      const numbers = [numberHeat.number];

      return Object.freeze({
        regionId: `HOT_NUMBER_${numberHeat.number}`,
        source: 'HOT_NUMBER_CLUSTER' as const,
        numbers: Object.freeze(numbers),
        heatScore: numberHeat.heatScore,
        confidenceContribution: this.score(numberHeat.heatScore * 0.65),
      });
    }));
  }

  private confidenceScore(input: {
    readonly heatmap: WheelHeatmapReport;
    readonly targetRegions: readonly FusionHeatmapTargetRegion[];
    readonly fusionPressureScore: number;
    readonly recencyPressureScore: number;
    readonly dispersionScore: number;
  }): number {
    const targetScore = this.average(input.targetRegions.map((region) => region.confidenceContribution));
    const sampleScore = this.score(Math.min(100, input.heatmap.sampleSize));
    const raw =
      (input.fusionPressureScore * 0.30) +
      (input.recencyPressureScore * 0.22) +
      (targetScore * 0.26) +
      (sampleScore * 0.12) +
      ((100 - input.dispersionScore) * 0.10);

    return this.clampRatio(raw / 100);
  }

  private riskScore(input: {
    readonly heatmap: WheelHeatmapReport;
    readonly targetRegions: readonly FusionHeatmapTargetRegion[];
    readonly fusionConfidenceScore: number;
    readonly dispersionScore: number;
  }): number {
    const noTargetPenalty = input.targetRegions.length === 0 ? 0.25 : 0;
    const samplePenalty = input.heatmap.sampleSize < DEFAULT_MIN_SAMPLE_SIZE ? 0.2 : 0;
    const dispersionPenalty = input.dispersionScore / 100 * 0.25;
    const confidenceProtection = (1 - input.fusionConfidenceScore) * 0.4;

    return this.clampRatio(noTargetPenalty + samplePenalty + dispersionPenalty + confidenceProtection);
  }

  private signalStrength(
    confidence: number,
    risk: number,
    targetRegionCount: number,
  ): FusionHeatmapSignalStrength {
    if (targetRegionCount === 0 || confidence <= 0) return 'NONE';
    if (confidence >= 0.78 && risk <= 0.35) return 'STRONG';
    if (confidence >= 0.64 && risk <= 0.48) return 'MODERATE';
    if (confidence >= 0.5 && risk <= 0.62) return 'WEAK';
    return 'NONE';
  }

  private composeAuditText(input: {
    readonly mode: FusionHeatmapMode;
    readonly signalStrength: FusionHeatmapSignalStrength;
    readonly fusionConfidenceScore: number;
    readonly fusionRiskScore: number;
    readonly targetRegions: readonly FusionHeatmapTargetRegion[];
    readonly blockers: readonly string[];
    readonly warnings: readonly string[];
    readonly heatmap: WheelHeatmapReport;
  }): string {
    return [
      'FUSION HEATMAP INTEGRATION',
      `MODE=${input.mode}`,
      `SIGNAL=${input.signalStrength}`,
      `CONFIDENCE=${input.fusionConfidenceScore}`,
      `RISK=${input.fusionRiskScore}`,
      `SAMPLE_SIZE=${input.heatmap.sampleSize}`,
      `FUSION_PRESSURE=${input.heatmap.fusionPressureScore}`,
      `RECENCY_PRESSURE=${input.heatmap.recencyPressureScore}`,
      `DISPERSION=${input.heatmap.dispersionScore}`,
      `TARGET_REGIONS=${input.targetRegions.map((region) => `${region.regionId}:${region.heatScore}`).join(',') || 'none'}`,
      `BLOCKERS=${input.blockers.join(',') || 'none'}`,
      `WARNINGS=${input.warnings.join(',') || 'none'}`,
      'paperOnly=true',
      'liveMoneyAuthorized=false',
    ].join('\n');
  }

  private average(values: readonly number[]): number {
    if (values.length === 0) return 0;
    return this.score(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  private positiveIntegerOrDefault(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
  }

  private scoreOrDefault(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? this.score(value) : fallback;
  }

  private score(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private clampRatio(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
  }
}
