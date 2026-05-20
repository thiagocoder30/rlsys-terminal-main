import {
  RuntimeStressSample,
  RuntimeStressScenario,
} from '../../domain/stress';

export interface RuntimeStressTelemetryFrame {
  readonly scenario: RuntimeStressScenario;
  readonly iterations: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
  readonly maxLatencyMs: number;
  readonly rejectedEvents: number;
  readonly blockedEvents: number;
}

export interface RuntimeStressSamplerResult {
  readonly accepted: boolean;
  readonly sample: RuntimeStressSample | null;
  readonly reason: string;
}

/**
 * Converts compact runtime telemetry frames into stress samples.
 *
 * This class is an application adapter:
 * - domain/stress evaluates samples
 * - application/stress translates live telemetry into samples
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class RuntimeStressSampler {
  public sample(frame: RuntimeStressTelemetryFrame): RuntimeStressSamplerResult {
    if (!this.isValidFrame(frame)) {
      return {
        accepted: false,
        sample: null,
        reason: 'invalid runtime stress telemetry frame',
      };
    }

    const heapDeltaBytes = Math.max(
      0,
      frame.heapUsedAfterBytes - frame.heapUsedBeforeBytes,
    );

    return {
      accepted: true,
      sample: {
        scenario: frame.scenario,
        iterations: frame.iterations,
        heapDeltaBytes,
        maxLatencyMs: frame.maxLatencyMs,
        rejectedEvents: frame.rejectedEvents,
        blockedEvents: frame.blockedEvents,
      },
      reason: 'runtime stress telemetry frame converted',
    };
  }

  private isValidFrame(frame: RuntimeStressTelemetryFrame): boolean {
    return (
      Number.isInteger(frame.iterations) &&
      frame.iterations >= 0 &&
      Number.isFinite(frame.heapUsedBeforeBytes) &&
      frame.heapUsedBeforeBytes >= 0 &&
      Number.isFinite(frame.heapUsedAfterBytes) &&
      frame.heapUsedAfterBytes >= 0 &&
      Number.isFinite(frame.maxLatencyMs) &&
      frame.maxLatencyMs >= 0 &&
      Number.isInteger(frame.rejectedEvents) &&
      frame.rejectedEvents >= 0 &&
      Number.isInteger(frame.blockedEvents) &&
      frame.blockedEvents >= 0
    );
  }
}
