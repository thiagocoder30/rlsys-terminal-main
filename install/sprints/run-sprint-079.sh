#!/usr/bin/env bash
set -euo pipefail

BRANCH="sprint-079-runtime-session-checkpoint-engine"
COMMIT_MSG="feat(runtime): add session checkpoint engine"

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

echo "== Sprint 079: Runtime Session Checkpoint Engine =="
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

cat > src/application/runtime/RuntimeSessionCheckpointEngine.ts <<'TS'
export type RuntimeCheckpointReason =
  | "COMMAND_PROCESSED"
  | "TIME_INTERVAL"
  | "MANUAL"
  | "SESSION_FINISH"
  | "RECOVERY_POINT";

export interface RuntimeSessionCheckpointRequest {
  readonly commandId?: string;
  readonly reason: RuntimeCheckpointReason;
  readonly occurredAtEpochMs: number;
  readonly force?: boolean;
}

export interface RuntimeSessionCheckpointRecord {
  readonly checkpointId: string;
  readonly reason: RuntimeCheckpointReason;
  readonly commandId?: string;
  readonly createdAtEpochMs: number;
  readonly sequence: number;
}

export interface RuntimeSessionCheckpointRepositoryPort {
  saveCheckpoint(record: RuntimeSessionCheckpointRecord): Promise<void>;
}

export interface RuntimeSessionCheckpointResult {
  readonly saved: boolean;
  readonly status: "CHECKPOINT_SAVED" | "CHECKPOINT_SKIPPED";
  readonly message: string;
  readonly checkpoint?: RuntimeSessionCheckpointRecord;
}

/**
 * Decides and persists assisted runtime session checkpoints.
 *
 * Design:
 * - idempotent by command id;
 * - bounded in-memory command tracking;
 * - interval-based checkpoint throttling;
 * - force checkpoint support for manual/recovery/finish.
 *
 * Complexity:
 * - O(1) common path.
 * - O(k) only during bounded compaction, where k = maxTrackedCommandIds.
 * - Memory O(k).
 */
export class RuntimeSessionCheckpointEngine {
  private readonly checkpointIntervalMs: number;
  private readonly maxTrackedCommandIds: number;
  private readonly processedCommandIds: Set<string> = new Set<string>();
  private lastCheckpointAtEpochMs = 0;
  private sequence = 0;

  public constructor(
    private readonly repository: RuntimeSessionCheckpointRepositoryPort,
    options: {
      readonly checkpointIntervalMs?: number;
      readonly maxTrackedCommandIds?: number;
    } = {},
  ) {
    this.checkpointIntervalMs = options.checkpointIntervalMs ?? 30_000;
    this.maxTrackedCommandIds = options.maxTrackedCommandIds ?? 512;
  }

  public async checkpoint(
    request: RuntimeSessionCheckpointRequest,
  ): Promise<RuntimeSessionCheckpointResult> {
    this.validateRequest(request);

    if (this.isDuplicateCommand(request)) {
      return {
        saved: false,
        status: "CHECKPOINT_SKIPPED",
        message: "Checkpoint skipped because command was already checkpointed.",
      };
    }

    if (!this.shouldCheckpoint(request)) {
      return {
        saved: false,
        status: "CHECKPOINT_SKIPPED",
        message: "Checkpoint skipped by interval policy.",
      };
    }

    this.sequence += 1;

    const record: RuntimeSessionCheckpointRecord = {
      checkpointId: this.createCheckpointId(request, this.sequence),
      reason: request.reason,
      commandId: request.commandId,
      createdAtEpochMs: request.occurredAtEpochMs,
      sequence: this.sequence,
    };

    await this.repository.saveCheckpoint(record);

    this.lastCheckpointAtEpochMs = request.occurredAtEpochMs;
    this.rememberCommand(request.commandId);

    return {
      saved: true,
      status: "CHECKPOINT_SAVED",
      message: "Runtime session checkpoint saved.",
      checkpoint: record,
    };
  }

  private shouldCheckpoint(request: RuntimeSessionCheckpointRequest): boolean {
    if (request.force === true) {
      return true;
    }

    if (
      request.reason === "MANUAL"
      || request.reason === "SESSION_FINISH"
      || request.reason === "RECOVERY_POINT"
    ) {
      return true;
    }

    if (this.lastCheckpointAtEpochMs === 0) {
      return true;
    }

    return request.occurredAtEpochMs - this.lastCheckpointAtEpochMs >= this.checkpointIntervalMs;
  }

  private isDuplicateCommand(request: RuntimeSessionCheckpointRequest): boolean {
    return request.commandId !== undefined && this.processedCommandIds.has(request.commandId);
  }

  private rememberCommand(commandId: string | undefined): void {
    if (commandId === undefined) {
      return;
    }

    this.processedCommandIds.add(commandId);

    if (this.processedCommandIds.size <= this.maxTrackedCommandIds) {
      return;
    }

    const compacted = Array.from(this.processedCommandIds).slice(
      this.processedCommandIds.size - this.maxTrackedCommandIds,
    );

    this.processedCommandIds.clear();

    for (const id of compacted) {
      this.processedCommandIds.add(id);
    }
  }

  private validateRequest(request: RuntimeSessionCheckpointRequest): void {
    if (!Number.isFinite(request.occurredAtEpochMs) || request.occurredAtEpochMs <= 0) {
      throw new Error("Invalid checkpoint request: occurredAtEpochMs must be positive and finite.");
    }

    if (request.commandId !== undefined && request.commandId.trim().length === 0) {
      throw new Error("Invalid checkpoint request: commandId cannot be empty.");
    }
  }

  private createCheckpointId(request: RuntimeSessionCheckpointRequest, sequence: number): string {
    const commandPart = request.commandId ?? "no-command";
    return `checkpoint-${sequence}-${request.reason}-${request.occurredAtEpochMs}-${this.hash(commandPart)}`;
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

cat > tests/runtime-session-checkpoint-engine.test.js <<'JS'
import test from "node:test";
import assert from "node:assert/strict";
import { RuntimeSessionCheckpointEngine } from "../dist/application/runtime/RuntimeSessionCheckpointEngine.js";

class MemoryCheckpointRepository {
  constructor() {
    this.records = [];
  }

  async saveCheckpoint(record) {
    this.records.push(record);
  }
}

test("saves first command checkpoint", async () => {
  const repository = new MemoryCheckpointRepository();
  const engine = new RuntimeSessionCheckpointEngine(repository);

  const result = await engine.checkpoint({
    commandId: "cmd-1",
    reason: "COMMAND_PROCESSED",
    occurredAtEpochMs: 1000,
  });

  assert.equal(result.saved, true);
  assert.equal(result.status, "CHECKPOINT_SAVED");
  assert.equal(repository.records.length, 1);
  assert.equal(repository.records[0].sequence, 1);
});

test("skips duplicate command checkpoint idempotently", async () => {
  const repository = new MemoryCheckpointRepository();
  const engine = new RuntimeSessionCheckpointEngine(repository);

  await engine.checkpoint({
    commandId: "cmd-1",
    reason: "COMMAND_PROCESSED",
    occurredAtEpochMs: 1000,
  });

  const replay = await engine.checkpoint({
    commandId: "cmd-1",
    reason: "COMMAND_PROCESSED",
    occurredAtEpochMs: 2000,
  });

  assert.equal(replay.saved, false);
  assert.equal(replay.status, "CHECKPOINT_SKIPPED");
  assert.equal(repository.records.length, 1);
});

test("skips interval checkpoint when interval has not elapsed", async () => {
  const repository = new MemoryCheckpointRepository();
  const engine = new RuntimeSessionCheckpointEngine(repository, {
    checkpointIntervalMs: 5000,
  });

  await engine.checkpoint({
    commandId: "cmd-1",
    reason: "COMMAND_PROCESSED",
    occurredAtEpochMs: 1000,
  });

  const result = await engine.checkpoint({
    commandId: "cmd-2",
    reason: "TIME_INTERVAL",
    occurredAtEpochMs: 3000,
  });

  assert.equal(result.saved, false);
  assert.equal(repository.records.length, 1);
});

test("saves interval checkpoint when interval elapsed", async () => {
  const repository = new MemoryCheckpointRepository();
  const engine = new RuntimeSessionCheckpointEngine(repository, {
    checkpointIntervalMs: 5000,
  });

  await engine.checkpoint({
    commandId: "cmd-1",
    reason: "COMMAND_PROCESSED",
    occurredAtEpochMs: 1000,
  });

  const result = await engine.checkpoint({
    commandId: "cmd-2",
    reason: "TIME_INTERVAL",
    occurredAtEpochMs: 7000,
  });

  assert.equal(result.saved, true);
  assert.equal(repository.records.length, 2);
});

test("always saves manual checkpoint", async () => {
  const repository = new MemoryCheckpointRepository();
  const engine = new RuntimeSessionCheckpointEngine(repository, {
    checkpointIntervalMs: 5000,
  });

  await engine.checkpoint({
    commandId: "cmd-1",
    reason: "COMMAND_PROCESSED",
    occurredAtEpochMs: 1000,
  });

  const result = await engine.checkpoint({
    reason: "MANUAL",
    occurredAtEpochMs: 1100,
  });

  assert.equal(result.saved, true);
  assert.equal(repository.records.length, 2);
});

test("always saves session finish checkpoint", async () => {
  const repository = new MemoryCheckpointRepository();
  const engine = new RuntimeSessionCheckpointEngine(repository);

  const result = await engine.checkpoint({
    reason: "SESSION_FINISH",
    occurredAtEpochMs: 1000,
  });

  assert.equal(result.saved, true);
  assert.equal(repository.records[0].reason, "SESSION_FINISH");
});

test("rejects invalid timestamp", async () => {
  const repository = new MemoryCheckpointRepository();
  const engine = new RuntimeSessionCheckpointEngine(repository);

  await assert.rejects(
    () => engine.checkpoint({
      reason: "MANUAL",
      occurredAtEpochMs: Number.NaN,
    }),
    /occurredAtEpochMs/,
  );
});

test("rejects empty command id", async () => {
  const repository = new MemoryCheckpointRepository();
  const engine = new RuntimeSessionCheckpointEngine(repository);

  await assert.rejects(
    () => engine.checkpoint({
      commandId: "   ",
      reason: "COMMAND_PROCESSED",
      occurredAtEpochMs: 1000,
    }),
    /commandId/,
  );
});
JS

npm run build
npm test

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git add \
  src/application/runtime/RuntimeSessionCheckpointEngine.ts \
  tests/runtime-session-checkpoint-engine.test.js \
  install/sprints/run-sprint-079.sh

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "$COMMIT_MSG"
fi

git checkout main
git merge --no-ff "$BRANCH" -m "merge: sprint 079 runtime session checkpoint engine"

git restore --worktree --staged dist 2>/dev/null || true
git clean -fd dist || true

git push origin main

echo "== Sprint 079 completed, merged and pushed successfully =="
