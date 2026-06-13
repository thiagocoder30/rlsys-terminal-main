import type { AnalyticsShadowTelemetry, TelemetrySink } from './AnalyticsShadowTelemetry.js';

export class NullTelemetrySink implements TelemetrySink {
  public static readonly INSTANCE = new NullTelemetrySink();
  public write(_telemetry: AnalyticsShadowTelemetry): void {}
}
