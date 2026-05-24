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

test("prepare command does not render operation gate as blocked", () => {
  const supervisor = new PaperRuntimeSessionSupervisor(
    new PaperRuntimeOperationalGate(),
  );

  const hud = new PaperRuntimeHudGateComposer();

  const result = supervisor.supervise({
    enduranceStatus: "CERTIFIED",
    riskReadiness: "READY",
    sessionState: "IDLE",
    operatorMode: "SUPERVISED",
    commandIntent: "PREPARE",
  });

  const rendered = hud.compose(result, {
    compact: true,
  });

  assert.equal(result.decision, "SESSION_PREPARED");
  assert.equal(result.allowed, true);
  assert.equal(result.gate.decision, "ALLOW_PAPER_OPERATION");
  assert.doesNotMatch(rendered.text, /gate=BLOCK_PAPER_OPERATION/);
  assert.match(rendered.text, /PAPER READY/);
});
