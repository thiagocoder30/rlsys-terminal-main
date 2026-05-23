const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PaperRuntimeHudGateComposer,
} = require("../dist/application/runtime/PaperRuntimeHudGateComposer.js");

function supervisorResult(overrides = {}) {
  return {
    decision: "SESSION_STARTED",
    allowed: true,
    nextSessionState: "RUNNING",
    gate: {
      decision: "ALLOW_PAPER_OPERATION",
      allowed: true,
      reasons: ["ok"],
    },
    messages: ["Paper runtime session is supervised and operational."],
    ...overrides,
  };
}

test("renders ready paper runtime hud", () => {
  const composer = new PaperRuntimeHudGateComposer();

  const hud = composer.compose(supervisorResult(), { width: 76 });

  assert.equal(hud.status, "READY");
  assert.match(hud.text, /PAPER OPERATIONAL HUD/);
  assert.match(hud.text, /SESSION_STARTED/);
  assert.match(hud.text, /Allowed\s+: YES/);
});

test("renders compact paper runtime hud", () => {
  const composer = new PaperRuntimeHudGateComposer();

  const hud = composer.compose(supervisorResult(), { compact: true });

  assert.equal(hud.lineCount, 3);
  assert.equal(hud.status, "READY");
  assert.match(hud.text, /PAPER READY/);
  assert.match(hud.text, /allowed=YES/);
});

test("renders blocked status when supervisor denies command", () => {
  const composer = new PaperRuntimeHudGateComposer();

  const hud = composer.compose(supervisorResult({
    decision: "COMMAND_BLOCKED",
    allowed: false,
    nextSessionState: "READY",
    gate: {
      decision: "BLOCK_PAPER_OPERATION",
      allowed: false,
      reasons: ["Risk readiness is blocked."],
    },
    messages: ["Paper operation is blocked by operational gate."],
  }));

  assert.equal(hud.status, "BLOCKED");
  assert.match(hud.text, /COMMAND_BLOCKED/);
  assert.match(hud.text, /Guidance/);
});

test("renders supervision required status", () => {
  const composer = new PaperRuntimeHudGateComposer();

  const hud = composer.compose(supervisorResult({
    decision: "SUPERVISION_REQUIRED",
    allowed: false,
    nextSessionState: "READY",
    gate: {
      decision: "REQUIRE_SUPERVISION",
      allowed: false,
      reasons: ["Paper operation requires active human supervision."],
    },
    messages: ["Paper operation requires active human supervision."],
  }));

  assert.equal(hud.status, "SUPERVISION_REQUIRED");
  assert.match(hud.text, /SUPERVISION_REQUIRED/);
});

test("truncates long guidance lines safely", () => {
  const composer = new PaperRuntimeHudGateComposer();

  const hud = composer.compose(supervisorResult({
    messages: [
      "This is a very long guidance message that must be truncated safely to preserve terminal layout on small mobile screens.",
    ],
  }), { width: 58 });

  const lines = hud.text.split("\n");

  assert.equal(lines.every((line) => line.length <= 58), true);
});
