#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-077-assisted-runtime-readline-adapter"
COMMIT_MSG="feat(runtime): add assisted runtime readline adapter"

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

echo "== Sprint 077: Assisted Runtime Node Readline Adapter =="
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

mkdir -p src/infrastructure/runtime
mkdir -p tests

cat > src/infrastructure/runtime/NodeReadlineAssistedRuntimeAdapter.ts <<'TS'
export interface AssistedRuntimeStepResult {
  readonly shouldContinue: boolean;
  readonly message: string;
}

export interface AssistedRuntimeStepPort {
  step(input: string, occurredAtEpochMs?: number): Promise<AssistedRuntimeStepResult>;
}

export interface RuntimeLineReaderPort {
  question(prompt: string): Promise<string>;
  close(): void;
}

export interface RuntimeLineWriterPort {
  writeLine(message: string): void;
}

export interface NodeReadlineAssistedRuntimeAdapterOptions {
  readonly prompt: string;
  readonly welcomeMessage?: string;
  readonly shutdownMessage?: string;
  readonly maxSteps?: number;
}

/**
 * Infrastructure adapter that connects a line-based terminal interface to the
 * assisted runtime REPL step executor.
 *
 * It stays outside the domain/application rules and depends only on ports.
 *
 * Complexity:
 * - O(s * n), where s is processed lines and n is line length.
 * - Memory O(1), no unbounded buffering.
 */
export class NodeReadlineAssistedRuntimeAdapter {
  private readonly prompt: string;
  private readonly welcomeMessage: string;
  private readonly shutdownMessage: string;
  private readonly maxSteps: number;

  public constructor(
    private readonly reader: RuntimeLineReaderPort,
    private readonly writer: RuntimeLineWriterPort,
    private readonly runtime: AssistedRuntimeStepPort,
    options: NodeReadlineAssistedRuntimeAdapterOptions,
  ) {
    this.prompt = options.prompt;
    this.welcomeMessage = options.welcomeMessage ?? "RL.SYS assisted runtime started.";
    this.shutdownMessage = options.shutdownMessage ?? "RL.SYS assisted runtime stopped.";
    this.maxSteps = options.maxSteps ?? 10_000;
  }

  public async run(): Promise<void> {
    this.writer.writeLine(this.welcomeMessage);

    let shouldContinue = true;
    let steps = 0;

    try {
      while (shouldContinue && steps < this.maxSteps) {
        steps += 1;

        const input = await this.reader.question(this.prompt);
        const result = await this.runtime.step(input, Date.now());

        shouldContinue = result.shouldContinue;
      }

      if (steps >= this.maxSteps) {
        this.writer.writeLine("Runtime stopped because maxSteps safety limit was reached.");
      }
    } finally {
      this.reader.close();
      this.writer.writeLine(this.shutdownMessage);
    }
  }
}
TS

cat > tests/node-readline-assisted-runtime-adapter.test.js <<'JS'
import test from "node:test";
import assert from "node:assert/strict";
import { NodeReadlineAssistedRuntimeAdapter } from "../dist/infrastructure/runtime/NodeReadlineAssistedRuntimeAdapter.js";

class MemoryReader {
  constructor(lines) {
    this.lines = [...lines];
    this.closed = false;
  }

  async question() {
    const next = this.lines.shift();

    if (next === undefined) {
      return "finish";
    }

    return next;
  }

  close() {
    this.closed = true;
  }
}

test("runs terminal loop until runtime requests stop", async () => {
  const reader = new MemoryReader(["start", "finish"]);
  const output = [];
  const handled = [];

  const adapter = new NodeReadlineAssistedRuntimeAdapter(
    reader,
    { writeLine: (message) => output.push(message) },
    {
      step: async (input) => {
        handled.push(input);

        return {
          shouldContinue: input !== "finish",
          message: "handled",
        };
      },
    },
    {
      prompt: "rlsys> ",
      welcomeMessage: "welcome",
      shutdownMessage: "bye",
    },
  );

  await adapter.run();

  assert.deepEqual(handled, ["start", "finish"]);
  assert.equal(reader.closed, true);
  assert.deepEqual(output, ["welcome", "bye"]);
});

test("closes reader even when runtime step fails", async () => {
  const reader = new MemoryReader(["start"]);
  const output = [];

  const adapter = new NodeReadlineAssistedRuntimeAdapter(
    reader,
    { writeLine: (message) => output.push(message) },
    {
      step: async () => {
        throw new Error("runtime failure");
      },
    },
    {
      prompt: "rlsys> ",
      welcomeMessage: "welcome",
      shutdownMessage: "bye",
    },
  );

  await assert.rejects(() => adapter.run(), /runtime failure/);

  assert.equal(reader.closed, true);
  assert.deepEqual(output, ["welcome", "bye"]);
});

test("stops at maxSteps safety limit", async () => {
  const reader = new MemoryReader(["start", "start", "start"]);
  const output = [];
  let calls = 0;

  const adapter = new NodeReadlineAssistedRuntimeAdapter(
    reader,
    { writeLine: (message) => output.push(message) },
    {
      step: async () => {
        calls += 1;

        return {
          shouldContinue: true,
          message: "handled",
        };
      },
    },
    {
      prompt: "rlsys> ",
      welcomeMessage: "welcome",
      shutdownMessage: "bye",
      maxSteps: 2,
    },
  );

  await adapter.run();

  assert.equal(calls, 2);
  assert.equal(output.includes("Runtime stopped because maxSteps safety limit was reached."), true);
  assert.equal(reader.closed, true);
});
JS

npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/infrastructure/runtime/NodeReadlineAssistedRuntimeAdapter.ts \
  tests/node-readline-assisted-runtime-adapter.test.js \
  install/sprints/run-sprint-077.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 077 assisted runtime readline adapter"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 077 completed, merged and pushed successfully =="
