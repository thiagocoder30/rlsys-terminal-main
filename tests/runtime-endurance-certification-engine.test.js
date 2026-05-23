const test = require("node:test");
const assert = require("node:assert/strict");
const { RuntimeEnduranceCertificationEngine } = require("../dist/application/runtime/RuntimeEnduranceCertificationEngine.js");

function policy() {
  return {
    minimumIterations: 1000,
    minimumDurationMs: 1000,
    maxHeapDriftBytes: 10_000,
    maxPeakEventLoopLagMs: 100,
    maxPressureViolations: 0,
    warningHeapDriftRatio: 0.8,
    warningLagRatio: 0.8,
  };
}

function report(overrides = {}) {
  return {
    generatedAtEpochMs: 10000,
    durationMs: 2000,
    result: {
      stable: true,
      iterations: 2000,
      heapDriftBytes: 1000,
      peakEventLoopLagMs: 10,
      pressureViolations: 0,
      ...overrides,
    },
  };
}

test("certifies healthy endurance report", () => {
  const engine = new RuntimeEnduranceCertificationEngine();

  const result = engine.certify(report(), policy());

  assert.equal(result.status, "CERTIFIED");
  assert.equal(result.certified, true);
  assert.equal(result.score, 100);
});

test("fails unstable soak report", () => {
  const engine = new RuntimeEnduranceCertificationEngine();

  const result = engine.certify(report({ stable: false }), policy());

  assert.equal(result.status, "FAILED");
  assert.equal(result.certified, false);
  assert.match(result.reasons.join(" "), /not stable/);
});

test("fails when iterations are insufficient", () => {
  const engine = new RuntimeEnduranceCertificationEngine();

  const result = engine.certify(report({ iterations: 500 }), policy());

  assert.equal(result.status, "FAILED");
  assert.match(result.reasons.join(" "), /fewer iterations/);
});

test("warns when heap drift is close to limit", () => {
  const engine = new RuntimeEnduranceCertificationEngine();

  const result = engine.certify(report({ heapDriftBytes: 8500 }), policy());

  assert.equal(result.status, "WARNING");
  assert.equal(result.certified, false);
  assert.match(result.reasons.join(" "), /Heap drift is close/);
});

test("fails when heap drift exceeds limit", () => {
  const engine = new RuntimeEnduranceCertificationEngine();

  const result = engine.certify(report({ heapDriftBytes: 20000 }), policy());

  assert.equal(result.status, "FAILED");
  assert.match(result.reasons.join(" "), /Heap drift exceeded/);
});

test("warns when peak lag is close to limit", () => {
  const engine = new RuntimeEnduranceCertificationEngine();

  const result = engine.certify(report({ peakEventLoopLagMs: 90 }), policy());

  assert.equal(result.status, "WARNING");
  assert.match(result.reasons.join(" "), /Peak event loop lag is close/);
});

test("fails when pressure violations exceed policy", () => {
  const engine = new RuntimeEnduranceCertificationEngine();

  const result = engine.certify(report({ pressureViolations: 1 }), policy());

  assert.equal(result.status, "FAILED");
  assert.match(result.reasons.join(" "), /Memory pressure violations/);
});

test("rejects invalid warning ratio", () => {
  const engine = new RuntimeEnduranceCertificationEngine();

  assert.throws(
    () => engine.certify(report(), {
      ...policy(),
      warningLagRatio: 0,
    }),
    /warning ratios must be > 0/,
  );
});
