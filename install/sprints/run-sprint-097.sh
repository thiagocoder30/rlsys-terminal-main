#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-097-paper-runtime-repl-command-wiring"
COMMIT_MSG="feat(runtime): wire paper repl commands to supervisor hud"

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

echo "== Sprint 097: Paper Runtime REPL Command Wiring =="
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

cat > src/application/runtime/PaperRuntimeReplCommandAdapter.ts <<'TS'
import type {
  PaperRuntimeCommandIntent,
  PaperRuntimeSessionSupervisor,
  PaperRuntimeSupervisorInput,
  PaperRuntimeSupervisorResult,
} from "./PaperRuntimeSessionSupervisor.js";
import type {
  PaperRuntimeHudGateComposer,
  PaperRuntimeHudGateSnapshot,
} from "./PaperRuntimeHudGateComposer.js";

export interface PaperRuntimeReplContext
  extends Omit<PaperRuntimeSupervisorInput, "commandIntent"> {}

export interface PaperRuntimeReplCommandResult {
  readonly accepted: boolean;
  readonly commandText: string;
  readonly intent?: PaperRuntimeCommandIntent;
  readonly supervisorResult?: PaperRuntimeSupervisorResult;
  readonly hud?: PaperRuntimeHudGateSnapshot;
  readonly message: string;
}

/**
 * Adapts operator text commands into paper runtime supervised actions.
 *
 * This adapter is pure application wiring. It does not own stdin/stdout and can
 * be used by REPL, tests, tmux wrappers or future CLI interfaces.
 *
 * Complexity:
 * - O(1), fixed command dictionary.
 * - Memory O(1).
 */
export class PaperRuntimeReplCommandAdapter {
  private readonly commandMap: ReadonlyMap<string, PaperRuntimeCommandIntent>;

  public constructor(
    private readonly supervisor: PaperRuntimeSessionSupervisor,
    private readonly hudComposer: PaperRuntimeHudGateComposer,
  ) {
    this.commandMap = new Map<string, PaperRuntimeCommandIntent>([
      ["prepare", "PREPARE"],
      ["prep", "PREPARE"],
      ["start", "START"],
      ["pause", "PAUSE"],
      ["resume", "RESUME"],
      ["finish", "FINISH"],
      ["stop", "FINISH"],
      ["status", "STATUS"],
    ]);
  }

  public handle(
    commandText: string,
    context: PaperRuntimeReplContext,
  ): PaperRuntimeReplCommandResult {
    const normalized = commandText.trim().toLowerCase();

    if (normalized.length === 0) {
      return {
        accepted: false,
        commandText,
        message: "Empty paper runtime command.",
      };
    }

    const intent = this.commandMap.get(normalized);

    if (intent === undefined) {
      return {
        accepted: false,
        commandText,
        message: `Unknown paper runtime command: ${commandText}.`,
      };
    }

    const supervisorResult = this.supervisor.supervise({
      ...context,
      commandIntent: intent,
    });

    const hud = this.hudComposer.compose(supervisorResult, {
      compact: true,
    });

    return {
      accepted: true,
      commandText,
      intent,
      supervisorResult,
      hud,
      message: "Paper runtime command handled.",
    };
  }
}
TS

cat > tests/paper-runtime-repl-command-adapter.test.js <<'JS'
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

function adapter() {
  return new PaperRuntimeReplCommandAdapter(
    new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate()),
    new PaperRuntimeHudGateComposer(),
  );
}

function context(overrides = {}) {
  return {
    enduranceStatus: "CERTIFIED",
    riskReadiness: "READY",
    sessionState: "READY",
    operatorMode: "SUPERVISED",
    ...overrides,
  };
}

test("maps prepare command to supervised preparation", () => {
  const result = adapter().handle("prepare", context({
    sessionState: "IDLE",
  }));

  assert.equal(result.accepted, true);
  assert.equal(result.intent, "PREPARE");
  assert.equal(result.supervisorResult.decision, "SESSION_PREPARED");
  assert.match(result.hud.text, /PAPER READY/);
});

test("maps start command to session start", () => {
  const result = adapter().handle("start", context());

  assert.equal(result.accepted, true);
  assert.equal(result.intent, "START");
  assert.equal(result.supervisorResult.decision, "SESSION_STARTED");
});

test("maps pause command to session pause", () => {
  const result = adapter().handle("pause", context({
    sessionState: "RUNNING",
  }));

  assert.equal(result.accepted, true);
  assert.equal(result.intent, "PAUSE");
  assert.equal(result.supervisorResult.decision, "SESSION_PAUSED");
});

test("maps resume command to session resume", () => {
  const result = adapter().handle("resume", context({
    sessionState: "READY",
  }));

  assert.equal(result.accepted, true);
  assert.equal(result.intent, "RESUME");
  assert.equal(result.supervisorResult.nextSessionState, "RUNNING");
});

test("maps stop alias to finish", () => {
  const result = adapter().handle("stop", context({
    sessionState: "RUNNING",
  }));

  assert.equal(result.accepted, true);
  assert.equal(result.intent, "FINISH");
  assert.equal(result.supervisorResult.decision, "SESSION_FINISHED");
});

test("returns status hud without changing state", () => {
  const result = adapter().handle("status", context({
    sessionState: "PAUSED",
  }));

  assert.equal(result.accepted, true);
  assert.equal(result.intent, "STATUS");
  assert.equal(result.supervisorResult.nextSessionState, "PAUSED");
  assert.match(result.hud.text, /PAPER READY/);
});

test("rejects unknown command", () => {
  const result = adapter().handle("bet now", context());

  assert.equal(result.accepted, false);
  assert.match(result.message, /Unknown/);
});

test("rejects empty command", () => {
  const result = adapter().handle("   ", context());

  assert.equal(result.accepted, false);
  assert.match(result.message, /Empty/);
});

test("returns blocked hud when risk blocks operation", () => {
  const result = adapter().handle("start", context({
    riskReadiness: "BLOCKED",
  }));

  assert.equal(result.accepted, true);
  assert.equal(result.supervisorResult.decision, "COMMAND_BLOCKED");
  assert.equal(result.hud.status, "BLOCKED");
  assert.match(result.hud.text, /PAPER BLOCKED/);
});
JS

npm run check:modules
npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/application/runtime/PaperRuntimeReplCommandAdapter.ts \
  tests/paper-runtime-repl-command-adapter.test.js \
  install/sprints/run-sprint-097.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 097 paper runtime repl command wiring"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 097 completed, merged and pushed successfully =="
