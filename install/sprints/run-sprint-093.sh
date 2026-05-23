#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-093-runtime-memory-pressure-classifier-calibration"
COMMIT_MSG="feat(runtime): calibrate memory pressure classifier"

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

echo "== Sprint 093: Runtime Memory Pressure Classifier Calibration =="
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

cat > src/application/runtime/RuntimeMemoryPressureClassifierV2.ts <<'TS'
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
TS

cat > tests/runtime-memory-pressure-classifier-v2.test.js <<'JS'
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  RuntimeMemoryPressureClassifierV2,
  createMobileMemoryPressurePolicyV2,
} = require("../dist/application/runtime/RuntimeMemoryPressureClassifierV2.js");

function sample(overrides = {}) {
  return {
    heapUsedBytes: 700,
    heapTotalBytes: 1000,
    rssBytes: 1000,
    baselineHeapUsedBytes: 600,
    ...overrides,
  };
}

test("classifies low pressure under calibrated baseline", () => {
  const classifier = new RuntimeMemoryPressureClassifierV2();

  const result = classifier.classify(
    sample({ heapUsedBytes: 500, heapTotalBytes: 1000 }),
    createMobileMemoryPressurePolicyV2(),
  );

  assert.equal(result.pressure, "LOW");
});

test("downgrades high ratio to elevated when absolute pressure is low", () => {
  const classifier = new RuntimeMemoryPressureClassifierV2();

  const result = classifier.classify(
    sample({
      heapUsedBytes: 900,
      heapTotalBytes: 1000,
      baselineHeapUsedBytes: 850,
      rssBytes: 20 * 1024 * 1024,
    }),
    createMobileMemoryPressurePolicyV2(),
  );

  assert.equal(result.pressure, "ELEVATED");
  assert.match(result.reasons.join(" "), /without absolute pressure/);
});

test("classifies high when ratio is confirmed by heap drift", () => {
  const classifier = new RuntimeMemoryPressureClassifierV2();

  const result = classifier.classify(
    sample({
      heapUsedBytes: 30 * 1024 * 1024,
      heapTotalBytes: 32 * 1024 * 1024,
      baselineHeapUsedBytes: 1 * 1024 * 1024,
      rssBytes: 100 * 1024 * 1024,
    }),
    createMobileMemoryPressurePolicyV2(),
  );

  assert.equal(result.pressure, "HIGH");
});

test("classifies critical when ratio is confirmed by critical drift", () => {
  const classifier = new RuntimeMemoryPressureClassifierV2();

  const result = classifier.classify(
    sample({
      heapUsedBytes: 64 * 1024 * 1024,
      heapTotalBytes: 66 * 1024 * 1024,
      baselineHeapUsedBytes: 1 * 1024 * 1024,
      rssBytes: 100 * 1024 * 1024,
    }),
    createMobileMemoryPressurePolicyV2(),
  );

  assert.equal(result.pressure, "CRITICAL");
});

test("classifies high when ratio is confirmed by rss", () => {
  const classifier = new RuntimeMemoryPressureClassifierV2();

  const result = classifier.classify(
    sample({
      heapUsedBytes: 900,
      heapTotalBytes: 1000,
      baselineHeapUsedBytes: 850,
      rssBytes: 600 * 1024 * 1024,
    }),
    createMobileMemoryPressurePolicyV2(),
  );

  assert.equal(result.pressure, "HIGH");
});

test("rejects invalid threshold ordering", () => {
  const classifier = new RuntimeMemoryPressureClassifierV2();

  assert.throws(
    () => classifier.classify(sample(), {
      ...createMobileMemoryPressurePolicyV2(),
      elevatedHeapRatio: 0.9,
      highHeapRatio: 0.8,
    }),
    /thresholds must be ordered/,
  );
});
JS

# Patch soak runner pressureFromHeap to use V2 classifier with baseline heap.
python3 - <<'PY'
from pathlib import Path

path = Path("scripts/runtime-soak-runner.js")
text = path.read_text()

text = text.replace(
'''const { RuntimeSoakPressureCalibration } = require("../dist/application/runtime/RuntimeSoakPressureCalibration.js");''',
'''const { RuntimeSoakPressureCalibration } = require("../dist/application/runtime/RuntimeSoakPressureCalibration.js");
const {
  RuntimeMemoryPressureClassifierV2,
  createMobileMemoryPressurePolicyV2,
} = require("../dist/application/runtime/RuntimeMemoryPressureClassifierV2.js");'''
)

text = text.replace(
'''function pressureFromHeap(heapUsedBytes, heapTotalBytes) {
  if (heapTotalBytes <= 0) {
    return "LOW";
  }

  const ratio = heapUsedBytes / heapTotalBytes;

  if (ratio >= 0.95) {
    return "CRITICAL";
  }

  if (ratio >= 0.85) {
    return "HIGH";
  }

  if (ratio >= 0.7) {
    return "ELEVATED";
  }

  return "LOW";
}''',
'''function createPressureClassifierState() {
  return {
    classifier: new RuntimeMemoryPressureClassifierV2(),
    policy: createMobileMemoryPressurePolicyV2(),
    baselineHeapUsedBytes: null,
  };
}

function pressureFromMemory(memory, state) {
  if (state.baselineHeapUsedBytes === null) {
    state.baselineHeapUsedBytes = memory.heapUsed;
  }

  return state.classifier.classify({
    heapUsedBytes: memory.heapUsed,
    heapTotalBytes: memory.heapTotal,
    rssBytes: memory.rss,
    baselineHeapUsedBytes: state.baselineHeapUsedBytes,
  }, state.policy).pressure;
}'''
)

text = text.replace(
'''function createWorkload(pressureSamples) {
  let expectedAtEpochMs = Date.now();

  return {
    async execute(iteration) {''',
'''function createWorkload(pressureSamples) {
  let expectedAtEpochMs = Date.now();
  const pressureState = createPressureClassifierState();

  return {
    async execute(iteration) {'''
)

text = text.replace(
'''      const pressure = pressureFromHeap(memory.heapUsed, memory.heapTotal);''',
'''      const pressure = pressureFromMemory(memory, pressureState);'''
)

path.write_text(text)
PY

npm run check:modules
npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/application/runtime/RuntimeMemoryPressureClassifierV2.ts \
  tests/runtime-memory-pressure-classifier-v2.test.js \
  scripts/runtime-soak-runner.js \
  install/sprints/run-sprint-093.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 093 runtime memory pressure classifier calibration"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 093 completed, merged and pushed successfully =="
