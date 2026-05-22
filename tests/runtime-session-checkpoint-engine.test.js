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
