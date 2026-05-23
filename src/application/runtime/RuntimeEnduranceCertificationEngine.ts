export type RuntimeEnduranceCertificationStatus =
  | "CERTIFIED"
  | "WARNING"
  | "FAILED";

export interface RuntimeEnduranceSoakResult {
  readonly stable: boolean;
  readonly iterations: number;
  readonly heapDriftBytes: number;
  readonly peakEventLoopLagMs: number;
  readonly pressureViolations: number;
}

export interface RuntimeEnduranceSoakReport {
  readonly generatedAtEpochMs: number;
  readonly durationMs: number;
  readonly result: RuntimeEnduranceSoakResult;
}

export interface RuntimeEnduranceCertificationPolicy {
  readonly minimumIterations: number;
  readonly minimumDurationMs: number;
  readonly maxHeapDriftBytes: number;
  readonly maxPeakEventLoopLagMs: number;
  readonly maxPressureViolations: number;
  readonly warningHeapDriftRatio: number;
  readonly warningLagRatio: number;
}

export interface RuntimeEnduranceCertification {
  readonly status: RuntimeEnduranceCertificationStatus;
  readonly certified: boolean;
  readonly score: number;
  readonly reasons: readonly string[];
}

/**
 * Certifies whether a real soak report is acceptable for supervised runtime endurance.
 *
 * The engine is pure and deterministic. It does not read files or own timers.
 *
 * Complexity:
 * - O(1), fixed number of checks.
 * - Memory O(1).
 */
export class RuntimeEnduranceCertificationEngine {
  public certify(
    report: RuntimeEnduranceSoakReport,
    policy: RuntimeEnduranceCertificationPolicy,
  ): RuntimeEnduranceCertification {
    this.validate(report, policy);

    const reasons: string[] = [];
    let hardFailures = 0;
    let warnings = 0;

    if (!report.result.stable) {
      hardFailures += 1;
      reasons.push("Soak result is not stable.");
    }

    if (report.result.iterations < policy.minimumIterations) {
      hardFailures += 1;
      reasons.push("Soak report has fewer iterations than required.");
    }

    if (report.durationMs < policy.minimumDurationMs) {
      hardFailures += 1;
      reasons.push("Soak report duration is shorter than required.");
    }

    if (report.result.heapDriftBytes > policy.maxHeapDriftBytes) {
      hardFailures += 1;
      reasons.push("Heap drift exceeded certification policy.");
    } else if (
      report.result.heapDriftBytes >= policy.maxHeapDriftBytes * policy.warningHeapDriftRatio
    ) {
      warnings += 1;
      reasons.push("Heap drift is close to the certification limit.");
    }

    if (report.result.peakEventLoopLagMs > policy.maxPeakEventLoopLagMs) {
      hardFailures += 1;
      reasons.push("Peak event loop lag exceeded certification policy.");
    } else if (
      report.result.peakEventLoopLagMs >= policy.maxPeakEventLoopLagMs * policy.warningLagRatio
    ) {
      warnings += 1;
      reasons.push("Peak event loop lag is close to the certification limit.");
    }

    if (report.result.pressureViolations > policy.maxPressureViolations) {
      hardFailures += 1;
      reasons.push("Memory pressure violations exceeded certification policy.");
    }

    const score = this.score(hardFailures, warnings);

    if (hardFailures > 0) {
      return {
        status: "FAILED",
        certified: false,
        score,
        reasons,
      };
    }

    if (warnings > 0) {
      return {
        status: "WARNING",
        certified: false,
        score,
        reasons,
      };
    }

    return {
      status: "CERTIFIED",
      certified: true,
      score,
      reasons: ["Runtime endurance report satisfies certification policy."],
    };
  }

  private score(hardFailures: number, warnings: number): number {
    return Math.max(0, 100 - hardFailures * 35 - warnings * 10);
  }

  private validate(
    report: RuntimeEnduranceSoakReport,
    policy: RuntimeEnduranceCertificationPolicy,
  ): void {
    const numericFields: ReadonlyArray<readonly [string, number]> = [
      ["generatedAtEpochMs", report.generatedAtEpochMs],
      ["durationMs", report.durationMs],
      ["iterations", report.result.iterations],
      ["heapDriftBytes", report.result.heapDriftBytes],
      ["peakEventLoopLagMs", report.result.peakEventLoopLagMs],
      ["pressureViolations", report.result.pressureViolations],
      ["minimumIterations", policy.minimumIterations],
      ["minimumDurationMs", policy.minimumDurationMs],
      ["maxHeapDriftBytes", policy.maxHeapDriftBytes],
      ["maxPeakEventLoopLagMs", policy.maxPeakEventLoopLagMs],
      ["maxPressureViolations", policy.maxPressureViolations],
      ["warningHeapDriftRatio", policy.warningHeapDriftRatio],
      ["warningLagRatio", policy.warningLagRatio],
    ];

    for (const [name, value] of numericFields) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid endurance certification input: ${name} must be finite and non-negative.`);
      }
    }

    if (policy.warningHeapDriftRatio > 1 || policy.warningLagRatio > 1) {
      throw new Error("Invalid endurance certification policy: warning ratios must be <= 1.");
    }

    if (policy.warningHeapDriftRatio === 0 || policy.warningLagRatio === 0) {
      throw new Error("Invalid endurance certification policy: warning ratios must be > 0.");
    }
  }
}
