export type RuntimeMemoryPressureV2 = "LOW" | "ELEVATED" | "HIGH" | "CRITICAL";

export interface RuntimeMemoryPressureSampleV2 {
  readonly heapUsedBytes: number;
  readonly heapTotalBytes: number;
  readonly rssBytes: number;
  readonly baselineHeapUsedBytes: number;
}

export interface RuntimeMemoryPressurePolicyV2 {
  readonly elevatedHeapRatio: number;
  readonly highHeapRatio: number;
  readonly criticalHeapRatio: number;
  readonly highHeapDriftBytes: number;
  readonly criticalHeapDriftBytes: number;
  readonly highRssBytes: number;
  readonly criticalRssBytes: number;
}

export interface RuntimeMemoryPressureClassificationV2 {
  readonly pressure: RuntimeMemoryPressureV2;
  readonly heapRatio: number;
  readonly heapDriftBytes: number;
  readonly reasons: readonly string[];
}

/**
 * Hybrid memory pressure classifier for constrained mobile Node.js runtimes.
 *
 * The original heapUsed/heapTotal-only model is too sensitive in Termux/proot
 * because V8 may keep heapTotal low, producing high ratios for benign growth.
 *
 * This classifier combines:
 * - heap ratio;
 * - absolute heap drift;
 * - RSS pressure.
 *
 * Complexity:
 * - O(1), fixed rule set.
 * - Memory O(1).
 */
export class RuntimeMemoryPressureClassifierV2 {
  public classify(
    sample: RuntimeMemoryPressureSampleV2,
    policy: RuntimeMemoryPressurePolicyV2,
  ): RuntimeMemoryPressureClassificationV2 {
    this.validate(sample, policy);

    const heapRatio = sample.heapTotalBytes === 0
      ? 0
      : sample.heapUsedBytes / sample.heapTotalBytes;

    const heapDriftBytes = Math.max(0, sample.heapUsedBytes - sample.baselineHeapUsedBytes);
    const reasons: string[] = [];

    if (
      heapRatio >= policy.criticalHeapRatio
      && (
        heapDriftBytes >= policy.criticalHeapDriftBytes
        || sample.rssBytes >= policy.criticalRssBytes
      )
    ) {
      reasons.push("critical heap ratio confirmed by absolute memory pressure");
      return {
        pressure: "CRITICAL",
        heapRatio,
        heapDriftBytes,
        reasons,
      };
    }

    if (
      heapRatio >= policy.highHeapRatio
      && (
        heapDriftBytes >= policy.highHeapDriftBytes
        || sample.rssBytes >= policy.highRssBytes
      )
    ) {
      reasons.push("high heap ratio confirmed by absolute memory pressure");
      return {
        pressure: "HIGH",
        heapRatio,
        heapDriftBytes,
        reasons,
      };
    }

    if (heapRatio >= policy.elevatedHeapRatio) {
      reasons.push("heap ratio elevated without absolute pressure confirmation");
      return {
        pressure: "ELEVATED",
        heapRatio,
        heapDriftBytes,
        reasons,
      };
    }

    return {
      pressure: "LOW",
      heapRatio,
      heapDriftBytes,
      reasons: ["memory pressure within calibrated baseline"],
    };
  }

  private validate(
    sample: RuntimeMemoryPressureSampleV2,
    policy: RuntimeMemoryPressurePolicyV2,
  ): void {
    const sampleFields: ReadonlyArray<readonly [string, number]> = [
      ["heapUsedBytes", sample.heapUsedBytes],
      ["heapTotalBytes", sample.heapTotalBytes],
      ["rssBytes", sample.rssBytes],
      ["baselineHeapUsedBytes", sample.baselineHeapUsedBytes],
    ];

    for (const [name, value] of sampleFields) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid memory pressure sample: ${name} must be finite and non-negative.`);
      }
    }

    const policyFields: ReadonlyArray<readonly [string, number]> = [
      ["elevatedHeapRatio", policy.elevatedHeapRatio],
      ["highHeapRatio", policy.highHeapRatio],
      ["criticalHeapRatio", policy.criticalHeapRatio],
      ["highHeapDriftBytes", policy.highHeapDriftBytes],
      ["criticalHeapDriftBytes", policy.criticalHeapDriftBytes],
      ["highRssBytes", policy.highRssBytes],
      ["criticalRssBytes", policy.criticalRssBytes],
    ];

    for (const [name, value] of policyFields) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid memory pressure policy: ${name} must be finite and non-negative.`);
      }
    }

    if (
      policy.elevatedHeapRatio > policy.highHeapRatio
      || policy.highHeapRatio > policy.criticalHeapRatio
    ) {
      throw new Error("Invalid memory pressure policy: heap ratio thresholds must be ordered.");
    }

    if (
      policy.highHeapDriftBytes > policy.criticalHeapDriftBytes
      || policy.highRssBytes > policy.criticalRssBytes
    ) {
      throw new Error("Invalid memory pressure policy: absolute thresholds must be ordered.");
    }
  }
}

export function createMobileMemoryPressurePolicyV2(): RuntimeMemoryPressurePolicyV2 {
  return {
    elevatedHeapRatio: 0.7,
    highHeapRatio: 0.85,
    criticalHeapRatio: 0.95,
    highHeapDriftBytes: 8 * 1024 * 1024,
    criticalHeapDriftBytes: 24 * 1024 * 1024,
    highRssBytes: 512 * 1024 * 1024,
    criticalRssBytes: 768 * 1024 * 1024,
  };
}
