#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-083-runtime-telemetry-expansion"
COMMIT_MSG="feat(runtime): expand lightweight telemetry snapshots"

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

echo "== Sprint 083: Runtime Telemetry Expansion =="
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

cat > src/application/runtime/RuntimeTelemetryExpansion.ts <<'TS'
export type RuntimeMemoryPressure = "LOW" | "ELEVATED" | "HIGH" | "CRITICAL";

export interface RuntimeMemorySample {
  readonly heapUsedBytes: number;
  readonly heapTotalBytes: number;
  readonly rssBytes: number;
  readonly externalBytes: number;
}

export interface RuntimeEventLoopLagSample {
  readonly expectedAtEpochMs: number;
  readonly observedAtEpochMs: number;
}

export interface RuntimeTelemetryCounters {
  readonly eventsPublished: number;
  readonly eventsFailed: number;
  readonly degradedZones: number;
  readonly openCircuits: number;
  readonly checkpointsSaved: number;
}

export interface RuntimeTelemetrySnapshot {
  readonly sampledAtEpochMs: number;
  readonly uptimeMs: number;
  readonly memory: RuntimeMemorySample;
  readonly memoryPressure: RuntimeMemoryPressure;
  readonly eventLoopLagMs: number;
  readonly eventsPerMinute: number;
  readonly failureRate: number;
  readonly degradedZones: number;
  readonly openCircuits: number;
  readonly checkpointsSaved: number;
}

export interface RuntimeTelemetryClockPort {
  nowEpochMs(): number;
}

export interface RuntimeMemoryUsagePort {
  read(): RuntimeMemorySample;
}

/**
 * Classifies memory pressure using bounded deterministic thresholds.
 *
 * Complexity: O(1), memory O(1).
 */
export class RuntimeTelemetryPressureClassifier {
  public classify(memory: RuntimeMemorySample): RuntimeMemoryPressure {
    this.validateMemory(memory);

    if (memory.heapTotalBytes === 0) {
      return "LOW";
    }

    const heapRatio = memory.heapUsedBytes / memory.heapTotalBytes;

    if (heapRatio >= 0.95) {
      return "CRITICAL";
    }

    if (heapRatio >= 0.85) {
      return "HIGH";
    }

    if (heapRatio >= 0.7) {
      return "ELEVATED";
    }

    return "LOW";
  }

  private validateMemory(memory: RuntimeMemorySample): void {
    const fields: ReadonlyArray<readonly [string, number]> = [
      ["heapUsedBytes", memory.heapUsedBytes],
      ["heapTotalBytes", memory.heapTotalBytes],
      ["rssBytes", memory.rssBytes],
      ["externalBytes", memory.externalBytes],
    ];

    for (const [name, value] of fields) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid telemetry memory sample: ${name} must be finite and non-negative.`);
      }
    }

    if (memory.heapUsedBytes > memory.heapTotalBytes && memory.heapTotalBytes > 0) {
      throw new Error("Invalid telemetry memory sample: heapUsedBytes cannot exceed heapTotalBytes.");
    }
  }
}

/**
 * Computes lightweight runtime telemetry snapshots.
 *
 * No timers are owned by this class. The caller decides when to sample,
 * preventing telemetry from becoming a hidden runtime workload.
 *
 * Complexity: O(1), memory O(1).
 */
export class RuntimeTelemetrySnapshotComposer {
  public constructor(
    private readonly pressureClassifier: RuntimeTelemetryPressureClassifier,
  ) {}

  public compose(input: {
    readonly sampledAtEpochMs: number;
    readonly runtimeStartedAtEpochMs: number;
    readonly memory: RuntimeMemorySample;
    readonly lagSample: RuntimeEventLoopLagSample;
    readonly counters: RuntimeTelemetryCounters;
    readonly windowMs: number;
  }): RuntimeTelemetrySnapshot {
    this.validateInput(input);

    const eventLoopLagMs = Math.max(0, input.lagSample.observedAtEpochMs - input.lagSample.expectedAtEpochMs);
    const eventsPerMinute = input.windowMs === 0
      ? 0
      : (input.counters.eventsPublished / input.windowMs) * 60_000;

    const failureRate = input.counters.eventsPublished === 0
      ? 0
      : input.counters.eventsFailed / input.counters.eventsPublished;

    return {
      sampledAtEpochMs: input.sampledAtEpochMs,
      uptimeMs: input.sampledAtEpochMs - input.runtimeStartedAtEpochMs,
      memory: input.memory,
      memoryPressure: this.pressureClassifier.classify(input.memory),
      eventLoopLagMs,
      eventsPerMinute,
      failureRate,
      degradedZones: input.counters.degradedZones,
      openCircuits: input.counters.openCircuits,
      checkpointsSaved: input.counters.checkpointsSaved,
    };
  }

  private validateInput(input: {
    readonly sampledAtEpochMs: number;
    readonly runtimeStartedAtEpochMs: number;
    readonly memory: RuntimeMemorySample;
    readonly lagSample: RuntimeEventLoopLagSample;
    readonly counters: RuntimeTelemetryCounters;
    readonly windowMs: number;
  }): void {
    const numericFields: ReadonlyArray<readonly [string, number]> = [
      ["sampledAtEpochMs", input.sampledAtEpochMs],
      ["runtimeStartedAtEpochMs", input.runtimeStartedAtEpochMs],
      ["windowMs", input.windowMs],
      ["eventsPublished", input.counters.eventsPublished],
      ["eventsFailed", input.counters.eventsFailed],
      ["degradedZones", input.counters.degradedZones],
      ["openCircuits", input.counters.openCircuits],
      ["checkpointsSaved", input.counters.checkpointsSaved],
    ];

    for (const [name, value] of numericFields) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Invalid telemetry input: ${name} must be finite and non-negative.`);
      }
    }

    if (input.sampledAtEpochMs < input.runtimeStartedAtEpochMs) {
      throw new Error("Invalid telemetry input: sampledAtEpochMs cannot be before runtimeStartedAtEpochMs.");
    }

    if (input.counters.eventsFailed > input.counters.eventsPublished) {
      throw new Error("Invalid telemetry input: eventsFailed cannot exceed eventsPublished.");
    }
  }
}

/**
 * Samples runtime memory and event-loop lag from injected ports.
 *
 * The class is deterministic in tests and light enough for Termux/proot usage.
 *
 * Complexity: O(1), memory O(1).
 */
export class RuntimeTelemetrySampler {
  public constructor(
    private readonly clock: RuntimeTelemetryClockPort,
    private readonly memoryUsage: RuntimeMemoryUsagePort,
  ) {}

  public sampleMemory(): RuntimeMemorySample {
    return this.memoryUsage.read();
  }

  public sampleLag(expectedAtEpochMs: number): RuntimeEventLoopLagSample {
    if (!Number.isFinite(expectedAtEpochMs) || expectedAtEpochMs < 0) {
      throw new Error("Invalid event loop lag sample: expectedAtEpochMs must be finite and non-negative.");
    }

    return {
      expectedAtEpochMs,
      observedAtEpochMs: this.clock.nowEpochMs(),
    };
  }
}
TS

cat > tests/runtime-telemetry-expansion.test.js <<'JS'
import test from "node:test";
import assert from "node:assert/strict";
import {
  RuntimeTelemetryPressureClassifier,
  RuntimeTelemetrySampler,
  RuntimeTelemetrySnapshotComposer,
} from "../dist/application/runtime/RuntimeTelemetryExpansion.js";

function memory(heapUsedBytes, heapTotalBytes = 1000) {
  return {
    heapUsedBytes,
    heapTotalBytes,
    rssBytes: 1500,
    externalBytes: 100,
  };
}

test("classifies low memory pressure", () => {
  const classifier = new RuntimeTelemetryPressureClassifier();

  assert.equal(classifier.classify(memory(400)), "LOW");
});

test("classifies elevated memory pressure", () => {
  const classifier = new RuntimeTelemetryPressureClassifier();

  assert.equal(classifier.classify(memory(750)), "ELEVATED");
});

test("classifies high memory pressure", () => {
  const classifier = new RuntimeTelemetryPressureClassifier();

  assert.equal(classifier.classify(memory(870)), "HIGH");
});

test("classifies critical memory pressure", () => {
  const classifier = new RuntimeTelemetryPressureClassifier();

  assert.equal(classifier.classify(memory(960)), "CRITICAL");
});

test("rejects invalid memory sample", () => {
  const classifier = new RuntimeTelemetryPressureClassifier();

  assert.throws(
    () => classifier.classify(memory(1200)),
    /heapUsedBytes cannot exceed/,
  );
});

test("samples memory from injected port", () => {
  const sampler = new RuntimeTelemetrySampler(
    { nowEpochMs: () => 2000 },
    { read: () => memory(500) },
  );

  const sample = sampler.sampleMemory();

  assert.equal(sample.heapUsedBytes, 500);
});

test("samples event loop lag from injected clock", () => {
  const sampler = new RuntimeTelemetrySampler(
    { nowEpochMs: () => 2050 },
    { read: () => memory(500) },
  );

  const lag = sampler.sampleLag(2000);

  assert.equal(lag.expectedAtEpochMs, 2000);
  assert.equal(lag.observedAtEpochMs, 2050);
});

test("composes telemetry snapshot", () => {
  const composer = new RuntimeTelemetrySnapshotComposer(
    new RuntimeTelemetryPressureClassifier(),
  );

  const snapshot = composer.compose({
    sampledAtEpochMs: 7000,
    runtimeStartedAtEpochMs: 1000,
    memory: memory(750),
    lagSample: {
      expectedAtEpochMs: 6950,
      observedAtEpochMs: 7000,
    },
    counters: {
      eventsPublished: 120,
      eventsFailed: 6,
      degradedZones: 2,
      openCircuits: 1,
      checkpointsSaved: 8,
    },
    windowMs: 60_000,
  });

  assert.equal(snapshot.uptimeMs, 6000);
  assert.equal(snapshot.memoryPressure, "ELEVATED");
  assert.equal(snapshot.eventLoopLagMs, 50);
  assert.equal(snapshot.eventsPerMinute, 120);
  assert.equal(snapshot.failureRate, 0.05);
  assert.equal(snapshot.degradedZones, 2);
  assert.equal(snapshot.openCircuits, 1);
  assert.equal(snapshot.checkpointsSaved, 8);
});

test("normalizes negative lag to zero", () => {
  const composer = new RuntimeTelemetrySnapshotComposer(
    new RuntimeTelemetryPressureClassifier(),
  );

  const snapshot = composer.compose({
    sampledAtEpochMs: 7000,
    runtimeStartedAtEpochMs: 1000,
    memory: memory(500),
    lagSample: {
      expectedAtEpochMs: 7100,
      observedAtEpochMs: 7000,
    },
    counters: {
      eventsPublished: 0,
      eventsFailed: 0,
      degradedZones: 0,
      openCircuits: 0,
      checkpointsSaved: 0,
    },
    windowMs: 60_000,
  });

  assert.equal(snapshot.eventLoopLagMs, 0);
  assert.equal(snapshot.eventsPerMinute, 0);
  assert.equal(snapshot.failureRate, 0);
});

test("rejects invalid counter consistency", () => {
  const composer = new RuntimeTelemetrySnapshotComposer(
    new RuntimeTelemetryPressureClassifier(),
  );

  assert.throws(
    () => composer.compose({
      sampledAtEpochMs: 7000,
      runtimeStartedAtEpochMs: 1000,
      memory: memory(500),
      lagSample: {
        expectedAtEpochMs: 7000,
        observedAtEpochMs: 7000,
      },
      counters: {
        eventsPublished: 1,
        eventsFailed: 2,
        degradedZones: 0,
        openCircuits: 0,
        checkpointsSaved: 0,
      },
      windowMs: 60_000,
    }),
    /eventsFailed cannot exceed/,
  );
});
JS

npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/application/runtime/RuntimeTelemetryExpansion.ts \
  tests/runtime-telemetry-expansion.test.js \
  install/sprints/run-sprint-083.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 083 runtime telemetry expansion"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 083 completed, merged and pushed successfully =="
