#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-084-runtime-stability-soak-harness"
COMMIT_MSG="feat(runtime): add stability soak harness"

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

echo "== Sprint 084: Runtime Stability Soak Harness =="
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

cat > src/application/runtime/RuntimeStabilitySoakHarness.ts <<'TS'
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
TS

cat > tests/runtime-stability-soak-harness.test.js <<'JS'
import test from "node:test";
import assert from "node:assert/strict";
import { RuntimeStabilitySoakHarness } from "../dist/application/runtime/RuntimeStabilitySoakHarness.js";

test("marks stable workload as stable", async () => {
  const harness = new RuntimeStabilitySoakHarness({
    execute: async (iteration) => ({
      iteration,
      heapUsedBytes: 1000 + iteration,
      eventLoopLagMs: 2,
      pressure: "LOW",
    }),
  });

  const result = await harness.run({
    iterations: 10,
    maxHeapDriftBytes: 20,
    maxPeakEventLoopLagMs: 5,
    forbiddenPressure: "HIGH",
  });

  assert.equal(result.stable, true);
  assert.equal(result.iterations, 10);
  assert.equal(result.heapDriftBytes, 9);
  assert.equal(result.peakEventLoopLagMs, 2);
  assert.equal(result.pressureViolations, 0);
});

test("detects heap drift violation", async () => {
  const harness = new RuntimeStabilitySoakHarness({
    execute: async (iteration) => ({
      iteration,
      heapUsedBytes: 1000 + iteration * 100,
      eventLoopLagMs: 1,
      pressure: "LOW",
    }),
  });

  const result = await harness.run({
    iterations: 5,
    maxHeapDriftBytes: 100,
    maxPeakEventLoopLagMs: 5,
    forbiddenPressure: "HIGH",
  });

  assert.equal(result.stable, false);
  assert.match(result.violationMessages.join(" "), /Heap drift exceeded/);
});

test("detects peak event loop lag violation", async () => {
  const harness = new RuntimeStabilitySoakHarness({
    execute: async (iteration) => ({
      iteration,
      heapUsedBytes: 1000,
      eventLoopLagMs: iteration === 3 ? 50 : 2,
      pressure: "LOW",
    }),
  });

  const result = await harness.run({
    iterations: 5,
    maxHeapDriftBytes: 100,
    maxPeakEventLoopLagMs: 10,
    forbiddenPressure: "HIGH",
  });

  assert.equal(result.stable, false);
  assert.equal(result.peakEventLoopLagMs, 50);
  assert.match(result.violationMessages.join(" "), /Peak event loop lag exceeded/);
});

test("detects pressure violations", async () => {
  const harness = new RuntimeStabilitySoakHarness({
    execute: async (iteration) => ({
      iteration,
      heapUsedBytes: 1000,
      eventLoopLagMs: 1,
      pressure: iteration >= 2 ? "HIGH" : "LOW",
    }),
  });

  const result = await harness.run({
    iterations: 4,
    maxHeapDriftBytes: 100,
    maxPeakEventLoopLagMs: 10,
    forbiddenPressure: "HIGH",
  });

  assert.equal(result.stable, false);
  assert.equal(result.pressureViolations, 3);
  assert.match(result.violationMessages.join(" "), /Memory pressure violated/);
});

test("allows elevated pressure when forbidden pressure is high", async () => {
  const harness = new RuntimeStabilitySoakHarness({
    execute: async (iteration) => ({
      iteration,
      heapUsedBytes: 1000,
      eventLoopLagMs: 1,
      pressure: "ELEVATED",
    }),
  });

  const result = await harness.run({
    iterations: 3,
    maxHeapDriftBytes: 100,
    maxPeakEventLoopLagMs: 10,
    forbiddenPressure: "HIGH",
  });

  assert.equal(result.stable, true);
  assert.equal(result.pressureViolations, 0);
});

test("rejects invalid configuration", async () => {
  const harness = new RuntimeStabilitySoakHarness({
    execute: async (iteration) => ({
      iteration,
      heapUsedBytes: 1000,
      eventLoopLagMs: 1,
      pressure: "LOW",
    }),
  });

  await assert.rejects(
    () => harness.run({
      iterations: 0,
      maxHeapDriftBytes: 100,
      maxPeakEventLoopLagMs: 10,
      forbiddenPressure: "HIGH",
    }),
    /iterations/,
  );
});

test("rejects sequence mismatch", async () => {
  const harness = new RuntimeStabilitySoakHarness({
    execute: async () => ({
      iteration: 999,
      heapUsedBytes: 1000,
      eventLoopLagMs: 1,
      pressure: "LOW",
    }),
  });

  await assert.rejects(
    () => harness.run({
      iterations: 2,
      maxHeapDriftBytes: 100,
      maxPeakEventLoopLagMs: 10,
      forbiddenPressure: "HIGH",
    }),
    /sequence mismatch/,
  );
});
JS

npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/application/runtime/RuntimeStabilitySoakHarness.ts \
  tests/runtime-stability-soak-harness.test.js \
  install/sprints/run-sprint-084.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 084 runtime stability soak harness"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 084 completed, merged and pushed successfully =="
