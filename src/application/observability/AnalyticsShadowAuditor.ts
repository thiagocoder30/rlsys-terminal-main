import type { AnalyticsShadowTelemetry } from './AnalyticsShadowTelemetry.js';

export interface AnalyticsShadowAuditorInput {
  readonly triplicacao: {
    readonly legacyPattern: string;
    readonly legacyRatio: number;
    readonly advancedPattern: string;
    readonly advancedRatio: number;
  };
  readonly heatmap: {
    readonly legacyHotNumbers: readonly number[];
    readonly fusionHotNumbers: readonly number[];
    readonly fusionPressure: number;
    readonly recencyPressure: number;
    readonly dispersionScore: number;
    readonly mode: string;
  };
}

export class AnalyticsShadowAuditor {
  public capture(input: AnalyticsShadowAuditorInput): AnalyticsShadowTelemetry {
    const parityMismatch = input.triplicacao.legacyPattern !== input.triplicacao.advancedPattern;
    const ratioDrift = Math.abs(input.triplicacao.legacyRatio - input.triplicacao.advancedRatio);

    return Object.freeze({
      timestamp: new Date().toISOString(),
      triplicacao: Object.freeze({
        parityMismatch,
        ratioDrift: this.round6(ratioDrift),
        legacyPattern: input.triplicacao.legacyPattern,
        advancedPattern: input.triplicacao.advancedPattern,
      }),
      heatmap: Object.freeze({
        legacyHotNumbers: Object.freeze([...input.heatmap.legacyHotNumbers]),
        fusionHotNumbers: Object.freeze([...input.heatmap.fusionHotNumbers]),
        fusionPressure: input.heatmap.fusionPressure,
        recencyPressure: input.heatmap.recencyPressure,
        dispersionScore: input.heatmap.dispersionScore,
        mode: input.heatmap.mode,
      }),
    });
  }
  private round6(value: number): number { return Math.round(value * 1000000) / 1000000; }
}
