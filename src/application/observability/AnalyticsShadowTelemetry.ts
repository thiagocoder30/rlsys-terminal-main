export interface AnalyticsShadowTelemetry {
  readonly timestamp: string;
  readonly triplicacao: {
    readonly parityMismatch: boolean;
    readonly ratioDrift: number;
    readonly legacyPattern: string;
    readonly advancedPattern: string;
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

export interface TelemetrySink {
  write(telemetry: AnalyticsShadowTelemetry): void;
}
