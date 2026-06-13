import type { AnalyticsShadowTelemetry } from './AnalyticsShadowTelemetry.js';

export interface AnalyticsShadowAuditorInput {
  readonly legacyPattern: string;
  readonly advancedPattern: string;
  readonly legacyRatio: number;
  readonly advancedRatio: number;
}

export class AnalyticsShadowAuditor {
  public capture(
    input: AnalyticsShadowAuditorInput,
  ): AnalyticsShadowTelemetry {
    return Object.freeze({
      timestamp: new Date().toISOString(),

      triplicacao: Object.freeze({
        parityMismatch:
          input.legacyPattern !== input.advancedPattern,

        ratioDrift: Math.abs(
          input.legacyRatio - input.advancedRatio,
        ),

        legacyPattern: input.legacyPattern,
        advancedPattern: input.advancedPattern,
      }),
    });
  }
}
