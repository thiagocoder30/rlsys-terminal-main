#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-094-paper-runtime-operational-gate"
COMMIT_MSG="feat(runtime): add paper operational gate"

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

echo "== Sprint 094: Paper Runtime Operational Gate =="
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

cat > src/application/runtime/PaperRuntimeOperationalGate.ts <<'TS'
export type PaperRuntimeEnduranceStatus =
  | "CERTIFIED"
  | "WARNING"
  | "FAILED"
  | "NO_DATA";

export type PaperRuntimeRiskReadiness =
  | "READY"
  | "CAUTION"
  | "BLOCKED";

export type PaperRuntimeSessionState =
  | "IDLE"
  | "READY"
  | "RUNNING"
  | "PAUSED"
  | "FINISHED";

export type PaperRuntimeOperatorMode =
  | "SUPERVISED"
  | "UNSUPERVISED";

export type PaperRuntimeGateDecision =
  | "ALLOW_PAPER_OPERATION"
  | "REQUIRE_SUPERVISION"
  | "BLOCK_PAPER_OPERATION";

export interface PaperRuntimeOperationalGateInput {
  readonly enduranceStatus: PaperRuntimeEnduranceStatus;
  readonly riskReadiness: PaperRuntimeRiskReadiness;
  readonly sessionState: PaperRuntimeSessionState;
  readonly operatorMode: PaperRuntimeOperatorMode;
}

export interface PaperRuntimeOperationalGateResult {
  readonly decision: PaperRuntimeGateDecision;
  readonly allowed: boolean;
  readonly reasons: readonly string[];
}

/**
 * Determines whether paper runtime operation can proceed.
 *
 * This gate intentionally does not decide real-money permission. It only
 * authorizes paper operation under supervision after endurance and risk checks.
 *
 * Complexity:
 * - O(1), fixed rule set.
 * - Memory O(1).
 */
export class PaperRuntimeOperationalGate {
  public evaluate(input: PaperRuntimeOperationalGateInput): PaperRuntimeOperationalGateResult {
    const reasons: string[] = [];

    if (input.enduranceStatus === "FAILED" || input.enduranceStatus === "NO_DATA") {
      reasons.push("Endurance certification is not acceptable for paper operation.");
    }

    if (input.riskReadiness === "BLOCKED") {
      reasons.push("Risk readiness is blocked.");
    }

    if (input.sessionState === "FINISHED") {
      reasons.push("Session is already finished.");
    }

    if (input.sessionState === "IDLE") {
      reasons.push("Session is idle and must be prepared before paper operation.");
    }

    if (reasons.length > 0) {
      return {
        decision: "BLOCK_PAPER_OPERATION",
        allowed: false,
        reasons,
      };
    }

    if (
      input.enduranceStatus === "WARNING"
      || input.riskReadiness === "CAUTION"
      || input.operatorMode === "UNSUPERVISED"
      || input.sessionState === "PAUSED"
    ) {
      return {
        decision: "REQUIRE_SUPERVISION",
        allowed: false,
        reasons: ["Paper operation requires active human supervision."],
      };
    }

    return {
      decision: "ALLOW_PAPER_OPERATION",
      allowed: true,
      reasons: ["Paper runtime operation is allowed under certified supervised conditions."],
    };
  }
}
TS

cat > tests/paper-runtime-operational-gate.test.js <<'JS'
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PaperRuntimeOperationalGate,
} = require("../dist/application/runtime/PaperRuntimeOperationalGate.js");

function input(overrides = {}) {
  return {
    enduranceStatus: "CERTIFIED",
    riskReadiness: "READY",
    sessionState: "READY",
    operatorMode: "SUPERVISED",
    ...overrides,
  };
}

test("allows paper operation when runtime is certified and supervised", () => {
  const gate = new PaperRuntimeOperationalGate();

  const result = gate.evaluate(input());

  assert.equal(result.decision, "ALLOW_PAPER_OPERATION");
  assert.equal(result.allowed, true);
});

test("blocks paper operation when endurance failed", () => {
  const gate = new PaperRuntimeOperationalGate();

  const result = gate.evaluate(input({
    enduranceStatus: "FAILED",
  }));

  assert.equal(result.decision, "BLOCK_PAPER_OPERATION");
  assert.equal(result.allowed, false);
  assert.match(result.reasons.join(" "), /Endurance/);
});

test("blocks paper operation when endurance has no data", () => {
  const gate = new PaperRuntimeOperationalGate();

  const result = gate.evaluate(input({
    enduranceStatus: "NO_DATA",
  }));

  assert.equal(result.decision, "BLOCK_PAPER_OPERATION");
  assert.equal(result.allowed, false);
});

test("blocks paper operation when risk readiness is blocked", () => {
  const gate = new PaperRuntimeOperationalGate();

  const result = gate.evaluate(input({
    riskReadiness: "BLOCKED",
  }));

  assert.equal(result.decision, "BLOCK_PAPER_OPERATION");
  assert.match(result.reasons.join(" "), /Risk readiness/);
});

test("requires supervision when endurance has warning", () => {
  const gate = new PaperRuntimeOperationalGate();

  const result = gate.evaluate(input({
    enduranceStatus: "WARNING",
  }));

  assert.equal(result.decision, "REQUIRE_SUPERVISION");
  assert.equal(result.allowed, false);
});

test("requires supervision when operator is unsupervised", () => {
  const gate = new PaperRuntimeOperationalGate();

  const result = gate.evaluate(input({
    operatorMode: "UNSUPERVISED",
  }));

  assert.equal(result.decision, "REQUIRE_SUPERVISION");
});

test("requires supervision when session is paused", () => {
  const gate = new PaperRuntimeOperationalGate();

  const result = gate.evaluate(input({
    sessionState: "PAUSED",
  }));

  assert.equal(result.decision, "REQUIRE_SUPERVISION");
});

test("blocks paper operation when session is finished", () => {
  const gate = new PaperRuntimeOperationalGate();

  const result = gate.evaluate(input({
    sessionState: "FINISHED",
  }));

  assert.equal(result.decision, "BLOCK_PAPER_OPERATION");
});

test("blocks paper operation when session is idle", () => {
  const gate = new PaperRuntimeOperationalGate();

  const result = gate.evaluate(input({
    sessionState: "IDLE",
  }));

  assert.equal(result.decision, "BLOCK_PAPER_OPERATION");
});
JS

npm run check:modules
npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/application/runtime/PaperRuntimeOperationalGate.ts \
  tests/paper-runtime-operational-gate.test.js \
  install/sprints/run-sprint-094.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 094 paper runtime operational gate"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 094 completed, merged and pushed successfully =="
