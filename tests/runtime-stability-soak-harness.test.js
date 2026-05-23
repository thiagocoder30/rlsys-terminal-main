import test from "node:test";
import assert from "node:assert/strict";
import { RuntimeStabilitySoakHarness } from "../dist/application/runtime/RuntimeStabilitySoakHarness.js";

test("marks stable workload as stable", async () => {
  const harness = new RuntimeStabilitySoakHarness({
    execute: async (iteration) => ({
      iteration,
      heapUsedBytes: 1000 + iteration,
      eventLoopLagMs: 2,
      pressure: "LOW",
    }),
  });

  const result = await harness.run({
    iterations: 10,
    maxHeapDriftBytes: 20,
    maxPeakEventLoopLagMs: 5,
    forbiddenPressure: "HIGH",
  });

  assert.equal(result.stable, true);
  assert.equal(result.iterations, 10);
  assert.equal(result.heapDriftBytes, 9);
  assert.equal(result.peakEventLoopLagMs, 2);
  assert.equal(result.pressureViolations, 0);
});

test("detects heap drift violation", async () => {
  const harness = new RuntimeStabilitySoakHarness({
    execute: async (iteration) => ({
      iteration,
      heapUsedBytes: 1000 + iteration * 100,
      eventLoopLagMs: 1,
      pressure: "LOW",
    }),
  });

  const result = await harness.run({
    iterations: 5,
    maxHeapDriftBytes: 100,
    maxPeakEventLoopLagMs: 5,
    forbiddenPressure: "HIGH",
  });

  assert.equal(result.stable, false);
  assert.match(result.violationMessages.join(" "), /Heap drift exceeded/);
});

test("detects peak event loop lag violation", async () => {
  const harness = new RuntimeStabilitySoakHarness({
    execute: async (iteration) => ({
      iteration,
      heapUsedBytes: 1000,
      eventLoopLagMs: iteration === 3 ? 50 : 2,
      pressure: "LOW",
    }),
  });

  const result = await harness.run({
    iterations: 5,
    maxHeapDriftBytes: 100,
    maxPeakEventLoopLagMs: 10,
    forbiddenPressure: "HIGH",
  });

  assert.equal(result.stable, false);
  assert.equal(result.peakEventLoopLagMs, 50);
  assert.match(result.violationMessages.join(" "), /Peak event loop lag exceeded/);
});

test("detects pressure violations", async () => {
  const harness = new RuntimeStabilitySoakHarness({
    execute: async (iteration) => ({
      iteration,
      heapUsedBytes: 1000,
      eventLoopLagMs: 1,
      pressure: iteration >= 2 ? "HIGH" : "LOW",
    }),
  });

  const result = await harness.run({
    iterations: 4,
    maxHeapDriftBytes: 100,
    maxPeakEventLoopLagMs: 10,
    forbiddenPressure: "HIGH",
  });

  assert.equal(result.stable, false);
  assert.equal(result.pressureViolations, 3);
  assert.match(result.violationMessages.join(" "), /Memory pressure violated/);
});

test("allows elevated pressure when forbidden pressure is high", async () => {
  const harness = new RuntimeStabilitySoakHarness({
    execute: async (iteration) => ({
      iteration,
      heapUsedBytes: 1000,
      eventLoopLagMs: 1,
      pressure: "ELEVATED",
    }),
  });

  const result = await harness.run({
    iterations: 3,
    maxHeapDriftBytes: 100,
    maxPeakEventLoopLagMs: 10,
    forbiddenPressure: "HIGH",
  });

  assert.equal(result.stable, true);
  assert.equal(result.pressureViolations, 0);
});

test("rejects invalid configuration", async () => {
  const harness = new RuntimeStabilitySoakHarness({
    execute: async (iteration) => ({
      iteration,
      heapUsedBytes: 1000,
      eventLoopLagMs: 1,
      pressure: "LOW",
    }),
  });

  await assert.rejects(
    () => harness.run({
      iterations: 0,
      maxHeapDriftBytes: 100,
      maxPeakEventLoopLagMs: 10,
      forbiddenPressure: "HIGH",
    }),
    /iterations/,
  );
});

test("rejects sequence mismatch", async () => {
  const harness = new RuntimeStabilitySoakHarness({
    execute: async () => ({
      iteration: 999,
      heapUsedBytes: 1000,
      eventLoopLagMs: 1,
      pressure: "LOW",
    }),
  });

  await assert.rejects(
    () => harness.run({
      iterations: 2,
      maxHeapDriftBytes: 100,
      maxPeakEventLoopLagMs: 10,
      forbiddenPressure: "HIGH",
    }),
    /sequence mismatch/,
  );
});
