const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PaperRuntimeOperationalGate,
} = require("../dist/application/runtime/PaperRuntimeOperationalGate.js");

function input(overrides = {}) {
  return {
    enduranceStatus: "CERTIFIED",
    riskReadiness: "READY",
    sessionState: "READY",
    operatorMode: "SUPERVISED",
    ...overrides,
  };
}

test("allows paper operation when runtime is certified and supervised", () => {
  const gate = new PaperRuntimeOperationalGate();

  const result = gate.evaluate(input());

  assert.equal(result.decision, "ALLOW_PAPER_OPERATION");
  assert.equal(result.allowed, true);
});

test("blocks paper operation when endurance failed", () => {
  const gate = new PaperRuntimeOperationalGate();

  const result = gate.evaluate(input({
    enduranceStatus: "FAILED",
  }));

  assert.equal(result.decision, "BLOCK_PAPER_OPERATION");
  assert.equal(result.allowed, false);
  assert.match(result.reasons.join(" "), /Endurance/);
});

test("blocks paper operation when endurance has no data", () => {
  const gate = new PaperRuntimeOperationalGate();

  const result = gate.evaluate(input({
    enduranceStatus: "NO_DATA",
  }));

  assert.equal(result.decision, "BLOCK_PAPER_OPERATION");
  assert.equal(result.allowed, false);
});

test("blocks paper operation when risk readiness is blocked", () => {
  const gate = new PaperRuntimeOperationalGate();

  const result = gate.evaluate(input({
    riskReadiness: "BLOCKED",
  }));

  assert.equal(result.decision, "BLOCK_PAPER_OPERATION");
  assert.match(result.reasons.join(" "), /Risk readiness/);
});

test("requires supervision when endurance has warning", () => {
  const gate = new PaperRuntimeOperationalGate();

  const result = gate.evaluate(input({
    enduranceStatus: "WARNING",
  }));

  assert.equal(result.decision, "REQUIRE_SUPERVISION");
  assert.equal(result.allowed, false);
});

test("requires supervision when operator is unsupervised", () => {
  const gate = new PaperRuntimeOperationalGate();

  const result = gate.evaluate(input({
    operatorMode: "UNSUPERVISED",
  }));

  assert.equal(result.decision, "REQUIRE_SUPERVISION");
});

test("requires supervision when session is paused", () => {
  const gate = new PaperRuntimeOperationalGate();

  const result = gate.evaluate(input({
    sessionState: "PAUSED",
  }));

  assert.equal(result.decision, "REQUIRE_SUPERVISION");
});

test("blocks paper operation when session is finished", () => {
  const gate = new PaperRuntimeOperationalGate();

  const result = gate.evaluate(input({
    sessionState: "FINISHED",
  }));

  assert.equal(result.decision, "BLOCK_PAPER_OPERATION");
});

test("blocks paper operation when session is idle", () => {
  const gate = new PaperRuntimeOperationalGate();

  const result = gate.evaluate(input({
    sessionState: "IDLE",
  }));

  assert.equal(result.decision, "BLOCK_PAPER_OPERATION");
});
