#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-082-runtime-fault-isolation"
COMMIT_MSG="feat(runtime): add fault isolation boundary"

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

echo "== Sprint 082: Runtime Fault Isolation =="
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

cat > src/application/runtime/RuntimeFaultIsolationBoundary.ts <<'TS'
export type RuntimeIsolationZone =
  | "CRITICAL"
  | "IMPORTANT"
  | "NON_CRITICAL";

export type RuntimeFaultIsolationStatus =
  | "EXECUTED"
  | "DEGRADED"
  | "CIRCUIT_OPEN";

export interface RuntimeFaultIsolationResult<TValue> {
  readonly status: RuntimeFaultIsolationStatus;
  readonly zone: RuntimeIsolationZone;
  readonly value?: TValue;
  readonly errorMessage?: string;
  readonly failureCount: number;
}

export interface RuntimeFaultIsolationPolicy {
  readonly zone: RuntimeIsolationZone;
  readonly maxFailuresBeforeOpen: number;
  readonly recoverable: boolean;
}

interface RuntimeFaultZoneState {
  failureCount: number;
  circuitOpen: boolean;
}

/**
 * Protects runtime execution zones from cascading failures.
 *
 * CRITICAL zones rethrow after recording the fault.
 * IMPORTANT and NON_CRITICAL zones degrade gracefully.
 *
 * Complexity:
 * - O(1) execution bookkeeping.
 * - Memory O(z), where z is the number of named zones.
 */
export class RuntimeFaultIsolationBoundary {
  private readonly states: Map<string, RuntimeFaultZoneState> = new Map<string, RuntimeFaultZoneState>();

  public async execute<TValue>(
    zoneId: string,
    policy: RuntimeFaultIsolationPolicy,
    operation: () => Promise<TValue>,
  ): Promise<RuntimeFaultIsolationResult<TValue>> {
    this.validate(zoneId, policy);

    const state = this.getState(zoneId);

    if (state.circuitOpen) {
      return {
        status: "CIRCUIT_OPEN",
        zone: policy.zone,
        errorMessage: `Circuit is open for runtime zone: ${zoneId}.`,
        failureCount: state.failureCount,
      };
    }

    try {
      const value = await operation();

      state.failureCount = 0;
      state.circuitOpen = false;

      return {
        status: "EXECUTED",
        zone: policy.zone,
        value,
        failureCount: 0,
      };
    } catch (error: unknown) {
      state.failureCount += 1;

      if (state.failureCount >= policy.maxFailuresBeforeOpen) {
        state.circuitOpen = true;
      }

      const errorMessage = this.describeError(error);

      if (policy.zone === "CRITICAL" || policy.recoverable === false) {
        throw new Error(`Critical runtime zone failed: ${zoneId}: ${errorMessage}`);
      }

      return {
        status: "DEGRADED",
        zone: policy.zone,
        errorMessage,
        failureCount: state.failureCount,
      };
    }
  }

  public reset(zoneId: string): void {
    this.states.delete(zoneId);
  }

  public getFailureCount(zoneId: string): number {
    return this.getState(zoneId).failureCount;
  }

  public isCircuitOpen(zoneId: string): boolean {
    return this.getState(zoneId).circuitOpen;
  }

  private getState(zoneId: string): RuntimeFaultZoneState {
    const existing = this.states.get(zoneId);

    if (existing !== undefined) {
      return existing;
    }

    const created: RuntimeFaultZoneState = {
      failureCount: 0,
      circuitOpen: false,
    };

    this.states.set(zoneId, created);
    return created;
  }

  private validate(zoneId: string, policy: RuntimeFaultIsolationPolicy): void {
    if (zoneId.trim().length === 0) {
      throw new Error("Runtime fault isolation zoneId cannot be empty.");
    }

    if (!Number.isInteger(policy.maxFailuresBeforeOpen) || policy.maxFailuresBeforeOpen <= 0) {
      throw new Error("Runtime fault isolation maxFailuresBeforeOpen must be a positive integer.");
    }
  }

  private describeError(error: unknown): string {
    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return "Unknown runtime fault.";
  }
}
TS

cat > tests/runtime-fault-isolation-boundary.test.js <<'JS'
import test from "node:test";
import assert from "node:assert/strict";
import { RuntimeFaultIsolationBoundary } from "../dist/application/runtime/RuntimeFaultIsolationBoundary.js";

test("executes successful critical operation", async () => {
  const boundary = new RuntimeFaultIsolationBoundary();

  const result = await boundary.execute(
    "risk-gateway",
    { zone: "CRITICAL", maxFailuresBeforeOpen: 1, recoverable: false },
    async () => "allowed",
  );

  assert.equal(result.status, "EXECUTED");
  assert.equal(result.value, "allowed");
  assert.equal(result.failureCount, 0);
});

test("throws on critical zone failure", async () => {
  const boundary = new RuntimeFaultIsolationBoundary();

  await assert.rejects(
    () => boundary.execute(
      "risk-gateway",
      { zone: "CRITICAL", maxFailuresBeforeOpen: 1, recoverable: false },
      async () => {
        throw new Error("risk failure");
      },
    ),
    /Critical runtime zone failed/,
  );

  assert.equal(boundary.getFailureCount("risk-gateway"), 1);
  assert.equal(boundary.isCircuitOpen("risk-gateway"), true);
});

test("degrades non critical zone failure without throwing", async () => {
  const boundary = new RuntimeFaultIsolationBoundary();

  const result = await boundary.execute(
    "telemetry",
    { zone: "NON_CRITICAL", maxFailuresBeforeOpen: 3, recoverable: true },
    async () => {
      throw new Error("telemetry unavailable");
    },
  );

  assert.equal(result.status, "DEGRADED");
  assert.equal(result.zone, "NON_CRITICAL");
  assert.equal(result.failureCount, 1);
  assert.match(result.errorMessage, /telemetry unavailable/);
});

test("opens circuit after repeated recoverable failures", async () => {
  const boundary = new RuntimeFaultIsolationBoundary();

  for (let index = 0; index < 2; index += 1) {
    await boundary.execute(
      "reporter",
      { zone: "IMPORTANT", maxFailuresBeforeOpen: 2, recoverable: true },
      async () => {
        throw new Error("disk unavailable");
      },
    );
  }

  const result = await boundary.execute(
    "reporter",
    { zone: "IMPORTANT", maxFailuresBeforeOpen: 2, recoverable: true },
    async () => "should not run",
  );

  assert.equal(result.status, "CIRCUIT_OPEN");
  assert.equal(result.failureCount, 2);
  assert.equal(boundary.isCircuitOpen("reporter"), true);
});

test("successful execution resets failure count", async () => {
  const boundary = new RuntimeFaultIsolationBoundary();

  await boundary.execute(
    "hud",
    { zone: "NON_CRITICAL", maxFailuresBeforeOpen: 3, recoverable: true },
    async () => {
      throw new Error("render failure");
    },
  );

  const result = await boundary.execute(
    "hud",
    { zone: "NON_CRITICAL", maxFailuresBeforeOpen: 3, recoverable: true },
    async () => "hud rendered",
  );

  assert.equal(result.status, "EXECUTED");
  assert.equal(result.failureCount, 0);
  assert.equal(boundary.getFailureCount("hud"), 0);
});

test("reset closes circuit and clears failure count", async () => {
  const boundary = new RuntimeFaultIsolationBoundary();

  await boundary.execute(
    "audit",
    { zone: "NON_CRITICAL", maxFailuresBeforeOpen: 1, recoverable: true },
    async () => {
      throw new Error("audit failure");
    },
  );

  assert.equal(boundary.isCircuitOpen("audit"), true);

  boundary.reset("audit");

  assert.equal(boundary.isCircuitOpen("audit"), false);
  assert.equal(boundary.getFailureCount("audit"), 0);
});

test("rejects invalid zone id", async () => {
  const boundary = new RuntimeFaultIsolationBoundary();

  await assert.rejects(
    () => boundary.execute(
      "   ",
      { zone: "NON_CRITICAL", maxFailuresBeforeOpen: 1, recoverable: true },
      async () => "ok",
    ),
    /zoneId/,
  );
});

test("rejects invalid max failures policy", async () => {
  const boundary = new RuntimeFaultIsolationBoundary();

  await assert.rejects(
    () => boundary.execute(
      "telemetry",
      { zone: "NON_CRITICAL", maxFailuresBeforeOpen: 0, recoverable: true },
      async () => "ok",
    ),
    /maxFailuresBeforeOpen/,
  );
});
JS

npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/application/runtime/RuntimeFaultIsolationBoundary.ts \
  tests/runtime-fault-isolation-boundary.test.js \
  install/sprints/run-sprint-082.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 082 runtime fault isolation"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 082 completed, merged and pushed successfully =="
