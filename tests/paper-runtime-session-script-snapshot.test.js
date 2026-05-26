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
    timeout: 60000,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync("data/paper-runtime/session-snapshot.json"), true);

  const snapshot = JSON.parse(readFileSync("data/paper-runtime/session-snapshot.json", "utf8"));

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.sessionState, "FINISHED");
  assert.equal(snapshot.gracefulShutdown, true);

  rmSync("data/paper-runtime/session-snapshot.json", { force: true });
});
