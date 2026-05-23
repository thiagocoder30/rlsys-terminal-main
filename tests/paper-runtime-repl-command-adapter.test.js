const test = require("node:test");
const assert = require("node:assert/strict");
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

function adapter() {
  return new PaperRuntimeReplCommandAdapter(
    new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate()),
    new PaperRuntimeHudGateComposer(),
  );
}

function context(overrides = {}) {
  return {
    enduranceStatus: "CERTIFIED",
    riskReadiness: "READY",
    sessionState: "READY",
    operatorMode: "SUPERVISED",
    ...overrides,
  };
}

test("maps prepare command to supervised preparation", () => {
  const result = adapter().handle("prepare", context({
    sessionState: "IDLE",
  }));

  assert.equal(result.accepted, true);
  assert.equal(result.intent, "PREPARE");
  assert.equal(result.supervisorResult.decision, "SESSION_PREPARED");
  assert.match(result.hud.text, /PAPER READY/);
});

test("maps start command to session start", () => {
  const result = adapter().handle("start", context());

  assert.equal(result.accepted, true);
  assert.equal(result.intent, "START");
  assert.equal(result.supervisorResult.decision, "SESSION_STARTED");
});

test("maps pause command to session pause", () => {
  const result = adapter().handle("pause", context({
    sessionState: "RUNNING",
  }));

  assert.equal(result.accepted, true);
  assert.equal(result.intent, "PAUSE");
  assert.equal(result.supervisorResult.decision, "SESSION_PAUSED");
});

test("maps resume command to session resume", () => {
  const result = adapter().handle("resume", context({
    sessionState: "READY",
  }));

  assert.equal(result.accepted, true);
  assert.equal(result.intent, "RESUME");
  assert.equal(result.supervisorResult.nextSessionState, "RUNNING");
});

test("maps stop alias to finish", () => {
  const result = adapter().handle("stop", context({
    sessionState: "RUNNING",
  }));

  assert.equal(result.accepted, true);
  assert.equal(result.intent, "FINISH");
  assert.equal(result.supervisorResult.decision, "SESSION_FINISHED");
});

test("returns status hud without changing state", () => {
  const result = adapter().handle("status", context({
    sessionState: "PAUSED",
  }));

  assert.equal(result.accepted, true);
  assert.equal(result.intent, "STATUS");
  assert.equal(result.supervisorResult.nextSessionState, "PAUSED");
  assert.match(result.hud.text, /PAPER READY/);
});

test("rejects unknown command", () => {
  const result = adapter().handle("bet now", context());

  assert.equal(result.accepted, false);
  assert.match(result.message, /Unknown/);
});

test("rejects empty command", () => {
  const result = adapter().handle("   ", context());

  assert.equal(result.accepted, false);
  assert.match(result.message, /Empty/);
});

test("returns blocked hud when risk blocks operation", () => {
  const result = adapter().handle("start", context({
    riskReadiness: "BLOCKED",
  }));

  assert.equal(result.accepted, true);
  assert.equal(result.supervisorResult.decision, "COMMAND_BLOCKED");
  assert.equal(result.hud.status, "BLOCKED");
  assert.match(result.hud.text, /PAPER BLOCKED/);
});
