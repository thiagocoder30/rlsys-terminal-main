const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { readFileSync } = require("node:fs");

test("paper runtime session script exposes interactive commands", () => {
  const source = readFileSync("scripts/paper-runtime-session.js", "utf8");

  assert.match(source, /readline/);
  assert.match(source, /prepare/);
  assert.match(source, /start/);
  assert.match(source, /finish/);
});

test("paper runtime session processes scripted stdin", () => {
  const result = spawnSync("node", [
    "scripts/paper-runtime-session.js",
  ], {
    input: "prepare\nstart\npause\nresume\nstatus\nfinish\nexit\n",
    encoding: "utf8",
    timeout: 5000,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /RL\.SYS PAPER RUNTIME SESSION/);
  assert.match(result.stdout, /PAPER READY/);
  assert.match(result.stdout, /SESSION_STARTED/);
  assert.match(result.stdout, /SESSION_PAUSED/);
  assert.match(result.stdout, /SESSION_RESUMED/);
  assert.match(result.stdout, /SESSION_FINISHED/);
});
