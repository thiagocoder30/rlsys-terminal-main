export type RuntimeMemoryPressure = "LOW" | "ELEVATED" | "HIGH" | "CRITICAL";

export interface RuntimeMemorySample {
  readonly heapUsedBytes: number;
  readonly heapTotalBytes: number;
  readonly rssBytes: number;
  readonly externalBytes: number;
}

export interface RuntimeEventLoopLagSample {
  readonly expectedAtEpochMs: number;
  readonly observedAtEpochMs: number;
}

export interface RuntimeTelemetryCounters {
  readonly eventsPublished: number;
  readonly eventsFailed: number;
  readonly degradedZones: number;
  readonly openCircuits: number;
  readonly checkpointsSaved: number;
}

export interface RuntimeTelemetrySnapshot {
  readonly sampledAtEpochMs: number;
  readonly uptimeMs: number;
  readonly memory: RuntimeMemorySample;
  readonly memoryPressure: RuntimeMemoryPressure;
  readonly eventLoopLagMs: number;
  readonly eventsPerMinute: number;
  readonly failureRate: number;
  readonly degradedZones: number;
  readonly openCircuits: number;
  readonly checkpointsSaved: number;
}

export interface RuntimeTelemetryClockPort {
  nowEpochMs(): number;
}

export interface RuntimeMemoryUsagePort {
  read(): RuntimeMemorySample;
}

/**
 * Classifies memory pressure using bounded deterministic thresholds.
 *
 * Complexity: O(1), memory O(1).
 */
export class RuntimeTelemetryPressureClassifier {
  public classify(memory: RuntimeMemorySample): RuntimeMemoryPressure {
    this.validateMemory(memory);

    if (memory.heapTotalBytes === 0) {
      return "LOW";
    }

    const heapRatio = memory.heapUsedBytes / memory.heapTotalBytes;

    if (heapRatio >= 0.95) {
      return "CRITICAL";
    }

    if (heapRatio >= 0.85) {
      return "HIGH";
    }

    if (heapRatio >= 0.7) {
      return "ELEVATED";
    }

    return "LOW";
  }

  private validateMemory(memory: RuntimeMemorySample): void {
    const fields: ReadonlyArray<readonly [string, number]> = [
      ["heapUsedBytes", memory.heapUsedBytes],
      ["heapTotalBytes", memory.heapTotalBytes],
      ["rssBytes", memory.rssBytes],
      ["externalBytes", memory.externalBytes],
    ];

    for (const [name, value] of fields) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid telemetry memory sample: ${name} must be finite and non-negative.`);
      }
    }

    if (memory.heapUsedBytes > memory.heapTotalBytes && memory.heapTotalBytes > 0) {
      throw new Error("Invalid telemetry memory sample: heapUsedBytes cannot exceed heapTotalBytes.");
    }
  }
}

/**
 * Computes lightweight runtime telemetry snapshots.
 *
 * No timers are owned by this class. The caller decides when to sample,
 * preventing telemetry from becoming a hidden runtime workload.
 *
 * Complexity: O(1), memory O(1).
 */
export class RuntimeTelemetrySnapshotComposer {
  public constructor(
    private readonly pressureClassifier: RuntimeTelemetryPressureClassifier,
  ) {}

  public compose(input: {
    readonly sampledAtEpochMs: number;
    readonly runtimeStartedAtEpochMs: number;
    readonly memory: RuntimeMemorySample;
    readonly lagSample: RuntimeEventLoopLagSample;
    readonly counters: RuntimeTelemetryCounters;
    readonly windowMs: number;
  }): RuntimeTelemetrySnapshot {
    this.validateInput(input);

    const eventLoopLagMs = Math.max(0, input.lagSample.observedAtEpochMs - input.lagSample.expectedAtEpochMs);
    const eventsPerMinute = input.windowMs === 0
      ? 0
      : (input.counters.eventsPublished / input.windowMs) * 60_000;

    const failureRate = input.counters.eventsPublished === 0
      ? 0
      : input.counters.eventsFailed / input.counters.eventsPublished;

    return {
      sampledAtEpochMs: input.sampledAtEpochMs,
      uptimeMs: input.sampledAtEpochMs - input.runtimeStartedAtEpochMs,
      memory: input.memory,
      memoryPressure: this.pressureClassifier.classify(input.memory),
      eventLoopLagMs,
      eventsPerMinute,
      failureRate,
      degradedZones: input.counters.degradedZones,
      openCircuits: input.counters.openCircuits,
      checkpointsSaved: input.counters.checkpointsSaved,
    };
  }

  private validateInput(input: {
    readonly sampledAtEpochMs: number;
    readonly runtimeStartedAtEpochMs: number;
    readonly memory: RuntimeMemorySample;
    readonly lagSample: RuntimeEventLoopLagSample;
    readonly counters: RuntimeTelemetryCounters;
    readonly windowMs: number;
  }): void {
    const numericFields: ReadonlyArray<readonly [string, number]> = [
      ["sampledAtEpochMs", input.sampledAtEpochMs],
      ["runtimeStartedAtEpochMs", input.runtimeStartedAtEpochMs],
      ["windowMs", input.windowMs],
      ["eventsPublished", input.counters.eventsPublished],
      ["eventsFailed", input.counters.eventsFailed],
      ["degradedZones", input.counters.degradedZones],
      ["openCircuits", input.counters.openCircuits],
      ["checkpointsSaved", input.counters.checkpointsSaved],
    ];

    for (const [name, value] of numericFields) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid telemetry input: ${name} must be finite and non-negative.`);
      }
    }

    if (input.sampledAtEpochMs < input.runtimeStartedAtEpochMs) {
      throw new Error("Invalid telemetry input: sampledAtEpochMs cannot be before runtimeStartedAtEpochMs.");
    }

    if (input.counters.eventsFailed > input.counters.eventsPublished) {
      throw new Error("Invalid telemetry input: eventsFailed cannot exceed eventsPublished.");
    }
  }
}

/**
 * Samples runtime memory and event-loop lag from injected ports.
 *
 * The class is deterministic in tests and light enough for Termux/proot usage.
 *
 * Complexity: O(1), memory O(1).
 */
export class RuntimeTelemetrySampler {
  public constructor(
    private readonly clock: RuntimeTelemetryClockPort,
    private readonly memoryUsage: RuntimeMemoryUsagePort,
  ) {}

  public sampleMemory(): RuntimeMemorySample {
    return this.memoryUsage.read();
  }

  public sampleLag(expectedAtEpochMs: number): RuntimeEventLoopLagSample {
    if (!Number.isFinite(expectedAtEpochMs) || expectedAtEpochMs < 0) {
      throw new Error("Invalid event loop lag sample: expectedAtEpochMs must be finite and non-negative.");
    }

    return {
      expectedAtEpochMs,
      observedAtEpochMs: this.clock.nowEpochMs(),
    };
  }
}
