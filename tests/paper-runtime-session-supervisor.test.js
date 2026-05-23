const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PaperRuntimeOperationalGate,
} = require("../dist/application/runtime/PaperRuntimeOperationalGate.js");
const {
  PaperRuntimeSessionSupervisor,
} = require("../dist/application/runtime/PaperRuntimeSessionSupervisor.js");

function input(overrides = {}) {
  return {
    enduranceStatus: "CERTIFIED",
    riskReadiness: "READY",
    sessionState: "READY",
    operatorMode: "SUPERVISED",
    commandIntent: "START",
    ...overrides,
  };
}

test("prepares paper session when endurance is acceptable", () => {
  const supervisor = new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate());

  const result = supervisor.supervise(input({
    sessionState: "IDLE",
    commandIntent: "PREPARE",
  }));

  assert.equal(result.decision, "SESSION_PREPARED");
  assert.equal(result.allowed, true);
  assert.equal(result.nextSessionState, "READY");
});

test("blocks prepare when endurance has no data", () => {
  const supervisor = new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate());

  const result = supervisor.supervise(input({
    enduranceStatus: "NO_DATA",
    sessionState: "IDLE",
    commandIntent: "PREPARE",
  }));

  assert.equal(result.decision, "COMMAND_BLOCKED");
  assert.equal(result.allowed, false);
});

test("starts paper session when gate allows operation", () => {
  const supervisor = new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate());

  const result = supervisor.supervise(input({
    commandIntent: "START",
  }));

  assert.equal(result.decision, "SESSION_STARTED");
  assert.equal(result.allowed, true);
  assert.equal(result.nextSessionState, "RUNNING");
});

test("requires supervision when gate requires supervision", () => {
  const supervisor = new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate());

  const result = supervisor.supervise(input({
    commandIntent: "START",
    operatorMode: "UNSUPERVISED",
  }));

  assert.equal(result.decision, "SUPERVISION_REQUIRED");
  assert.equal(result.allowed, false);
});

test("blocks start when risk readiness is blocked", () => {
  const supervisor = new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate());

  const result = supervisor.supervise(input({
    commandIntent: "START",
    riskReadiness: "BLOCKED",
  }));

  assert.equal(result.decision, "COMMAND_BLOCKED");
  assert.equal(result.allowed, false);
});

test("pauses a running paper session", () => {
  const supervisor = new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate());

  const result = supervisor.supervise(input({
    commandIntent: "PAUSE",
    sessionState: "RUNNING",
  }));

  assert.equal(result.decision, "SESSION_PAUSED");
  assert.equal(result.nextSessionState, "PAUSED");
});

test("blocks pause when session is not running", () => {
  const supervisor = new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate());

  const result = supervisor.supervise(input({
    commandIntent: "PAUSE",
    sessionState: "READY",
  }));

  assert.equal(result.decision, "COMMAND_BLOCKED");
});

test("resumes paused session only through operational gate", () => {
  const supervisor = new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate());

  const result = supervisor.supervise(input({
    commandIntent: "RESUME",
    sessionState: "READY",
  }));

  assert.equal(result.decision, "SESSION_RESUMED");
  assert.equal(result.nextSessionState, "RUNNING");
});

test("finishes paper session regardless of gate state", () => {
  const supervisor = new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate());

  const result = supervisor.supervise(input({
    commandIntent: "FINISH",
    riskReadiness: "BLOCKED",
  }));

  assert.equal(result.decision, "SESSION_FINISHED");
  assert.equal(result.allowed, true);
  assert.equal(result.nextSessionState, "FINISHED");
});

test("reports status without changing session state", () => {
  const supervisor = new PaperRuntimeSessionSupervisor(new PaperRuntimeOperationalGate());

  const result = supervisor.supervise(input({
    commandIntent: "STATUS",
    sessionState: "PAUSED",
  }));

  assert.equal(result.decision, "STATUS_REPORTED");
  assert.equal(result.allowed, true);
  assert.equal(result.nextSessionState, "PAUSED");
});
