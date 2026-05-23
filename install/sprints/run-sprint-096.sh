#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-096-paper-runtime-hud-gate-integration"
COMMIT_MSG="feat(runtime): integrate paper supervisor with hud gate composer"

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

echo "== Sprint 096: Paper Runtime HUD Gate Integration =="
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

cat > src/application/runtime/PaperRuntimeHudGateComposer.ts <<'TS'
import type {
  PaperRuntimeSupervisorResult,
} from "./PaperRuntimeSessionSupervisor.js";

export interface PaperRuntimeHudGateOptions {
  readonly compact?: boolean;
  readonly width?: number;
}

export interface PaperRuntimeHudGateSnapshot {
  readonly text: string;
  readonly lineCount: number;
  readonly status: "READY" | "BLOCKED" | "SUPERVISION_REQUIRED";
}

/**
 * Renders paper runtime supervisor decisions into operator-facing HUD text.
 *
 * The composer is pure and side-effect free. It can be used by REPL, tmux,
 * CLI adapters or future UI layers without coupling the runtime to a terminal.
 *
 * Complexity:
 * - O(m), where m is the number of supervisor messages rendered.
 * - Memory O(m) for output lines.
 */
export class PaperRuntimeHudGateComposer {
  public compose(
    result: PaperRuntimeSupervisorResult,
    options: PaperRuntimeHudGateOptions = {},
  ): PaperRuntimeHudGateSnapshot {
    const status = this.status(result);

    if (options.compact === true) {
      const text = [
        `PAPER ${status}`,
        `decision=${result.decision} allowed=${result.allowed ? "YES" : "NO"} next=${result.nextSessionState}`,
        `gate=${result.gate.decision}`,
      ].join("\n");

      return {
        text,
        lineCount: 3,
        status,
      };
    }

    const width = Math.max(58, Math.min(options.width ?? 78, 100));
    const border = "─".repeat(width - 2);
    const lines: string[] = [];

    lines.push(`┌${border}┐`);
    lines.push(this.row("RL.SYS CORE — PAPER OPERATIONAL HUD", width));
    lines.push(`├${border}┤`);
    lines.push(this.row(`Status            : ${status}`, width));
    lines.push(this.row(`Supervisor        : ${result.decision}`, width));
    lines.push(this.row(`Allowed           : ${result.allowed ? "YES" : "NO"}`, width));
    lines.push(this.row(`Next Session State: ${result.nextSessionState}`, width));
    lines.push(this.row(`Gate Decision     : ${result.gate.decision}`, width));

    if (result.messages.length > 0) {
      lines.push(`├${border}┤`);

      for (const message of result.messages) {
        lines.push(this.row(`Guidance: ${message}`, width));
      }
    }

    lines.push(`└${border}┘`);

    return {
      text: lines.join("\n"),
      lineCount: lines.length,
      status,
    };
  }

  private status(result: PaperRuntimeSupervisorResult): "READY" | "BLOCKED" | "SUPERVISION_REQUIRED" {
    if (result.decision === "SUPERVISION_REQUIRED") {
      return "SUPERVISION_REQUIRED";
    }

    if (!result.allowed) {
      return "BLOCKED";
    }

    return "READY";
  }

  private row(content: string, width: number): string {
    const maxContentLength = width - 4;
    const visible = content.length > maxContentLength
      ? content.slice(0, maxContentLength - 1)
      : content;

    return `│ ${visible.padEnd(maxContentLength, " ")} │`;
  }
}
TS

cat > tests/paper-runtime-hud-gate-composer.test.js <<'JS'
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PaperRuntimeHudGateComposer,
} = require("../dist/application/runtime/PaperRuntimeHudGateComposer.js");

function supervisorResult(overrides = {}) {
  return {
    decision: "SESSION_STARTED",
    allowed: true,
    nextSessionState: "RUNNING",
    gate: {
      decision: "ALLOW_PAPER_OPERATION",
      allowed: true,
      reasons: ["ok"],
    },
    messages: ["Paper runtime session is supervised and operational."],
    ...overrides,
  };
}

test("renders ready paper runtime hud", () => {
  const composer = new PaperRuntimeHudGateComposer();

  const hud = composer.compose(supervisorResult(), { width: 76 });

  assert.equal(hud.status, "READY");
  assert.match(hud.text, /PAPER OPERATIONAL HUD/);
  assert.match(hud.text, /SESSION_STARTED/);
  assert.match(hud.text, /Allowed\s+: YES/);
});

test("renders compact paper runtime hud", () => {
  const composer = new PaperRuntimeHudGateComposer();

  const hud = composer.compose(supervisorResult(), { compact: true });

  assert.equal(hud.lineCount, 3);
  assert.equal(hud.status, "READY");
  assert.match(hud.text, /PAPER READY/);
  assert.match(hud.text, /allowed=YES/);
});

test("renders blocked status when supervisor denies command", () => {
  const composer = new PaperRuntimeHudGateComposer();

  const hud = composer.compose(supervisorResult({
    decision: "COMMAND_BLOCKED",
    allowed: false,
    nextSessionState: "READY",
    gate: {
      decision: "BLOCK_PAPER_OPERATION",
      allowed: false,
      reasons: ["Risk readiness is blocked."],
    },
    messages: ["Paper operation is blocked by operational gate."],
  }));

  assert.equal(hud.status, "BLOCKED");
  assert.match(hud.text, /COMMAND_BLOCKED/);
  assert.match(hud.text, /Guidance/);
});

test("renders supervision required status", () => {
  const composer = new PaperRuntimeHudGateComposer();

  const hud = composer.compose(supervisorResult({
    decision: "SUPERVISION_REQUIRED",
    allowed: false,
    nextSessionState: "READY",
    gate: {
      decision: "REQUIRE_SUPERVISION",
      allowed: false,
      reasons: ["Paper operation requires active human supervision."],
    },
    messages: ["Paper operation requires active human supervision."],
  }));

  assert.equal(hud.status, "SUPERVISION_REQUIRED");
  assert.match(hud.text, /SUPERVISION_REQUIRED/);
});

test("truncates long guidance lines safely", () => {
  const composer = new PaperRuntimeHudGateComposer();

  const hud = composer.compose(supervisorResult({
    messages: [
      "This is a very long guidance message that must be truncated safely to preserve terminal layout on small mobile screens.",
    ],
  }), { width: 58 });

  const lines = hud.text.split("\n");

  assert.equal(lines.every((line) => line.length <= 58), true);
});
JS

npm run check:modules
npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/application/runtime/PaperRuntimeHudGateComposer.ts \
  tests/paper-runtime-hud-gate-composer.test.js \
  install/sprints/run-sprint-096.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 096 paper runtime hud gate integration"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 096 completed, merged and pushed successfully =="
