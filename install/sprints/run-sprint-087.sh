#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-087-runtime-endurance-certification"
COMMIT_MSG="feat(runtime): add endurance certification engine"

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

echo "== Sprint 087: Runtime Endurance Certification =="
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

cat > src/application/runtime/RuntimeEnduranceCertificationEngine.ts <<'TS'
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
TS

cat > tests/runtime-endurance-certification-engine.test.js <<'JS'
const test = require("node:test");
const assert = require("node:assert/strict");
const { RuntimeEnduranceCertificationEngine } = require("../dist/application/runtime/RuntimeEnduranceCertificationEngine.js");

function policy() {
  return {
    minimumIterations: 1000,
    minimumDurationMs: 1000,
    maxHeapDriftBytes: 10_000,
    maxPeakEventLoopLagMs: 100,
    maxPressureViolations: 0,
    warningHeapDriftRatio: 0.8,
    warningLagRatio: 0.8,
  };
}

function report(overrides = {}) {
  return {
    generatedAtEpochMs: 10000,
    durationMs: 2000,
    result: {
      stable: true,
      iterations: 2000,
      heapDriftBytes: 1000,
      peakEventLoopLagMs: 10,
      pressureViolations: 0,
      ...overrides,
    },
  };
}

test("certifies healthy endurance report", () => {
  const engine = new RuntimeEnduranceCertificationEngine();

  const result = engine.certify(report(), policy());

  assert.equal(result.status, "CERTIFIED");
  assert.equal(result.certified, true);
  assert.equal(result.score, 100);
});

test("fails unstable soak report", () => {
  const engine = new RuntimeEnduranceCertificationEngine();

  const result = engine.certify(report({ stable: false }), policy());

  assert.equal(result.status, "FAILED");
  assert.equal(result.certified, false);
  assert.match(result.reasons.join(" "), /not stable/);
});

test("fails when iterations are insufficient", () => {
  const engine = new RuntimeEnduranceCertificationEngine();

  const result = engine.certify(report({ iterations: 500 }), policy());

  assert.equal(result.status, "FAILED");
  assert.match(result.reasons.join(" "), /fewer iterations/);
});

test("warns when heap drift is close to limit", () => {
  const engine = new RuntimeEnduranceCertificationEngine();

  const result = engine.certify(report({ heapDriftBytes: 8500 }), policy());

  assert.equal(result.status, "WARNING");
  assert.equal(result.certified, false);
  assert.match(result.reasons.join(" "), /Heap drift is close/);
});

test("fails when heap drift exceeds limit", () => {
  const engine = new RuntimeEnduranceCertificationEngine();

  const result = engine.certify(report({ heapDriftBytes: 20000 }), policy());

  assert.equal(result.status, "FAILED");
  assert.match(result.reasons.join(" "), /Heap drift exceeded/);
});

test("warns when peak lag is close to limit", () => {
  const engine = new RuntimeEnduranceCertificationEngine();

  const result = engine.certify(report({ peakEventLoopLagMs: 90 }), policy());

  assert.equal(result.status, "WARNING");
  assert.match(result.reasons.join(" "), /Peak event loop lag is close/);
});

test("fails when pressure violations exceed policy", () => {
  const engine = new RuntimeEnduranceCertificationEngine();

  const result = engine.certify(report({ pressureViolations: 1 }), policy());

  assert.equal(result.status, "FAILED");
  assert.match(result.reasons.join(" "), /Memory pressure violations/);
});

test("rejects invalid warning ratio", () => {
  const engine = new RuntimeEnduranceCertificationEngine();

  assert.throws(
    () => engine.certify(report(), {
      ...policy(),
      warningLagRatio: 0,
    }),
    /warning ratios must be > 0/,
  );
});
JS

npm run check:modules
npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/application/runtime/RuntimeEnduranceCertificationEngine.ts \
  tests/runtime-endurance-certification-engine.test.js \
  install/sprints/run-sprint-087.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 087 runtime endurance certification"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 087 completed, merged and pushed successfully =="
