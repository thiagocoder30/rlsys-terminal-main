#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-090-runtime-baseline-certification-profile"
COMMIT_MSG="feat(runtime): add baseline certification profiles"

resolve_root() {
  if git rev-parse --show-toplevel >/dev/null 2>&1; then
    git rev-parse --show-toplevel
    return
  fi

  if [ -n "${PROJECT_DIR:-}" ] && [ -f "$PROJECT_DIR/package.json" ]; then
    cd "$PROJECT_DIR"
    pwd
    return
  fi

  echo "ERROR: project root not found" >&2
  exit 1
}

ROOT_DIR="$(resolve_root)"
cd "$ROOT_DIR"

echo "== Sprint 090: Runtime Baseline Certification Profile =="
echo "Project root: $ROOT_DIR"

git checkout main
git pull origin main

git reset --hard
git clean -fd dist || true
git restore --worktree --staged dist 2>/dev/null || true

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git branch -D "$BRANCH"
fi

git checkout -b "$BRANCH"

mkdir -p src/application/runtime
mkdir -p tests

cat > src/application/runtime/RuntimeBaselineCertificationProfile.ts <<'TS'
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
TS

cat > tests/runtime-baseline-certification-profile.test.js <<'JS'
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  RuntimeBaselinePolicyFactory,
} = require("../dist/application/runtime/RuntimeBaselineCertificationProfile.js");

test("creates mobile conservative baseline for Galaxy A10s class hardware", () => {
  const factory = new RuntimeBaselinePolicyFactory();

  const profile = factory.create("MOBILE_CONSERVATIVE");

  assert.equal(profile.kind, "MOBILE_CONSERVATIVE");
  assert.match(profile.label, /Galaxy A10s/);
  assert.equal(profile.hardwareClass, "mobile-low-memory");
  assert.equal(profile.policy.minimumIterations, 50000);
  assert.equal(profile.policy.maxPressureViolations, 0);
});

test("creates mobile balanced baseline", () => {
  const factory = new RuntimeBaselinePolicyFactory();

  const profile = factory.create("MOBILE_BALANCED");

  assert.equal(profile.kind, "MOBILE_BALANCED");
  assert.equal(profile.policy.minimumIterations, 100000);
  assert.equal(profile.policy.maxHeapDriftBytes, 24 * 1024 * 1024);
});

test("creates desktop balanced baseline", () => {
  const factory = new RuntimeBaselinePolicyFactory();

  const profile = factory.create("DESKTOP_BALANCED");

  assert.equal(profile.kind, "DESKTOP_BALANCED");
  assert.equal(profile.hardwareClass, "desktop");
  assert.equal(profile.policy.minimumIterations, 250000);
});

test("creates custom baseline profile", () => {
  const factory = new RuntimeBaselinePolicyFactory();

  const profile = factory.custom({
    label: "Custom lab profile",
    hardwareClass: "lab",
    recommendedUse: "Controlled soak certification.",
    policy: {
      minimumIterations: 10,
      minimumDurationMs: 10,
      maxHeapDriftBytes: 1000,
      maxPeakEventLoopLagMs: 10,
      maxPressureViolations: 0,
      warningHeapDriftRatio: 0.8,
      warningLagRatio: 0.8,
    },
  });

  assert.equal(profile.kind, "CUSTOM");
  assert.equal(profile.label, "Custom lab profile");
});

test("rejects custom baseline with empty label", () => {
  const factory = new RuntimeBaselinePolicyFactory();

  assert.throws(
    () => factory.custom({
      label: " ",
      hardwareClass: "lab",
      recommendedUse: "Controlled soak certification.",
      policy: {
        minimumIterations: 10,
        minimumDurationMs: 10,
        maxHeapDriftBytes: 1000,
        maxPeakEventLoopLagMs: 10,
        maxPressureViolations: 0,
        warningHeapDriftRatio: 0.8,
        warningLagRatio: 0.8,
      },
    }),
    /label/,
  );
});

test("rejects custom baseline with invalid ratios", () => {
  const factory = new RuntimeBaselinePolicyFactory();

  assert.throws(
    () => factory.custom({
      label: "Custom",
      hardwareClass: "lab",
      recommendedUse: "Controlled soak certification.",
      policy: {
        minimumIterations: 10,
        minimumDurationMs: 10,
        maxHeapDriftBytes: 1000,
        maxPeakEventLoopLagMs: 10,
        maxPressureViolations: 0,
        warningHeapDriftRatio: 1.2,
        warningLagRatio: 0.8,
      },
    }),
    /warningHeapDriftRatio/,
  );
});
JS

npm run check:modules
npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/application/runtime/RuntimeBaselineCertificationProfile.ts \
  tests/runtime-baseline-certification-profile.test.js \
  install/sprints/run-sprint-090.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 090 runtime baseline certification profile"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 090 completed, merged and pushed successfully =="
