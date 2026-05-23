import type {
  RuntimeEnduranceCertificationPolicy,
} from "./RuntimeEnduranceCertificationEngine.js";

export type RuntimeBaselineProfileKind =
  | "MOBILE_CONSERVATIVE"
  | "MOBILE_BALANCED"
  | "DESKTOP_BALANCED"
  | "CUSTOM";

export interface RuntimeBaselineCertificationProfile {
  readonly kind: RuntimeBaselineProfileKind;
  readonly label: string;
  readonly hardwareClass: string;
  readonly recommendedUse: string;
  readonly policy: RuntimeEnduranceCertificationPolicy;
}

export interface RuntimeBaselineCustomInput {
  readonly label: string;
  readonly hardwareClass: string;
  readonly recommendedUse: string;
  readonly policy: RuntimeEnduranceCertificationPolicy;
}

/**
 * Factory for institutional runtime endurance certification baselines.
 *
 * It keeps hardware-specific limits centralized, explicit and auditable.
 *
 * Complexity:
 * - O(1), fixed profile construction.
 * - Memory O(1).
 */
export class RuntimeBaselinePolicyFactory {
  public create(kind: Exclude<RuntimeBaselineProfileKind, "CUSTOM">): RuntimeBaselineCertificationProfile {
    if (kind === "MOBILE_CONSERVATIVE") {
      return {
        kind,
        label: "Galaxy A10s / Helio P22 conservative baseline",
        hardwareClass: "mobile-low-memory",
        recommendedUse: "Termux/ArchLinux paper trading supervision on 2GB RAM.",
        policy: {
          minimumIterations: 50_000,
          minimumDurationMs: 60_000,
          maxHeapDriftBytes: 12 * 1024 * 1024,
          maxPeakEventLoopLagMs: 250,
          maxPressureViolations: 0,
          warningHeapDriftRatio: 0.75,
          warningLagRatio: 0.75,
        },
      };
    }

    if (kind === "MOBILE_BALANCED") {
      return {
        kind,
        label: "Mobile balanced baseline",
        hardwareClass: "mobile",
        recommendedUse: "Longer paper supervision on mobile hardware with moderate thermal headroom.",
        policy: {
          minimumIterations: 100_000,
          minimumDurationMs: 120_000,
          maxHeapDriftBytes: 24 * 1024 * 1024,
          maxPeakEventLoopLagMs: 350,
          maxPressureViolations: 0,
          warningHeapDriftRatio: 0.8,
          warningLagRatio: 0.8,
        },
      };
    }

    return {
      kind,
      label: "Desktop balanced baseline",
      hardwareClass: "desktop",
      recommendedUse: "Development workstation or server-like runtime validation.",
      policy: {
        minimumIterations: 250_000,
        minimumDurationMs: 300_000,
        maxHeapDriftBytes: 64 * 1024 * 1024,
        maxPeakEventLoopLagMs: 150,
        maxPressureViolations: 0,
        warningHeapDriftRatio: 0.85,
        warningLagRatio: 0.85,
      },
    };
  }

  public custom(input: RuntimeBaselineCustomInput): RuntimeBaselineCertificationProfile {
    this.validateCustom(input);

    return {
      kind: "CUSTOM",
      label: input.label,
      hardwareClass: input.hardwareClass,
      recommendedUse: input.recommendedUse,
      policy: input.policy,
    };
  }

  private validateCustom(input: RuntimeBaselineCustomInput): void {
    if (input.label.trim().length === 0) {
      throw new Error("Invalid baseline profile: label cannot be empty.");
    }

    if (input.hardwareClass.trim().length === 0) {
      throw new Error("Invalid baseline profile: hardwareClass cannot be empty.");
    }

    if (input.recommendedUse.trim().length === 0) {
      throw new Error("Invalid baseline profile: recommendedUse cannot be empty.");
    }

    const numericFields: ReadonlyArray<readonly [string, number]> = [
      ["minimumIterations", input.policy.minimumIterations],
      ["minimumDurationMs", input.policy.minimumDurationMs],
      ["maxHeapDriftBytes", input.policy.maxHeapDriftBytes],
      ["maxPeakEventLoopLagMs", input.policy.maxPeakEventLoopLagMs],
      ["maxPressureViolations", input.policy.maxPressureViolations],
      ["warningHeapDriftRatio", input.policy.warningHeapDriftRatio],
      ["warningLagRatio", input.policy.warningLagRatio],
    ];

    for (const [name, value] of numericFields) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid baseline profile: ${name} must be finite and non-negative.`);
      }
    }

    if (input.policy.warningHeapDriftRatio <= 0 || input.policy.warningHeapDriftRatio > 1) {
      throw new Error("Invalid baseline profile: warningHeapDriftRatio must be between 0 and 1.");
    }

    if (input.policy.warningLagRatio <= 0 || input.policy.warningLagRatio > 1) {
      throw new Error("Invalid baseline profile: warningLagRatio must be between 0 and 1.");
    }
  }
}
