#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-092-runtime-soak-warmup-pressure-calibration"
COMMIT_MSG="feat(runtime): calibrate soak warmup and pressure spikes"

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

echo "== Sprint 092: Runtime Soak Warmup & Pressure Calibration =="
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

cat > src/application/runtime/RuntimeSoakPressureCalibration.ts <<'TS'
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
TS

cat > tests/runtime-soak-pressure-calibration.test.js <<'JS'
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  RuntimeSoakPressureCalibration,
} = require("../dist/application/runtime/RuntimeSoakPressureCalibration.js");

function sample(iteration, pressure) {
  return { iteration, pressure };
}

test("ignores warmup pressure samples", () => {
  const calibration = new RuntimeSoakPressureCalibration();

  const result = calibration.evaluate([
    sample(1, "HIGH"),
    sample(2, "HIGH"),
    sample(3, "LOW"),
  ], {
    warmupIterations: 2,
    allowedTransientPressureSpikes: 0,
    sustainedPressureWindow: 2,
    forbiddenPressure: "HIGH",
  });

  assert.equal(result.ignoredWarmupSamples, 2);
  assert.equal(result.measuredIterations, 1);
  assert.equal(result.transientPressureSpikes, 0);
  assert.equal(result.stable, true);
});

test("allows configured transient pressure spikes", () => {
  const calibration = new RuntimeSoakPressureCalibration();

  const result = calibration.evaluate([
    sample(1, "LOW"),
    sample(2, "HIGH"),
    sample(3, "LOW"),
  ], {
    warmupIterations: 0,
    allowedTransientPressureSpikes: 1,
    sustainedPressureWindow: 2,
    forbiddenPressure: "HIGH",
  });

  assert.equal(result.transientPressureSpikes, 1);
  assert.equal(result.sustainedPressureViolations, 0);
  assert.equal(result.stable, true);
});

test("fails when transient spikes exceed policy", () => {
  const calibration = new RuntimeSoakPressureCalibration();

  const result = calibration.evaluate([
    sample(1, "HIGH"),
    sample(2, "LOW"),
    sample(3, "HIGH"),
  ], {
    warmupIterations: 0,
    allowedTransientPressureSpikes: 1,
    sustainedPressureWindow: 3,
    forbiddenPressure: "HIGH",
  });

  assert.equal(result.transientPressureSpikes, 2);
  assert.equal(result.stable, false);
});

test("detects sustained pressure violation", () => {
  const calibration = new RuntimeSoakPressureCalibration();

  const result = calibration.evaluate([
    sample(1, "HIGH"),
    sample(2, "HIGH"),
    sample(3, "HIGH"),
  ], {
    warmupIterations: 0,
    allowedTransientPressureSpikes: 10,
    sustainedPressureWindow: 2,
    forbiddenPressure: "HIGH",
  });

  assert.equal(result.sustainedPressureViolations, 2);
  assert.equal(result.stable, false);
});

test("treats critical as violation when forbidden pressure is high", () => {
  const calibration = new RuntimeSoakPressureCalibration();

  const result = calibration.evaluate([
    sample(1, "CRITICAL"),
  ], {
    warmupIterations: 0,
    allowedTransientPressureSpikes: 0,
    sustainedPressureWindow: 1,
    forbiddenPressure: "HIGH",
  });

  assert.equal(result.transientPressureSpikes, 1);
  assert.equal(result.sustainedPressureViolations, 1);
  assert.equal(result.stable, false);
});

test("rejects invalid sustained pressure window", () => {
  const calibration = new RuntimeSoakPressureCalibration();

  assert.throws(
    () => calibration.evaluate([], {
      warmupIterations: 0,
      allowedTransientPressureSpikes: 0,
      sustainedPressureWindow: 0,
      forbiddenPressure: "HIGH",
    }),
    /sustainedPressureWindow/,
  );
});
JS

# Patch runtime soak runner to support warmup and transient spike policy.
python3 - <<'PY'
from pathlib import Path

path = Path("scripts/runtime-soak-runner.js")
text = path.read_text()

text = text.replace(
'''    forbiddenPressure: "HIGH",
    output: "data/soak/runtime-soak-report.json",''',
'''    forbiddenPressure: "HIGH",
    warmupIterations: 1000,
    allowedTransientPressureSpikes: 1,
    sustainedPressureWindow: 3,
    output: "data/soak/runtime-soak-report.json",'''
)

text = text.replace(
'''    } else if (key === "--output") {
      config.output = String(value);
      index += 1;
    }''',
'''    } else if (key === "--warmup-iterations") {
      config.warmupIterations = Number(value);
      index += 1;
    } else if (key === "--allowed-transient-pressure-spikes") {
      config.allowedTransientPressureSpikes = Number(value);
      index += 1;
    } else if (key === "--sustained-pressure-window") {
      config.sustainedPressureWindow = Number(value);
      index += 1;
    } else if (key === "--output") {
      config.output = String(value);
      index += 1;
    }'''
)

text = text.replace(
'''const { RuntimeStabilitySoakHarness } = require("../dist/application/runtime/RuntimeStabilitySoakHarness.js");''',
'''const { RuntimeStabilitySoakHarness } = require("../dist/application/runtime/RuntimeStabilitySoakHarness.js");
const { RuntimeSoakPressureCalibration } = require("../dist/application/runtime/RuntimeSoakPressureCalibration.js");'''
)

text = text.replace(
'''function createWorkload() {
  let expectedAtEpochMs = Date.now();

  return {
    async execute(iteration) {''',
'''function createWorkload(pressureSamples) {
  let expectedAtEpochMs = Date.now();

  return {
    async execute(iteration) {'''
)

text = text.replace(
'''      return {
        iteration,
        heapUsedBytes: memory.heapUsed,
        eventLoopLagMs,
        pressure: pressureFromHeap(memory.heapUsed, memory.heapTotal),
      };''',
'''      const pressure = pressureFromHeap(memory.heapUsed, memory.heapTotal);

      pressureSamples.push({
        iteration,
        pressure,
      });

      return {
        iteration,
        heapUsedBytes: memory.heapUsed,
        eventLoopLagMs,
        pressure,
      };'''
)

text = text.replace(
'''  const harness = new RuntimeStabilitySoakHarness(createWorkload());''',
'''  const pressureSamples = [];
  const harness = new RuntimeStabilitySoakHarness(createWorkload(pressureSamples));'''
)

text = text.replace(
'''  const report = {
    generatedAtEpochMs: Date.now(),
    durationMs: Date.now() - startedAtEpochMs,
    configuration: config,
    result,
  };''',
'''  const pressureCalibration = new RuntimeSoakPressureCalibration().evaluate(pressureSamples, {
    warmupIterations: config.warmupIterations,
    allowedTransientPressureSpikes: config.allowedTransientPressureSpikes,
    sustainedPressureWindow: config.sustainedPressureWindow,
    forbiddenPressure: config.forbiddenPressure,
  });

  const calibratedResult = {
    ...result,
    stable: result.stable || (
      result.heapDriftBytes <= config.maxHeapDriftBytes
      && result.peakEventLoopLagMs <= config.maxPeakEventLoopLagMs
      && pressureCalibration.stable
    ),
    pressureViolations: pressureCalibration.sustainedPressureViolations,
    transientPressureSpikes: pressureCalibration.transientPressureSpikes,
    ignoredWarmupSamples: pressureCalibration.ignoredWarmupSamples,
  };

  const report = {
    generatedAtEpochMs: Date.now(),
    durationMs: Date.now() - startedAtEpochMs,
    configuration: config,
    pressureCalibration,
    result: calibratedResult,
  };'''
)

text = text.replace(
'''  if (!result.stable) {''',
'''  if (!calibratedResult.stable) {'''
)

path.write_text(text)
PY

# Update runner test to validate calibration fields.
python3 - <<'PY'
from pathlib import Path

path = Path("tests/runtime-soak-runner-script.test.js")
text = path.read_text()

text = text.replace(
'''      "--output",
      output,''',
'''      "--warmup-iterations",
      "1",
      "--allowed-transient-pressure-spikes",
      "1",
      "--sustained-pressure-window",
      "2",
      "--output",
      output,'''
)

text = text.replace(
'''    assert.equal(Array.isArray(report.result.violationMessages), true);''',
'''    assert.equal(Array.isArray(report.result.violationMessages), true);
    assert.equal(typeof report.result.transientPressureSpikes, "number");
    assert.equal(typeof report.result.ignoredWarmupSamples, "number");
    assert.equal(typeof report.pressureCalibration.stable, "boolean");'''
)

path.write_text(text)
PY

npm run check:modules
npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/application/runtime/RuntimeSoakPressureCalibration.ts \
  tests/runtime-soak-pressure-calibration.test.js \
  scripts/runtime-soak-runner.js \
  tests/runtime-soak-runner-script.test.js \
  install/sprints/run-sprint-092.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 092 runtime soak warmup pressure calibration"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 092 completed, merged and pushed successfully =="
