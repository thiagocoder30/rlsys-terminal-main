export type RuntimeSoakPressureLevel = "LOW" | "ELEVATED" | "HIGH" | "CRITICAL";

export interface RuntimeSoakIterationSample {
  readonly iteration: number;
  readonly heapUsedBytes: number;
  readonly eventLoopLagMs: number;
  readonly pressure: RuntimeSoakPressureLevel;
}

export interface RuntimeSoakWorkloadPort {
  execute(iteration: number): Promise<RuntimeSoakIterationSample>;
}

export interface RuntimeSoakConfiguration {
  readonly iterations: number;
  readonly maxHeapDriftBytes: number;
  readonly maxPeakEventLoopLagMs: number;
  readonly forbiddenPressure: RuntimeSoakPressureLevel;
}

export interface RuntimeSoakResult {
  readonly stable: boolean;
  readonly iterations: number;
  readonly baselineHeapBytes: number;
  readonly finalHeapBytes: number;
  readonly heapDriftBytes: number;
  readonly peakEventLoopLagMs: number;
  readonly pressureViolations: number;
  readonly violationMessages: readonly string[];
}

/**
 * Runs compressed stability checks over a deterministic runtime workload.
 *
 * This harness does not own timers or background workers. It executes a bounded
 * number of iterations and evaluates memory drift, peak lag and pressure
 * violations.
 *
 * Complexity:
 * - O(n), where n is the configured iteration count.
 * - Memory O(1), stores only aggregate metrics.
 */
export class RuntimeStabilitySoakHarness {
  public constructor(
    private readonly workload: RuntimeSoakWorkloadPort,
  ) {}

  public async run(configuration: RuntimeSoakConfiguration): Promise<RuntimeSoakResult> {
    this.validateConfiguration(configuration);

    let baselineHeapBytes: number | null = null;
    let finalHeapBytes = 0;
    let peakEventLoopLagMs = 0;
    let pressureViolations = 0;
    const violationMessages: string[] = [];

    for (let iteration = 1; iteration <= configuration.iterations; iteration += 1) {
      const sample = await this.workload.execute(iteration);
      this.validateSample(sample, iteration);

      if (baselineHeapBytes === null) {
        baselineHeapBytes = sample.heapUsedBytes;
      }

      finalHeapBytes = sample.heapUsedBytes;
      peakEventLoopLagMs = Math.max(peakEventLoopLagMs, sample.eventLoopLagMs);

      if (this.isPressureViolation(sample.pressure, configuration.forbiddenPressure)) {
        pressureViolations += 1;
      }
    }

    const safeBaseline = baselineHeapBytes ?? 0;
    const heapDriftBytes = finalHeapBytes - safeBaseline;

    if (heapDriftBytes > configuration.maxHeapDriftBytes) {
      violationMessages.push(
        `Heap drift exceeded limit: ${heapDriftBytes} > ${configuration.maxHeapDriftBytes}.`,
      );
    }

    if (peakEventLoopLagMs > configuration.maxPeakEventLoopLagMs) {
      violationMessages.push(
        `Peak event loop lag exceeded limit: ${peakEventLoopLagMs} > ${configuration.maxPeakEventLoopLagMs}.`,
      );
    }

    if (pressureViolations > 0) {
      violationMessages.push(
        `Memory pressure violated policy ${pressureViolations} time(s).`,
      );
    }

    return {
      stable: violationMessages.length === 0,
      iterations: configuration.iterations,
      baselineHeapBytes: safeBaseline,
      finalHeapBytes,
      heapDriftBytes,
      peakEventLoopLagMs,
      pressureViolations,
      violationMessages,
    };
  }

  private validateConfiguration(configuration: RuntimeSoakConfiguration): void {
    if (!Number.isInteger(configuration.iterations) || configuration.iterations <= 0) {
      throw new Error("Invalid soak configuration: iterations must be a positive integer.");
    }

    if (!Number.isFinite(configuration.maxHeapDriftBytes) || configuration.maxHeapDriftBytes < 0) {
      throw new Error("Invalid soak configuration: maxHeapDriftBytes must be non-negative.");
    }

    if (!Number.isFinite(configuration.maxPeakEventLoopLagMs) || configuration.maxPeakEventLoopLagMs < 0) {
      throw new Error("Invalid soak configuration: maxPeakEventLoopLagMs must be non-negative.");
    }
  }

  private validateSample(sample: RuntimeSoakIterationSample, expectedIteration: number): void {
    if (sample.iteration !== expectedIteration) {
      throw new Error("Invalid soak sample: iteration sequence mismatch.");
    }

    if (!Number.isFinite(sample.heapUsedBytes) || sample.heapUsedBytes < 0) {
      throw new Error("Invalid soak sample: heapUsedBytes must be non-negative.");
    }

    if (!Number.isFinite(sample.eventLoopLagMs) || sample.eventLoopLagMs < 0) {
      throw new Error("Invalid soak sample: eventLoopLagMs must be non-negative.");
    }
  }

  private isPressureViolation(
    pressure: RuntimeSoakPressureLevel,
    forbiddenPressure: RuntimeSoakPressureLevel,
  ): boolean {
    return this.pressureRank(pressure) >= this.pressureRank(forbiddenPressure);
  }

  private pressureRank(pressure: RuntimeSoakPressureLevel): number {
    switch (pressure) {
      case "LOW":
        return 0;
      case "ELEVATED":
        return 1;
      case "HIGH":
        return 2;
      case "CRITICAL":
        return 3;
    }
  }
}
