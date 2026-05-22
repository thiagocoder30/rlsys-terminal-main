#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-078-runtime-hud-live-renderer"
COMMIT_MSG="feat(runtime): add assisted runtime hud renderer"

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

echo "== Sprint 078: Runtime HUD Live Renderer =="
echo "Project root: $ROOT_DIR"
echo "Recommended cockpit: tmux / rlwatch / lazygit"

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

cat > src/application/runtime/RuntimeHudLiveRenderer.ts <<'TS'
export type RuntimeHudRiskState =
  | "SAFE"
  | "CAUTION"
  | "BLOCKED";

export type RuntimeHudSessionState =
  | "IDLE"
  | "RUNNING"
  | "PAUSED"
  | "FINISHED";

export interface RuntimeHudLiveSnapshot {
  readonly bankroll: number;
  readonly initialBankroll: number;
  readonly profitLocked: number;
  readonly drawdown: number;
  readonly cooldownActive: boolean;
  readonly riskState: RuntimeHudRiskState;
  readonly sessionState: RuntimeHudSessionState;
  readonly lastAction: string;
  readonly updatedAtEpochMs: number;
}

export interface RuntimeHudRenderOptions {
  readonly compact?: boolean;
  readonly width?: number;
}

export interface RuntimeHudRenderResult {
  readonly text: string;
  readonly lineCount: number;
}

/**
 * Renders a lightweight terminal HUD for assisted runtime operation.
 *
 * The renderer is pure and framework-free. It can be used by tmux, readline,
 * tests, mobile shells or future UI adapters without changing domain rules.
 *
 * Complexity:
 * - O(1), because the HUD has fixed-size fields.
 * - Memory O(1).
 */
export class RuntimeHudLiveRenderer {
  public render(
    snapshot: RuntimeHudLiveSnapshot,
    options: RuntimeHudRenderOptions = {},
  ): RuntimeHudRenderResult {
    this.validateSnapshot(snapshot);

    const width = Math.max(42, Math.min(options.width ?? 64, 96));
    const border = "─".repeat(width - 2);
    const net = snapshot.bankroll - snapshot.initialBankroll;

    if (options.compact === true) {
      const text = [
        `RL.SYS | ${snapshot.sessionState} | ${snapshot.riskState}`,
        `bankroll=${this.money(snapshot.bankroll)} net=${this.signedMoney(net)} dd=${this.money(snapshot.drawdown)}`,
        `cooldown=${snapshot.cooldownActive ? "ON" : "OFF"} lock=${this.money(snapshot.profitLocked)} last=${snapshot.lastAction}`,
      ].join("\n");

      return {
        text,
        lineCount: 3,
      };
    }

    const lines = [
      `┌${border}┐`,
      this.row("RL.SYS CORE — ASSISTED RUNTIME HUD", width),
      `├${border}┤`,
      this.row(`Session     : ${snapshot.sessionState}`, width),
      this.row(`Risk State  : ${snapshot.riskState}`, width),
      this.row(`Bankroll    : ${this.money(snapshot.bankroll)}`, width),
      this.row(`Net Result  : ${this.signedMoney(net)}`, width),
      this.row(`Drawdown    : ${this.money(snapshot.drawdown)}`, width),
      this.row(`Profit Lock : ${this.money(snapshot.profitLocked)}`, width),
      this.row(`Cooldown    : ${snapshot.cooldownActive ? "ACTIVE" : "INACTIVE"}`, width),
      this.row(`Last Action : ${snapshot.lastAction}`, width),
      this.row(`Updated At  : ${snapshot.updatedAtEpochMs}`, width),
      `└${border}┘`,
    ];

    return {
      text: lines.join("\n"),
      lineCount: lines.length,
    };
  }

  private validateSnapshot(snapshot: RuntimeHudLiveSnapshot): void {
    const numericFields: ReadonlyArray<readonly [string, number]> = [
      ["bankroll", snapshot.bankroll],
      ["initialBankroll", snapshot.initialBankroll],
      ["profitLocked", snapshot.profitLocked],
      ["drawdown", snapshot.drawdown],
      ["updatedAtEpochMs", snapshot.updatedAtEpochMs],
    ];

    for (const [name, value] of numericFields) {
      if (!Number.isFinite(value)) {
        throw new Error(`Invalid HUD snapshot: ${name} must be finite.`);
      }
    }

    if (snapshot.bankroll < 0 || snapshot.initialBankroll < 0) {
      throw new Error("Invalid HUD snapshot: bankroll values cannot be negative.");
    }

    if (snapshot.drawdown < 0 || snapshot.profitLocked < 0) {
      throw new Error("Invalid HUD snapshot: risk values cannot be negative.");
    }

    if (snapshot.lastAction.trim().length === 0) {
      throw new Error("Invalid HUD snapshot: lastAction cannot be empty.");
    }
  }

  private row(content: string, width: number): string {
    const maxContentLength = width - 4;
    const visible = content.length > maxContentLength
      ? content.slice(0, maxContentLength - 1)
      : content;

    return `│ ${visible.padEnd(maxContentLength, " ")} │`;
  }

  private money(value: number): string {
    return value.toFixed(2);
  }

  private signedMoney(value: number): string {
    const prefix = value >= 0 ? "+" : "";
    return `${prefix}${value.toFixed(2)}`;
  }
}
TS

cat > tests/runtime-hud-live-renderer.test.js <<'JS'
import test from "node:test";
import assert from "node:assert/strict";
import { RuntimeHudLiveRenderer } from "../dist/application/runtime/RuntimeHudLiveRenderer.js";

function snapshot() {
  return {
    bankroll: 1125,
    initialBankroll: 1000,
    profitLocked: 80,
    drawdown: 20,
    cooldownActive: false,
    riskState: "SAFE",
    sessionState: "RUNNING",
    lastAction: "WIN 25",
    updatedAtEpochMs: 1000,
  };
}

test("renders full assisted runtime HUD", () => {
  const renderer = new RuntimeHudLiveRenderer();

  const result = renderer.render(snapshot(), { width: 60 });

  assert.equal(result.lineCount, 13);
  assert.match(result.text, /RL\.SYS CORE/);
  assert.match(result.text, /Bankroll/);
  assert.match(result.text, /1125\.00/);
  assert.match(result.text, /\+125\.00/);
});

test("renders compact HUD for tmux panes", () => {
  const renderer = new RuntimeHudLiveRenderer();

  const result = renderer.render(snapshot(), { compact: true });

  assert.equal(result.lineCount, 3);
  assert.match(result.text, /RL\.SYS/);
  assert.match(result.text, /bankroll=1125\.00/);
  assert.match(result.text, /cooldown=OFF/);
});

test("renders negative net result with sign", () => {
  const renderer = new RuntimeHudLiveRenderer();

  const result = renderer.render({
    ...snapshot(),
    bankroll: 940,
  });

  assert.match(result.text, /-60\.00/);
});

test("rejects invalid numeric values", () => {
  const renderer = new RuntimeHudLiveRenderer();

  assert.throws(
    () => renderer.render({
      ...snapshot(),
      bankroll: Number.NaN,
    }),
    /bankroll must be finite/,
  );
});

test("rejects empty last action", () => {
  const renderer = new RuntimeHudLiveRenderer();

  assert.throws(
    () => renderer.render({
      ...snapshot(),
      lastAction: "   ",
    }),
    /lastAction cannot be empty/,
  );
});
JS

npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/application/runtime/RuntimeHudLiveRenderer.ts \
  tests/runtime-hud-live-renderer.test.js \
  install/sprints/run-sprint-078.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 078 runtime hud live renderer"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 078 completed, merged and pushed successfully =="
echo ""
echo "Cockpit commands:"
echo "  rl       -> open project"
echo "  rlt      -> run tests"
echo "  rlb      -> build"
echo "  rlg      -> lazygit"
echo "  rlwatch  -> tmux cockpit"
