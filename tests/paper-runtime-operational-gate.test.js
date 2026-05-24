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

test("allows certified supervised paper operation", () => {
  const result = new PaperRuntimeOperationalGate().evaluate(input());

  assert.equal(result.decision, "ALLOW_PAPER_OPERATION");
  assert.equal(result.allowed, true);
});

test("blocks failed endurance", () => {
  const result = new PaperRuntimeOperationalGate().evaluate(input({
    enduranceStatus: "FAILED",
  }));

  assert.equal(result.decision, "BLOCK_PAPER_OPERATION");
});

test("blocks missing endurance data", () => {
  const result = new PaperRuntimeOperationalGate().evaluate(input({
    enduranceStatus: "NO_DATA",
  }));

  assert.equal(result.decision, "BLOCK_PAPER_OPERATION");
});

test("blocks blocked risk readiness", () => {
  const result = new PaperRuntimeOperationalGate().evaluate(input({
    riskReadiness: "BLOCKED",
  }));

  assert.equal(result.decision, "BLOCK_PAPER_OPERATION");
});

test("blocks idle session", () => {
  const result = new PaperRuntimeOperationalGate().evaluate(input({
    sessionState: "IDLE",
  }));

  assert.equal(result.decision, "BLOCK_PAPER_OPERATION");
});

test("blocks finished session", () => {
  const result = new PaperRuntimeOperationalGate().evaluate(input({
    sessionState: "FINISHED",
  }));

  assert.equal(result.decision, "BLOCK_PAPER_OPERATION");
});

test("requires supervision when operator is unsupervised", () => {
  const result = new PaperRuntimeOperationalGate().evaluate(input({
    operatorMode: "UNSUPERVISED",
  }));

  assert.equal(result.decision, "REQUIRE_SUPERVISION");
});

test("requires supervision on endurance warning", () => {
  const result = new PaperRuntimeOperationalGate().evaluate(input({
    enduranceStatus: "WARNING",
  }));

  assert.equal(result.decision, "REQUIRE_SUPERVISION");
});

test("allows paused session when operator is supervised", () => {
  const result = new PaperRuntimeOperationalGate().evaluate(input({
    sessionState: "PAUSED",
    operatorMode: "SUPERVISED",
  }));

  assert.equal(result.decision, "ALLOW_PAPER_OPERATION");
});
