#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-075-assisted-runtime-command-adapter"
COMMIT_MSG="feat(runtime): add assisted command adapter"

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

echo "== Sprint 075: Assisted Runtime Command Adapter =="
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

cat > src/application/runtime/AssistedRuntimeCommandAdapter.ts <<'TS'
import type {
  AssistedSessionCommand,
  AssistedSessionCommandType,
} from "../session/RuntimeAssistedSessionWiring.js";

export type AssistedRuntimeCommandParseStatus =
  | "PARSED"
  | "EMPTY_INPUT"
  | "UNKNOWN_COMMAND"
  | "INVALID_AMOUNT";

export interface AssistedRuntimeCommandParseResult {
  readonly status: AssistedRuntimeCommandParseStatus;
  readonly accepted: boolean;
  readonly message: string;
  readonly command?: AssistedSessionCommand;
}

const COMMAND_MAP: ReadonlyMap<string, AssistedSessionCommandType> = new Map([
  ["start", "START"],
  ["win", "WIN"],
  ["loss", "LOSS"],
  ["pause", "PAUSE"],
  ["resume", "RESUME"],
  ["report", "REPORT"],
  ["finish", "FINISH"],
  ["reset", "RESET"],
]);

/**
 * Converts human REPL input into strict assisted runtime commands.
 *
 * It is intentionally stateless and idempotent-friendly: command ids are
 * derived from normalized input plus timestamp provided by the caller.
 *
 * Complexity:
 * - parse: O(n), where n is input length.
 * - memory: O(1) besides normalized token array.
 */
export class AssistedRuntimeCommandAdapter {
  public parse(input: string, occurredAtEpochMs: number = Date.now()): AssistedRuntimeCommandParseResult {
    const normalized = input.trim().toLowerCase();

    if (normalized.length === 0) {
      return {
        status: "EMPTY_INPUT",
        accepted: false,
        message: "Empty command ignored.",
      };
    }

    const tokens = normalized.split(/\s+/);
    const commandName = tokens[0] ?? "";
    const commandType = COMMAND_MAP.get(commandName);

    if (commandType === undefined) {
      return {
        status: "UNKNOWN_COMMAND",
        accepted: false,
        message: `Unknown assisted runtime command: ${commandName}.`,
      };
    }

    const amount = this.parseAmountIfRequired(commandType, tokens);

    if (amount.status === "INVALID_AMOUNT") {
      return {
        status: "INVALID_AMOUNT",
        accepted: false,
        message: amount.message,
      };
    }

    return {
      status: "PARSED",
      accepted: true,
      message: "Command parsed successfully.",
      command: {
        id: this.createCommandId(normalized, occurredAtEpochMs),
        type: commandType,
        amount: amount.value,
        occurredAtEpochMs,
      },
    };
  }

  private parseAmountIfRequired(
    commandType: AssistedSessionCommandType,
    tokens: readonly string[],
  ): { readonly status: "OK"; readonly value?: number } | { readonly status: "INVALID_AMOUNT"; readonly message: string } {
    if (commandType !== "WIN" && commandType !== "LOSS") {
      return { status: "OK" };
    }

    const rawAmount = tokens[1];

    if (rawAmount === undefined) {
      return {
        status: "INVALID_AMOUNT",
        message: `${commandType} requires a positive amount.`,
      };
    }

    const value = Number(rawAmount.replace(",", "."));

    if (!Number.isFinite(value) || value <= 0) {
      return {
        status: "INVALID_AMOUNT",
        message: `${commandType} amount must be a positive finite number.`,
      };
    }

    return { status: "OK", value };
  }

  private createCommandId(normalizedInput: string, occurredAtEpochMs: number): string {
    return `assisted-${occurredAtEpochMs}-${this.hash(normalizedInput)}`;
  }

  private hash(value: string): string {
    let hash = 2166136261;

    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0).toString(16);
  }
}
TS

cat > tests/assisted-runtime-command-adapter.test.js <<'JS'
import test from "node:test";
import assert from "node:assert/strict";
import { AssistedRuntimeCommandAdapter } from "../dist/application/runtime/AssistedRuntimeCommandAdapter.js";

test("parses start command", () => {
  const adapter = new AssistedRuntimeCommandAdapter();

  const result = adapter.parse("start", 1000);

  assert.equal(result.status, "PARSED");
  assert.equal(result.accepted, true);
  assert.equal(result.command.type, "START");
});

test("parses win command with amount", () => {
  const adapter = new AssistedRuntimeCommandAdapter();

  const result = adapter.parse("win 25", 1000);

  assert.equal(result.status, "PARSED");
  assert.equal(result.command.type, "WIN");
  assert.equal(result.command.amount, 25);
});

test("parses loss command with comma decimal", () => {
  const adapter = new AssistedRuntimeCommandAdapter();

  const result = adapter.parse("loss 10,5", 1000);

  assert.equal(result.status, "PARSED");
  assert.equal(result.command.type, "LOSS");
  assert.equal(result.command.amount, 10.5);
});

test("rejects empty input", () => {
  const adapter = new AssistedRuntimeCommandAdapter();

  const result = adapter.parse("   ", 1000);

  assert.equal(result.status, "EMPTY_INPUT");
  assert.equal(result.accepted, false);
});

test("rejects unknown command", () => {
  const adapter = new AssistedRuntimeCommandAdapter();

  const result = adapter.parse("bet 10", 1000);

  assert.equal(result.status, "UNKNOWN_COMMAND");
  assert.equal(result.accepted, false);
});

test("rejects win without amount", () => {
  const adapter = new AssistedRuntimeCommandAdapter();

  const result = adapter.parse("win", 1000);

  assert.equal(result.status, "INVALID_AMOUNT");
  assert.equal(result.accepted, false);
});

test("rejects negative loss amount", () => {
  const adapter = new AssistedRuntimeCommandAdapter();

  const result = adapter.parse("loss -5", 1000);

  assert.equal(result.status, "INVALID_AMOUNT");
  assert.equal(result.accepted, false);
});

test("generates deterministic id for same normalized input and timestamp", () => {
  const adapter = new AssistedRuntimeCommandAdapter();

  const first = adapter.parse(" WIN 25 ", 1000);
  const second = adapter.parse("win 25", 1000);

  assert.equal(first.command.id, second.command.id);
});
JS

npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/application/runtime/AssistedRuntimeCommandAdapter.ts \
  tests/assisted-runtime-command-adapter.test.js \
  install/sprints/run-sprint-075.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 075 assisted runtime command adapter"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 075 completed, merged and pushed successfully =="
