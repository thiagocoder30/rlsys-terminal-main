export type RuntimePressureLevel = "LOW" | "ELEVATED" | "HIGH" | "CRITICAL";

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
 * Calibrates soak pressure evaluation for mobile runtimes.
 *
 * Warm-up samples are ignored to avoid classifying initial GC/heap expansion as
 * sustained failure. After warm-up, transient spikes are counted separately from
 * sustained pressure windows.
 *
 * Complexity:
 * - O(n), where n is sample count.
 * - Memory O(1).
 */
export class RuntimeSoakPressureCalibration {
  public evaluate(
    samples: readonly RuntimeSoakPressureSample[],
    config: RuntimeSoakPressureCalibrationConfig,
  ): RuntimeSoakPressureCalibrationResult {
    this.validate(config);

    let ignoredWarmupSamples = 0;
    let measuredIterations = 0;
    let transientPressureSpikes = 0;
    let sustainedPressureViolations = 0;
    let currentPressureRun = 0;

    for (const sample of samples) {
      if (sample.iteration <= config.warmupIterations) {
        ignoredWarmupSamples += 1;
        continue;
      }

      measuredIterations += 1;

      if (this.isViolation(sample.pressure, config.forbiddenPressure)) {
        transientPressureSpikes += 1;
        currentPressureRun += 1;

        if (currentPressureRun >= config.sustainedPressureWindow) {
          sustainedPressureViolations += 1;
        }
      } else {
        currentPressureRun = 0;
      }
    }

    return {
      measuredIterations,
      ignoredWarmupSamples,
      transientPressureSpikes,
      sustainedPressureViolations,
      stable:
        sustainedPressureViolations === 0
        && transientPressureSpikes <= config.allowedTransientPressureSpikes,
    };
  }

  private validate(config: RuntimeSoakPressureCalibrationConfig): void {
    const numericFields: ReadonlyArray<readonly [string, number]> = [
      ["warmupIterations", config.warmupIterations],
      ["allowedTransientPressureSpikes", config.allowedTransientPressureSpikes],
      ["sustainedPressureWindow", config.sustainedPressureWindow],
    ];

    for (const [name, value] of numericFields) {
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`Invalid pressure calibration config: ${name} must be a non-negative integer.`);
      }
    }

    if (config.sustainedPressureWindow <= 0) {
      throw new Error("Invalid pressure calibration config: sustainedPressureWindow must be positive.");
    }
  }

  private isViolation(current: RuntimePressureLevel, forbidden: RuntimePressureLevel): boolean {
    return this.rank(current) >= this.rank(forbidden);
  }

  private rank(level: RuntimePressureLevel): number {
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
