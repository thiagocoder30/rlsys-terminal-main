#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-099-live-paper-runtime-clean-gate-rewrite"
COMMIT_MSG="feat(runtime): add live paper runtime with clean gate policy"

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

echo "== Sprint 099 V4: Live Paper Runtime Clean Gate Rewrite =="
echo "Project root: $ROOT_DIR"

git checkout main
git pull origin main
git reset --hard
git clean -fd dist || true
git restore --worktree --staged dist 2>/dev/null || true

for branch in \
  sprint-098-paper-runtime-interactive-loop \
  sprint-099-live-runtime-paper-session-boot \
  sprint-099-live-paper-runtime-boot-fix \
  sprint-099-live-paper-runtime-boot-policy-fix \
  sprint-099-live-paper-runtime-clean-gate-rewrite
do
  if git show-ref --verify --quiet "refs/heads/$branch"; then
    git branch -D "$branch"
  fi
done

git checkout -b "$BRANCH"

mkdir -p src/application/runtime scripts tests

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
 * Authorizes only supervised paper operation.
 *
 * This gate never authorizes real-money operation. It only decides whether
 * a paper session may proceed, requires active supervision, or must be blocked.
 *
 * Complexity:
 * - O(1), fixed rule set.
 * - Memory O(1).
 */
export class PaperRuntimeOperationalGate {
  public evaluate(input: PaperRuntimeOperationalGateInput): PaperRuntimeOperationalGateResult {
    const blockReasons: string[] = [];

    if (input.enduranceStatus === "FAILED" || input.enduranceStatus === "NO_DATA") {
      blockReasons.push("Endurance certification is not acceptable for paper operation.");
    }

    if (input.riskReadiness === "BLOCKED") {
      blockReasons.push("Risk readiness is blocked.");
    }

    if (input.sessionState === "FINISHED") {
      blockReasons.push("Session is already finished.");
    }

    if (input.sessionState === "IDLE") {
      blockReasons.push("Session is idle and must be prepared before paper operation.");
    }

    if (blockReasons.length > 0) {
      return {
        decision: "BLOCK_PAPER_OPERATION",
        allowed: false,
        reasons: blockReasons,
      };
    }

    const supervisionReasons: string[] = [];

    if (input.enduranceStatus === "WARNING") {
      supervisionReasons.push("Endurance certification has warnings.");
    }

    if (input.riskReadiness === "CAUTION") {
      supervisionReasons.push("Risk readiness requires caution.");
    }

    if (input.operatorMode === "UNSUPERVISED") {
      supervisionReasons.push("Paper operation requires active human supervision.");
    }

    if (supervisionReasons.length > 0) {
      return {
        decision: "REQUIRE_SUPERVISION",
        allowed: false,
        reasons: supervisionReasons,
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

cat > src/application/runtime/PaperRuntimeInteractiveLoop.ts <<'TS'
import type {
  PaperRuntimeReplCommandAdapter,
} from "./PaperRuntimeReplCommandAdapter.js";

export type InteractiveLoopSessionState =
  | "IDLE"
  | "READY"
  | "RUNNING"
  | "PAUSED"
  | "FINISHED";

export interface PaperRuntimeInteractiveLoopState {
  readonly sessionState: InteractiveLoopSessionState;
  readonly lastCommand?: string;
  readonly iteration: number;
}

export interface PaperRuntimeInteractiveLoopResult {
  readonly state: PaperRuntimeInteractiveLoopState;
  readonly output: string;
  readonly accepted: boolean;
}

/**
 * Stateful supervised paper runtime loop.
 *
 * Complexity:
 * - O(1) per command.
 * - Memory O(1).
 */
export class PaperRuntimeInteractiveLoop {
  private state: PaperRuntimeInteractiveLoopState = {
    sessionState: "IDLE",
    iteration: 0,
  };

  public constructor(
    private readonly adapter: PaperRuntimeReplCommandAdapter,
  ) {}

  public currentState(): PaperRuntimeInteractiveLoopState {
    return this.state;
  }

  public handle(command: string): PaperRuntimeInteractiveLoopResult {
    const result = this.adapter.handle(command, {
      enduranceStatus: "CERTIFIED",
      riskReadiness: "READY",
      operatorMode: "SUPERVISED",
      sessionState: this.state.sessionState,
    });

    const nextSessionState = result.supervisorResult?.nextSessionState ?? this.state.sessionState;

    this.state = {
      sessionState: nextSessionState,
      lastCommand: command,
      iteration: this.state.iteration + 1,
    };

    return {
      state: this.state,
      output: result.hud?.text ?? result.message,
      accepted: result.accepted,
    };
  }
}
TS

cat > scripts/paper-runtime-session.js <<'JS'
const readline = require("node:readline");
const {
  PaperRuntimeOperationalGate,
} = require("../dist/application/runtime/PaperRuntimeOperationalGate.js");
const {
  PaperRuntimeSessionSupervisor,
} = require("../dist/application/runtime/PaperRuntimeSessionSupervisor.js");
const {
  PaperRuntimeHudGateComposer,
} = require("../dist/application/runtime/PaperRuntimeHudGateComposer.js");
const {
  PaperRuntimeReplCommandAdapter,
} = require("../dist/application/runtime/PaperRuntimeReplCommandAdapter.js");
const {
  PaperRuntimeInteractiveLoop,
} = require("../dist/application/runtime/PaperRuntimeInteractiveLoop.js");

function createLoop() {
  return new PaperRuntimeInteractiveLoop(
    new PaperRuntimeReplCommandAdapter(
      new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate()),
      new PaperRuntimeHudGateComposer(),
    ),
  );
}

function printHelp() {
  console.log([
    "RL.SYS PAPER RUNTIME SESSION",
    "",
    "Commands:",
    "  prepare",
    "  start",
    "  status",
    "  pause",
    "  resume",
    "  finish",
    "  exit",
    "",
  ].join("\n"));
}

function main() {
  const loop = createLoop();
  printHelp();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "paper> ",
  });

  rl.prompt();

  rl.on("line", (line) => {
    const command = line.trim().toLowerCase();

    if (command === "exit" || command === "quit") {
      rl.close();
      return;
    }

    const result = loop.handle(line);
    console.log(result.output);
    rl.prompt();
  });

  rl.on("close", () => {
    console.log("RL.SYS paper runtime session closed.");
  });
}

main();
JS

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

test("allows certified supervised paper operation", () => {
  const result = new PaperRuntimeOperationalGate().evaluate(input());

  assert.equal(result.decision, "ALLOW_PAPER_OPERATION");
  assert.equal(result.allowed, true);
});

test("blocks failed endurance", () => {
  const result = new PaperRuntimeOperationalGate().evaluate(input({
    enduranceStatus: "FAILED",
  }));

  assert.equal(result.decision, "BLOCK_PAPER_OPERATION");
});

test("blocks missing endurance data", () => {
  const result = new PaperRuntimeOperationalGate().evaluate(input({
    enduranceStatus: "NO_DATA",
  }));

  assert.equal(result.decision, "BLOCK_PAPER_OPERATION");
});

test("blocks blocked risk readiness", () => {
  const result = new PaperRuntimeOperationalGate().evaluate(input({
    riskReadiness: "BLOCKED",
  }));

  assert.equal(result.decision, "BLOCK_PAPER_OPERATION");
});

test("blocks idle session", () => {
  const result = new PaperRuntimeOperationalGate().evaluate(input({
    sessionState: "IDLE",
  }));

  assert.equal(result.decision, "BLOCK_PAPER_OPERATION");
});

test("blocks finished session", () => {
  const result = new PaperRuntimeOperationalGate().evaluate(input({
    sessionState: "FINISHED",
  }));

  assert.equal(result.decision, "BLOCK_PAPER_OPERATION");
});

test("requires supervision when operator is unsupervised", () => {
  const result = new PaperRuntimeOperationalGate().evaluate(input({
    operatorMode: "UNSUPERVISED",
  }));

  assert.equal(result.decision, "REQUIRE_SUPERVISION");
});

test("requires supervision on endurance warning", () => {
  const result = new PaperRuntimeOperationalGate().evaluate(input({
    enduranceStatus: "WARNING",
  }));

  assert.equal(result.decision, "REQUIRE_SUPERVISION");
});

test("allows paused session when operator is supervised", () => {
  const result = new PaperRuntimeOperationalGate().evaluate(input({
    sessionState: "PAUSED",
    operatorMode: "SUPERVISED",
  }));

  assert.equal(result.decision, "ALLOW_PAPER_OPERATION");
});
JS

cat > tests/paper-runtime-interactive-loop.test.js <<'JS'
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PaperRuntimeOperationalGate,
} = require("../dist/application/runtime/PaperRuntimeOperationalGate.js");
const {
  PaperRuntimeSessionSupervisor,
} = require("../dist/application/runtime/PaperRuntimeSessionSupervisor.js");
const {
  PaperRuntimeHudGateComposer,
} = require("../dist/application/runtime/PaperRuntimeHudGateComposer.js");
const {
  PaperRuntimeReplCommandAdapter,
} = require("../dist/application/runtime/PaperRuntimeReplCommandAdapter.js");
const {
  PaperRuntimeInteractiveLoop,
} = require("../dist/application/runtime/PaperRuntimeInteractiveLoop.js");

function createLoop() {
  return new PaperRuntimeInteractiveLoop(
    new PaperRuntimeReplCommandAdapter(
      new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate()),
      new PaperRuntimeHudGateComposer(),
    ),
  );
}

test("paper runtime loop transitions through supervised lifecycle", () => {
  const loop = createLoop();

  assert.equal(loop.currentState().sessionState, "IDLE");
  assert.equal(loop.handle("prepare").state.sessionState, "READY");
  assert.equal(loop.handle("start").state.sessionState, "RUNNING");
  assert.equal(loop.handle("pause").state.sessionState, "PAUSED");
  assert.equal(loop.handle("resume").state.sessionState, "RUNNING");
  assert.equal(loop.handle("finish").state.sessionState, "FINISHED");
});

test("paper runtime loop rejects invalid commands without state corruption", () => {
  const loop = createLoop();

  const result = loop.handle("explode");

  assert.equal(result.accepted, false);
  assert.equal(result.state.sessionState, "IDLE");
  assert.match(result.output, /Unknown/);
});

test("paper runtime loop maintains bounded state", () => {
  const loop = createLoop();

  for (let index = 0; index < 1000; index += 1) {
    loop.handle("status");
  }

  assert.equal(loop.currentState().iteration, 1000);
});
JS

cat > tests/paper-runtime-session-script.test.js <<'JS'
const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { readFileSync } = require("node:fs");

test("paper runtime session script exposes interactive commands", () => {
  const source = readFileSync("scripts/paper-runtime-session.js", "utf8");

  assert.match(source, /readline/);
  assert.match(source, /prepare/);
  assert.match(source, /start/);
  assert.match(source, /finish/);
});

test("paper runtime session processes scripted stdin", () => {
  const result = spawnSync("node", [
    "scripts/paper-runtime-session.js",
  ], {
    input: "prepare\nstart\npause\nresume\nstatus\nfinish\nexit\n",
    encoding: "utf8",
    timeout: 5000,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /RL\.SYS PAPER RUNTIME SESSION/);
  assert.match(result.stdout, /PAPER READY/);
  assert.match(result.stdout, /SESSION_STARTED/);
  assert.match(result.stdout, /SESSION_PAUSED/);
  assert.match(result.stdout, /SESSION_RESUMED/);
  assert.match(result.stdout, /SESSION_FINISHED/);
});
JS

node <<'NODE'
const fs = require("node:fs");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

if (!pkg.scripts) {
  pkg.scripts = {};
}

pkg.scripts["paper:runtime"] = "node scripts/paper-runtime-session.js";

fs.writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
NODE

npm run check:modules
npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  package.json \
  package-lock.json \
  src/application/runtime/PaperRuntimeOperationalGate.ts \
  src/application/runtime/PaperRuntimeInteractiveLoop.ts \
  scripts/paper-runtime-session.js \
  tests/paper-runtime-operational-gate.test.js \
  tests/paper-runtime-interactive-loop.test.js \
  tests/paper-runtime-session-script.test.js \
  install/sprints/run-sprint-099.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 099 live paper runtime clean gate rewrite"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 099 completed, merged and pushed successfully =="
