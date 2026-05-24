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
