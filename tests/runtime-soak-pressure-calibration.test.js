const test = require("node:test");
const assert = require("node:assert/strict");
const {
  RuntimeSoakPressureCalibration,
} = require("../dist/application/runtime/RuntimeSoakPressureCalibration.js");

function sample(iteration, pressure) {
  return { iteration, pressure };
}

test("ignores warmup pressure samples", () => {
  const calibration = new RuntimeSoakPressureCalibration();

  const result = calibration.evaluate([
    sample(1, "HIGH"),
    sample(2, "HIGH"),
    sample(3, "LOW"),
  ], {
    warmupIterations: 2,
    allowedTransientPressureSpikes: 0,
    sustainedPressureWindow: 2,
    forbiddenPressure: "HIGH",
  });

  assert.equal(result.ignoredWarmupSamples, 2);
  assert.equal(result.measuredIterations, 1);
  assert.equal(result.transientPressureSpikes, 0);
  assert.equal(result.stable, true);
});

test("allows configured transient pressure spikes", () => {
  const calibration = new RuntimeSoakPressureCalibration();

  const result = calibration.evaluate([
    sample(1, "LOW"),
    sample(2, "HIGH"),
    sample(3, "LOW"),
  ], {
    warmupIterations: 0,
    allowedTransientPressureSpikes: 1,
    sustainedPressureWindow: 2,
    forbiddenPressure: "HIGH",
  });

  assert.equal(result.transientPressureSpikes, 1);
  assert.equal(result.sustainedPressureViolations, 0);
  assert.equal(result.stable, true);
});

test("fails when transient spikes exceed policy", () => {
  const calibration = new RuntimeSoakPressureCalibration();

  const result = calibration.evaluate([
    sample(1, "HIGH"),
    sample(2, "LOW"),
    sample(3, "HIGH"),
  ], {
    warmupIterations: 0,
    allowedTransientPressureSpikes: 1,
    sustainedPressureWindow: 3,
    forbiddenPressure: "HIGH",
  });

  assert.equal(result.transientPressureSpikes, 2);
  assert.equal(result.stable, false);
});

test("detects sustained pressure violation", () => {
  const calibration = new RuntimeSoakPressureCalibration();

  const result = calibration.evaluate([
    sample(1, "HIGH"),
    sample(2, "HIGH"),
    sample(3, "HIGH"),
  ], {
    warmupIterations: 0,
    allowedTransientPressureSpikes: 10,
    sustainedPressureWindow: 2,
    forbiddenPressure: "HIGH",
  });

  assert.equal(result.sustainedPressureViolations, 2);
  assert.equal(result.stable, false);
});

test("treats critical as violation when forbidden pressure is high", () => {
  const calibration = new RuntimeSoakPressureCalibration();

  const result = calibration.evaluate([
    sample(1, "CRITICAL"),
  ], {
    warmupIterations: 0,
    allowedTransientPressureSpikes: 0,
    sustainedPressureWindow: 1,
    forbiddenPressure: "HIGH",
  });

  assert.equal(result.transientPressureSpikes, 1);
  assert.equal(result.sustainedPressureViolations, 1);
  assert.equal(result.stable, false);
});

test("rejects invalid sustained pressure window", () => {
  const calibration = new RuntimeSoakPressureCalibration();

  assert.throws(
    () => calibration.evaluate([], {
      warmupIterations: 0,
      allowedTransientPressureSpikes: 0,
      sustainedPressureWindow: 0,
      forbiddenPressure: "HIGH",
    }),
    /sustainedPressureWindow/,
  );
});
