#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-095-paper-runtime-session-supervisor"
COMMIT_MSG="feat(runtime): add paper session supervisor"

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

echo "== Sprint 095: Paper Runtime Session Supervisor =="
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

cat > src/application/runtime/PaperRuntimeSessionSupervisor.ts <<'TS'
import type {
  PaperRuntimeOperationalGate,
  PaperRuntimeOperationalGateInput,
  PaperRuntimeOperationalGateResult,
} from "./PaperRuntimeOperationalGate.js";

export type PaperRuntimeCommandIntent =
  | "PREPARE"
  | "START"
  | "PAUSE"
  | "RESUME"
  | "FINISH"
  | "STATUS";

export type PaperRuntimeSupervisorDecision =
  | "SESSION_PREPARED"
  | "SESSION_STARTED"
  | "SESSION_PAUSED"
  | "SESSION_RESUMED"
  | "SESSION_FINISHED"
  | "STATUS_REPORTED"
  | "COMMAND_BLOCKED"
  | "SUPERVISION_REQUIRED";

export interface PaperRuntimeSupervisorInput extends PaperRuntimeOperationalGateInput {
  readonly commandIntent: PaperRuntimeCommandIntent;
}

export interface PaperRuntimeSupervisorResult {
  readonly decision: PaperRuntimeSupervisorDecision;
  readonly allowed: boolean;
  readonly nextSessionState: PaperRuntimeOperationalGateInput["sessionState"];
  readonly gate: PaperRuntimeOperationalGateResult;
  readonly messages: readonly string[];
}

/**
 * Supervises paper runtime command flow using the operational gate.
 *
 * It does not execute financial operations. It only transitions paper session
 * governance state and blocks unsafe command intents.
 *
 * Complexity:
 * - O(1), fixed transition table.
 * - Memory O(1).
 */
export class PaperRuntimeSessionSupervisor {
  public constructor(
    private readonly gate: PaperRuntimeOperationalGate,
  ) {}

  public supervise(input: PaperRuntimeSupervisorInput): PaperRuntimeSupervisorResult {
    const gateResult = this.gate.evaluate(input);

    if (input.commandIntent === "STATUS") {
      return {
        decision: "STATUS_REPORTED",
        allowed: true,
        nextSessionState: input.sessionState,
        gate: gateResult,
        messages: gateResult.reasons,
      };
    }

    if (input.commandIntent === "PREPARE") {
      if (input.enduranceStatus === "FAILED" || input.enduranceStatus === "NO_DATA") {
        return this.block(input, gateResult, "Cannot prepare paper session without acceptable endurance certification.");
      }

      return {
        decision: "SESSION_PREPARED",
        allowed: true,
        nextSessionState: "READY",
        gate: gateResult,
        messages: ["Paper session prepared for supervised operation."],
      };
    }

    if (input.commandIntent === "FINISH") {
      return {
        decision: "SESSION_FINISHED",
        allowed: true,
        nextSessionState: "FINISHED",
        gate: gateResult,
        messages: ["Paper session finished."],
      };
    }

    if (input.commandIntent === "PAUSE") {
      if (input.sessionState !== "RUNNING") {
        return this.block(input, gateResult, "Only running paper sessions can be paused.");
      }

      return {
        decision: "SESSION_PAUSED",
        allowed: true,
        nextSessionState: "PAUSED",
        gate: gateResult,
        messages: ["Paper session paused."],
      };
    }

    if (input.commandIntent === "START" || input.commandIntent === "RESUME") {
      if (gateResult.decision === "BLOCK_PAPER_OPERATION") {
        return this.block(input, gateResult, "Paper operation is blocked by operational gate.");
      }

      if (gateResult.decision === "REQUIRE_SUPERVISION") {
        return {
          decision: "SUPERVISION_REQUIRED",
          allowed: false,
          nextSessionState: input.sessionState,
          gate: gateResult,
          messages: gateResult.reasons,
        };
      }

      return {
        decision: input.commandIntent === "START" ? "SESSION_STARTED" : "SESSION_RESUMED",
        allowed: true,
        nextSessionState: "RUNNING",
        gate: gateResult,
        messages: ["Paper runtime session is supervised and operational."],
      };
    }

    return this.block(input, gateResult, "Unsupported paper runtime command intent.");
  }

  private block(
    input: PaperRuntimeSupervisorInput,
    gate: PaperRuntimeOperationalGateResult,
    message: string,
  ): PaperRuntimeSupervisorResult {
    return {
      decision: "COMMAND_BLOCKED",
      allowed: false,
      nextSessionState: input.sessionState,
      gate,
      messages: [message, ...gate.reasons],
    };
  }
}
TS

cat > tests/paper-runtime-session-supervisor.test.js <<'JS'
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PaperRuntimeOperationalGate,
} = require("../dist/application/runtime/PaperRuntimeOperationalGate.js");
const {
  PaperRuntimeSessionSupervisor,
} = require("../dist/application/runtime/PaperRuntimeSessionSupervisor.js");

function input(overrides = {}) {
  return {
    enduranceStatus: "CERTIFIED",
    riskReadiness: "READY",
    sessionState: "READY",
    operatorMode: "SUPERVISED",
    commandIntent: "START",
    ...overrides,
  };
}

test("prepares paper session when endurance is acceptable", () => {
  const supervisor = new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate());

  const result = supervisor.supervise(input({
    sessionState: "IDLE",
    commandIntent: "PREPARE",
  }));

  assert.equal(result.decision, "SESSION_PREPARED");
  assert.equal(result.allowed, true);
  assert.equal(result.nextSessionState, "READY");
});

test("blocks prepare when endurance has no data", () => {
  const supervisor = new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate());

  const result = supervisor.supervise(input({
    enduranceStatus: "NO_DATA",
    sessionState: "IDLE",
    commandIntent: "PREPARE",
  }));

  assert.equal(result.decision, "COMMAND_BLOCKED");
  assert.equal(result.allowed, false);
});

test("starts paper session when gate allows operation", () => {
  const supervisor = new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate());

  const result = supervisor.supervise(input({
    commandIntent: "START",
  }));

  assert.equal(result.decision, "SESSION_STARTED");
  assert.equal(result.allowed, true);
  assert.equal(result.nextSessionState, "RUNNING");
});

test("requires supervision when gate requires supervision", () => {
  const supervisor = new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate());

  const result = supervisor.supervise(input({
    commandIntent: "START",
    operatorMode: "UNSUPERVISED",
  }));

  assert.equal(result.decision, "SUPERVISION_REQUIRED");
  assert.equal(result.allowed, false);
});

test("blocks start when risk readiness is blocked", () => {
  const supervisor = new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate());

  const result = supervisor.supervise(input({
    commandIntent: "START",
    riskReadiness: "BLOCKED",
  }));

  assert.equal(result.decision, "COMMAND_BLOCKED");
  assert.equal(result.allowed, false);
});

test("pauses a running paper session", () => {
  const supervisor = new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate());

  const result = supervisor.supervise(input({
    commandIntent: "PAUSE",
    sessionState: "RUNNING",
  }));

  assert.equal(result.decision, "SESSION_PAUSED");
  assert.equal(result.nextSessionState, "PAUSED");
});

test("blocks pause when session is not running", () => {
  const supervisor = new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate());

  const result = supervisor.supervise(input({
    commandIntent: "PAUSE",
    sessionState: "READY",
  }));

  assert.equal(result.decision, "COMMAND_BLOCKED");
});

test("resumes paused session only through operational gate", () => {
  const supervisor = new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate());

  const result = supervisor.supervise(input({
    commandIntent: "RESUME",
    sessionState: "READY",
  }));

  assert.equal(result.decision, "SESSION_RESUMED");
  assert.equal(result.nextSessionState, "RUNNING");
});

test("finishes paper session regardless of gate state", () => {
  const supervisor = new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate());

  const result = supervisor.supervise(input({
    commandIntent: "FINISH",
    riskReadiness: "BLOCKED",
  }));

  assert.equal(result.decision, "SESSION_FINISHED");
  assert.equal(result.allowed, true);
  assert.equal(result.nextSessionState, "FINISHED");
});

test("reports status without changing session state", () => {
  const supervisor = new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate());

  const result = supervisor.supervise(input({
    commandIntent: "STATUS",
    sessionState: "PAUSED",
  }));

  assert.equal(result.decision, "STATUS_REPORTED");
  assert.equal(result.allowed, true);
  assert.equal(result.nextSessionState, "PAUSED");
});
JS

npm run check:modules
npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/application/runtime/PaperRuntimeSessionSupervisor.ts \
  tests/paper-runtime-session-supervisor.test.js \
  install/sprints/run-sprint-095.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 095 paper runtime session supervisor"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 095 completed, merged and pushed successfully =="
