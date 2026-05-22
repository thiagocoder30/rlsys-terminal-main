#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-076-assisted-runtime-repl-loop"
COMMIT_MSG="feat(runtime): add assisted runtime repl loop"

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

echo "== Sprint 076: Assisted Runtime REPL Loop =="
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

cat > src/application/runtime/AssistedRuntimeReplLoop.ts <<'TS'
import type {
  AssistedSessionResult,
} from "../session/RuntimeAssistedSessionWiring.js";
import type {
  AssistedRuntimeCommandParseResult,
} from "./AssistedRuntimeCommandAdapter.js";

export interface AssistedRuntimeCommandParserPort {
  parse(input: string, occurredAtEpochMs?: number): AssistedRuntimeCommandParseResult;
}

export interface AssistedRuntimeHandlerPort {
  handle(command: NonNullable<AssistedRuntimeCommandParseResult["command"]>): Promise<AssistedSessionResult>;
}

export interface AssistedRuntimeReplOutputPort {
  writeLine(message: string): void;
}

export interface AssistedRuntimeReplStepResult {
  readonly accepted: boolean;
  readonly shouldContinue: boolean;
  readonly message: string;
  readonly assistedResult?: AssistedSessionResult;
}

/**
 * Stateless REPL step executor for assisted runtime operation.
 *
 * It intentionally processes one line at a time, making it easy to connect
 * to Node readline, tests, mobile shells or future streaming interfaces.
 *
 * Complexity:
 * - O(n) per input line due to parsing.
 * - O(1) orchestration overhead.
 */
export class AssistedRuntimeReplLoop {
  public constructor(
    private readonly parser: AssistedRuntimeCommandParserPort,
    private readonly handler: AssistedRuntimeHandlerPort,
    private readonly output: AssistedRuntimeReplOutputPort,
  ) {}

  public async step(input: string, occurredAtEpochMs: number = Date.now()): Promise<AssistedRuntimeReplStepResult> {
    const parsed = this.parser.parse(input, occurredAtEpochMs);

    if (!parsed.accepted || parsed.command === undefined) {
      this.output.writeLine(parsed.message);

      return {
        accepted: false,
        shouldContinue: true,
        message: parsed.message,
      };
    }

    const assistedResult = await this.handler.handle(parsed.command);

    this.output.writeLine(assistedResult.message);

    if (assistedResult.hud !== undefined) {
      this.output.writeLine(assistedResult.hud);
    }

    if (assistedResult.report !== undefined) {
      this.output.writeLine(assistedResult.report);
    }

    const shouldContinue = parsed.command.type !== "FINISH" && parsed.command.type !== "RESET";

    return {
      accepted: assistedResult.accepted,
      shouldContinue,
      message: assistedResult.message,
      assistedResult,
    };
  }
}
TS

cat > tests/assisted-runtime-repl-loop.test.js <<'JS'
import test from "node:test";
import assert from "node:assert/strict";
import { AssistedRuntimeReplLoop } from "../dist/application/runtime/AssistedRuntimeReplLoop.js";

test("prints parser rejection and continues", async () => {
  const output = [];

  const loop = new AssistedRuntimeReplLoop(
    {
      parse: () => ({
        status: "UNKNOWN_COMMAND",
        accepted: false,
        message: "Unknown command.",
      }),
    },
    {
      handle: async () => {
        throw new Error("handler should not run");
      },
    },
    { writeLine: (message) => output.push(message) },
  );

  const result = await loop.step("invalid", 1000);

  assert.equal(result.accepted, false);
  assert.equal(result.shouldContinue, true);
  assert.deepEqual(output, ["Unknown command."]);
});

test("handles parsed command and prints message plus HUD", async () => {
  const output = [];

  const loop = new AssistedRuntimeReplLoop(
    {
      parse: () => ({
        status: "PARSED",
        accepted: true,
        message: "parsed",
        command: {
          id: "cmd-start",
          type: "START",
          occurredAtEpochMs: 1000,
        },
      }),
    },
    {
      handle: async () => ({
        accepted: true,
        status: "STARTED",
        message: "Session started.",
        hud: "HUD READY",
      }),
    },
    { writeLine: (message) => output.push(message) },
  );

  const result = await loop.step("start", 1000);

  assert.equal(result.accepted, true);
  assert.equal(result.shouldContinue, true);
  assert.deepEqual(output, ["Session started.", "HUD READY"]);
});

test("prints report when handler returns report", async () => {
  const output = [];

  const loop = new AssistedRuntimeReplLoop(
    {
      parse: () => ({
        status: "PARSED",
        accepted: true,
        message: "parsed",
        command: {
          id: "cmd-report",
          type: "REPORT",
          occurredAtEpochMs: 1000,
        },
      }),
    },
    {
      handle: async () => ({
        accepted: true,
        status: "REPORT_READY",
        message: "Report generated.",
        report: "HUMAN REPORT",
      }),
    },
    { writeLine: (message) => output.push(message) },
  );

  const result = await loop.step("report", 1000);

  assert.equal(result.shouldContinue, true);
  assert.deepEqual(output, ["Report generated.", "HUMAN REPORT"]);
});

test("stops loop after FINISH command", async () => {
  const loop = new AssistedRuntimeReplLoop(
    {
      parse: () => ({
        status: "PARSED",
        accepted: true,
        message: "parsed",
        command: {
          id: "cmd-finish",
          type: "FINISH",
          occurredAtEpochMs: 1000,
        },
      }),
    },
    {
      handle: async () => ({
        accepted: true,
        status: "FINISHED",
        message: "Session finished.",
      }),
    },
    { writeLine: () => undefined },
  );

  const result = await loop.step("finish", 1000);

  assert.equal(result.accepted, true);
  assert.equal(result.shouldContinue, false);
});

test("stops loop after RESET command", async () => {
  const loop = new AssistedRuntimeReplLoop(
    {
      parse: () => ({
        status: "PARSED",
        accepted: true,
        message: "parsed",
        command: {
          id: "cmd-reset",
          type: "RESET",
          occurredAtEpochMs: 1000,
        },
      }),
    },
    {
      handle: async () => ({
        accepted: true,
        status: "RESET",
        message: "Session reset.",
      }),
    },
    { writeLine: () => undefined },
  );

  const result = await loop.step("reset", 1000);

  assert.equal(result.accepted, true);
  assert.equal(result.shouldContinue, false);
});
JS

npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/application/runtime/AssistedRuntimeReplLoop.ts \
  tests/assisted-runtime-repl-loop.test.js \
  install/sprints/run-sprint-076.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 076 assisted runtime repl loop"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 076 completed, merged and pushed successfully =="
