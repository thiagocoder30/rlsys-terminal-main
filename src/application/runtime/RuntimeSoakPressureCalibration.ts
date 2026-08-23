export type RuntimePressureLevel =
  | "LOW"
  | "ELEVATED"
  | "HIGH"
  | "CRITICAL";

export interface RuntimeSoakPressureCalibrationConfig {
  readonly warmupIterations: number;
  readonly allowedTransientPressureSpikes: number;
  readonly sustainedPressureWindow: number;
  readonly forbiddenPressure: RuntimePressureLevel;
}

export interface RuntimeSoakPressureSample {
  readonly iteration: number;
  readonly pressure: RuntimePressureLevel;
}

export interface RuntimeSoakPressureCalibrationResult {
  readonly measuredIterations: number;
  readonly ignoredWarmupSamples: number;
  readonly transientPressureSpikes: number;
  readonly sustainedPressureViolations: number;
  readonly stable: boolean;
}

/**
 * Incremental O(1)-memory pressure calibration accumulator.
 *
 * It preserves the exact semantics of RuntimeSoakPressureCalibration.evaluate
 * while allowing long-running soak processes to discard samples immediately
 * after observation.
 */
export class RuntimeSoakPressureCalibrationAccumulator {
  private ignoredWarmupSamples = 0;
  private measuredIterations = 0;
  private transientPressureSpikes = 0;
  private sustainedPressureViolations = 0;
  private currentPressureRun = 0;

  public constructor(
    private readonly config:
      RuntimeSoakPressureCalibrationConfig,
  ) {
    RuntimeSoakPressureCalibration.validateConfig(
      config,
    );
  }

  public observe(
    sample: RuntimeSoakPressureSample,
  ): void {
    if (
      sample.iteration <=
      this.config.warmupIterations
    ) {
      this.ignoredWarmupSamples += 1;
      return;
    }

    this.measuredIterations += 1;

    if (
      RuntimeSoakPressureCalibration.isPressureViolation(
        sample.pressure,
        this.config.forbiddenPressure,
      )
    ) {
      this.transientPressureSpikes += 1;
      this.currentPressureRun += 1;

      if (
        this.currentPressureRun >=
        this.config.sustainedPressureWindow
      ) {
        this.sustainedPressureViolations += 1;
      }

      return;
    }

    this.currentPressureRun = 0;
  }

  public result():
    RuntimeSoakPressureCalibrationResult {
    return Object.freeze({
      measuredIterations:
        this.measuredIterations,

      ignoredWarmupSamples:
        this.ignoredWarmupSamples,

      transientPressureSpikes:
        this.transientPressureSpikes,

      sustainedPressureViolations:
        this.sustainedPressureViolations,

      stable:
        this.sustainedPressureViolations === 0 &&
        this.transientPressureSpikes <=
          this.config.allowedTransientPressureSpikes,
    });
  }
}

/**
 * Calibrates soak pressure evaluation for mobile runtimes.
 *
 * evaluate() remains available for compatibility with existing callers and
 * tests. Long-running callers should prefer createAccumulator() so samples
 * can be consumed incrementally with O(1) memory.
 *
 * Complexity:
 * - evaluate: O(n) time, O(1) internal memory.
 * - accumulator: O(1) per sample, O(1) memory.
 */
export class RuntimeSoakPressureCalibration {
  public createAccumulator(
    config: RuntimeSoakPressureCalibrationConfig,
  ): RuntimeSoakPressureCalibrationAccumulator {
    return new RuntimeSoakPressureCalibrationAccumulator(
      config,
    );
  }

  public evaluate(
    samples: readonly RuntimeSoakPressureSample[],
    config: RuntimeSoakPressureCalibrationConfig,
  ): RuntimeSoakPressureCalibrationResult {
    const accumulator =
      this.createAccumulator(
        config,
      );

    for (const sample of samples) {
      accumulator.observe(
        sample,
      );
    }

    return accumulator.result();
  }

  public static validateConfig(
    config: RuntimeSoakPressureCalibrationConfig,
  ): void {
    const numericFields:
      ReadonlyArray<
        readonly [string, number]
      > = [
        [
          "warmupIterations",
          config.warmupIterations,
        ],
        [
          "allowedTransientPressureSpikes",
          config.allowedTransientPressureSpikes,
        ],
        [
          "sustainedPressureWindow",
          config.sustainedPressureWindow,
        ],
      ];

    for (
      const [name, value]
      of numericFields
    ) {
      if (
        !Number.isInteger(value) ||
        value < 0
      ) {
        throw new Error(
          `Invalid pressure calibration config: ${name} must be a non-negative integer.`,
        );
      }
    }

    if (
      config.sustainedPressureWindow <= 0
    ) {
      throw new Error(
        "Invalid pressure calibration config: sustainedPressureWindow must be positive.",
      );
    }
  }

  public static isPressureViolation(
    current: RuntimePressureLevel,
    forbidden: RuntimePressureLevel,
  ): boolean {
    return (
      this.rank(current) >=
      this.rank(forbidden)
    );
  }

  private static rank(
    level: RuntimePressureLevel,
  ): number {
    switch (level) {
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
