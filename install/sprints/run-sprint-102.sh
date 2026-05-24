#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-102-paper-runtime-safe-shutdown-snapshot"
COMMIT_MSG="feat(runtime): add paper runtime safe shutdown snapshot"

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

echo "== Sprint 102: Paper Runtime Safe Shutdown & Session Snapshot =="

git checkout main
git pull origin main
git reset --hard
git clean -fd dist || true

git checkout -B "$BRANCH"

mkdir -p src/application/runtime src/infrastructure/runtime tests scripts

cat > src/application/runtime/PaperRuntimeSessionSnapshot.ts <<'TS'
export type PaperRuntimeSnapshotSessionState =
  | "IDLE"
  | "READY"
  | "RUNNING"
  | "PAUSED"
  | "FINISHED";

export interface PaperRuntimeSessionSnapshot {
  readonly schemaVersion: 1;
  readonly savedAtEpochMs: number;
  readonly sessionState: PaperRuntimeSnapshotSessionState;
  readonly iteration: number;
  readonly lastCommand?: string;
  readonly gracefulShutdown: boolean;
}

export interface PaperRuntimeSessionSnapshotRepository {
  save(snapshot: PaperRuntimeSessionSnapshot): void;
  load(): PaperRuntimeSessionSnapshot | null;
}

/**
 * Builds bounded paper runtime session snapshots.
 *
 * Complexity:
 * - O(1)
 * - Memory O(1)
 */
export class PaperRuntimeSessionSnapshotFactory {
  public create(input: {
    readonly sessionState: PaperRuntimeSnapshotSessionState;
    readonly iteration: number;
    readonly lastCommand?: string;
    readonly gracefulShutdown: boolean;
  }): PaperRuntimeSessionSnapshot {
    if (!Number.isInteger(input.iteration) || input.iteration < 0) {
      throw new Error("Invalid paper runtime snapshot: iteration must be a non-negative integer.");
    }

    return {
      schemaVersion: 1,
      savedAtEpochMs: Date.now(),
      sessionState: input.sessionState,
      iteration: input.iteration,
      lastCommand: input.lastCommand,
      gracefulShutdown: input.gracefulShutdown,
    };
  }
}
TS

cat > src/infrastructure/runtime/JsonPaperRuntimeSessionSnapshotRepository.ts <<'TS'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type {
  PaperRuntimeSessionSnapshot,
  PaperRuntimeSessionSnapshotRepository,
} from "../../application/runtime/PaperRuntimeSessionSnapshot.js";

/**
 * JSON-backed snapshot repository for paper runtime sessions.
 *
 * Complexity:
 * - save: O(1) with bounded snapshot payload.
 * - load: O(1) with bounded snapshot payload.
 */
export class JsonPaperRuntimeSessionSnapshotRepository implements PaperRuntimeSessionSnapshotRepository {
  public constructor(
    private readonly filePath: string,
  ) {}

  public save(snapshot: PaperRuntimeSessionSnapshot): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  }

  public load(): PaperRuntimeSessionSnapshot | null {
    if (!existsSync(this.filePath)) {
      return null;
    }

    const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as unknown;
    return this.validate(parsed);
  }

  private validate(value: unknown): PaperRuntimeSessionSnapshot {
    if (typeof value !== "object" || value === null) {
      throw new Error("Invalid paper runtime snapshot: expected object.");
    }

    const record = value as Record<string, unknown>;

    if (record.schemaVersion !== 1) {
      throw new Error("Invalid paper runtime snapshot: unsupported schemaVersion.");
    }

    if (typeof record.savedAtEpochMs !== "number" || !Number.isFinite(record.savedAtEpochMs)) {
      throw new Error("Invalid paper runtime snapshot: savedAtEpochMs must be finite.");
    }

    if (
      record.sessionState !== "IDLE"
      && record.sessionState !== "READY"
      && record.sessionState !== "RUNNING"
      && record.sessionState !== "PAUSED"
      && record.sessionState !== "FINISHED"
    ) {
      throw new Error("Invalid paper runtime snapshot: sessionState is invalid.");
    }

    if (typeof record.iteration !== "number" || !Number.isInteger(record.iteration) || record.iteration < 0) {
      throw new Error("Invalid paper runtime snapshot: iteration must be a non-negative integer.");
    }

    if (typeof record.gracefulShutdown !== "boolean") {
      throw new Error("Invalid paper runtime snapshot: gracefulShutdown must be boolean.");
    }

    if (record.lastCommand !== undefined && typeof record.lastCommand !== "string") {
      throw new Error("Invalid paper runtime snapshot: lastCommand must be string when present.");
    }

    return record as unknown as PaperRuntimeSessionSnapshot;
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
const {
  PaperRuntimeSessionSnapshotFactory,
} = require("../dist/application/runtime/PaperRuntimeSessionSnapshot.js");
const {
  JsonPaperRuntimeSessionSnapshotRepository,
} = require("../dist/infrastructure/runtime/JsonPaperRuntimeSessionSnapshotRepository.js");

const SNAPSHOT_PATH = "data/paper-runtime/session-snapshot.json";

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

function saveSnapshot(loop, gracefulShutdown) {
  const state = loop.currentState();
  const snapshot = new PaperRuntimeSessionSnapshotFactory().create({
    sessionState: state.sessionState,
    iteration: state.iteration,
    lastCommand: state.lastCommand,
    gracefulShutdown,
  });

  new JsonPaperRuntimeSessionSnapshotRepository(SNAPSHOT_PATH).save(snapshot);
  return snapshot;
}

function main() {
  const loop = createLoop();
  const repository = new JsonPaperRuntimeSessionSnapshotRepository(SNAPSHOT_PATH);
  const previous = repository.load();

  printHelp();

  if (previous !== null) {
    console.log(`Previous snapshot detected: state=${previous.sessionState} graceful=${previous.gracefulShutdown}`);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "paper> ",
  });

  rl.prompt();

  rl.on("line", (line) => {
    const command = line.trim().toLowerCase();

    if (command === "exit" || command === "quit") {
      saveSnapshot(loop, true);
      rl.close();
      return;
    }

    const result = loop.handle(line);
    saveSnapshot(loop, false);
    console.log(result.output);
    rl.prompt();
  });

  rl.on("SIGINT", () => {
    saveSnapshot(loop, false);
    rl.close();
  });

  rl.on("close", () => {
    console.log("RL.SYS paper runtime session closed.");
  });
}

main();
JS

cat > tests/paper-runtime-session-snapshot.test.js <<'JS'
const test = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const {
  PaperRuntimeSessionSnapshotFactory,
} = require("../dist/application/runtime/PaperRuntimeSessionSnapshot.js");
const {
  JsonPaperRuntimeSessionSnapshotRepository,
} = require("../dist/infrastructure/runtime/JsonPaperRuntimeSessionSnapshotRepository.js");

test("creates bounded paper runtime snapshot", () => {
  const snapshot = new PaperRuntimeSessionSnapshotFactory().create({
    sessionState: "RUNNING",
    iteration: 10,
    lastCommand: "start",
    gracefulShutdown: false,
  });

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.sessionState, "RUNNING");
  assert.equal(snapshot.iteration, 10);
});

test("persists and loads paper runtime snapshot", () => {
  const dir = mkdtempSync(join(tmpdir(), "rlsys-paper-snapshot-"));
  const file = join(dir, "snapshot.json");

  try {
    const repository = new JsonPaperRuntimeSessionSnapshotRepository(file);
    const snapshot = new PaperRuntimeSessionSnapshotFactory().create({
      sessionState: "PAUSED",
      iteration: 3,
      lastCommand: "pause",
      gracefulShutdown: true,
    });

    repository.save(snapshot);
    const loaded = repository.load();

    assert.notEqual(loaded, null);
    assert.equal(loaded.sessionState, "PAUSED");
    assert.equal(loaded.gracefulShutdown, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("returns null when snapshot file is absent", () => {
  const dir = mkdtempSync(join(tmpdir(), "rlsys-paper-snapshot-empty-"));
  const file = join(dir, "missing.json");

  try {
    const repository = new JsonPaperRuntimeSessionSnapshotRepository(file);
    assert.equal(repository.load(), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
JS

cat > tests/paper-runtime-session-script-snapshot.test.js <<'JS'
const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { existsSync, readFileSync, rmSync } = require("node:fs");

test("paper runtime session writes snapshot on scripted exit", () => {
  rmSync("data/paper-runtime/session-snapshot.json", { force: true });

  const result = spawnSync("node", [
    "scripts/paper-runtime-session.js",
  ], {
    input: "prepare\nstart\nfinish\nexit\n",
    encoding: "utf8",
    timeout: 5000,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync("data/paper-runtime/session-snapshot.json"), true);

  const snapshot = JSON.parse(readFileSync("data/paper-runtime/session-snapshot.json", "utf8"));

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.sessionState, "FINISHED");
  assert.equal(snapshot.gracefulShutdown, true);

  rmSync("data/paper-runtime/session-snapshot.json", { force: true });
});
JS

npm run check:modules
npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/application/runtime/PaperRuntimeSessionSnapshot.ts \
  src/infrastructure/runtime/JsonPaperRuntimeSessionSnapshotRepository.ts \
  scripts/paper-runtime-session.js \
  tests/paper-runtime-session-snapshot.test.js \
  tests/paper-runtime-session-script-snapshot.test.js \
  install/sprints/run-sprint-102.sh

git commit -m "$COMMIT_MSG"

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 102 paper runtime safe shutdown snapshot"
git push origin main

echo "== Sprint 102 completed, merged and pushed successfully =="
