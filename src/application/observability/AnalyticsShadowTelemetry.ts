export interface AnalyticsShadowTelemetry {
  readonly timestamp: string;

  readonly triplicacao: {
    readonly parityMismatch: boolean;
    readonly ratioDrift: number;
    readonly legacyPattern: string;
    readonly advancedPattern: string;
  };
}

export interface TelemetrySink {
  write(telemetry: AnalyticsShadowTelemetry): void;
}
