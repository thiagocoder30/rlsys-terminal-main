const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { existsSync, readFileSync, rmSync, mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

test("paper runtime session writes snapshot on scripted exit", () => {
  const dir = mkdtempSync(join(tmpdir(), "rlsys-paper-runtime-snapshot-"));
  const snapshotPath = join(dir, "session-snapshot.json");
  rmSync(snapshotPath, { force: true });

  const result = spawnSync("node", [
    "scripts/paper-runtime-session.js",
  ], {
    input: "prepare\nstart\nfinish\nexit\n",
    encoding: "utf8",
    timeout: 60000,
    env: {
      ...process.env,
      RLSYS_PAPER_RUNTIME_SNAPSHOT_PATH: snapshotPath,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(snapshotPath), true);

  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.sessionState, "FINISHED");
  assert.equal(snapshot.gracefulShutdown, true);

  rmSync(dir, { recursive: true, force: true });
});
