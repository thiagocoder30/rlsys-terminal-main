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
const {
  PaperRuntimeInteractiveLoop,
} = require("../dist/application/runtime/PaperRuntimeInteractiveLoop.js");

function createLoop() {
  return new PaperRuntimeInteractiveLoop(
    new PaperRuntimeReplCommandAdapter(
      new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate()),
      new PaperRuntimeHudGateComposer(),
    ),
  );
}

test("paper runtime loop transitions through supervised lifecycle", () => {
  const loop = createLoop();

  assert.equal(loop.currentState().sessionState, "IDLE");
  assert.equal(loop.handle("prepare").state.sessionState, "READY");
  assert.equal(loop.handle("start").state.sessionState, "RUNNING");
  assert.equal(loop.handle("pause").state.sessionState, "PAUSED");
  assert.equal(loop.handle("resume").state.sessionState, "RUNNING");
  assert.equal(loop.handle("finish").state.sessionState, "FINISHED");
});

test("paper runtime loop rejects invalid commands without state corruption", () => {
  const loop = createLoop();

  const result = loop.handle("explode");

  assert.equal(result.accepted, false);
  assert.equal(result.state.sessionState, "IDLE");
  assert.match(result.output, /Unknown/);
});

test("paper runtime loop maintains bounded state", () => {
  const loop = createLoop();

  for (let index = 0; index < 1000; index += 1) {
    loop.handle("status");
  }

  assert.equal(loop.currentState().iteration, 1000);
});
