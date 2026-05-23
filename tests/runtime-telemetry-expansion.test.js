import test from "node:test";
import assert from "node:assert/strict";
import {
  RuntimeTelemetryPressureClassifier,
  RuntimeTelemetrySampler,
  RuntimeTelemetrySnapshotComposer,
} from "../dist/application/runtime/RuntimeTelemetryExpansion.js";

function memory(heapUsedBytes, heapTotalBytes = 1000) {
  return {
    heapUsedBytes,
    heapTotalBytes,
    rssBytes: 1500,
    externalBytes: 100,
  };
}

test("classifies low memory pressure", () => {
  const classifier = new RuntimeTelemetryPressureClassifier();

  assert.equal(classifier.classify(memory(400)), "LOW");
});

test("classifies elevated memory pressure", () => {
  const classifier = new RuntimeTelemetryPressureClassifier();

  assert.equal(classifier.classify(memory(750)), "ELEVATED");
});

test("classifies high memory pressure", () => {
  const classifier = new RuntimeTelemetryPressureClassifier();

  assert.equal(classifier.classify(memory(870)), "HIGH");
});

test("classifies critical memory pressure", () => {
  const classifier = new RuntimeTelemetryPressureClassifier();

  assert.equal(classifier.classify(memory(960)), "CRITICAL");
});

test("rejects invalid memory sample", () => {
  const classifier = new RuntimeTelemetryPressureClassifier();

  assert.throws(
    () => classifier.classify(memory(1200)),
    /heapUsedBytes cannot exceed/,
  );
});

test("samples memory from injected port", () => {
  const sampler = new RuntimeTelemetrySampler(
    { nowEpochMs: () => 2000 },
    { read: () => memory(500) },
  );

  const sample = sampler.sampleMemory();

  assert.equal(sample.heapUsedBytes, 500);
});

test("samples event loop lag from injected clock", () => {
  const sampler = new RuntimeTelemetrySampler(
    { nowEpochMs: () => 2050 },
    { read: () => memory(500) },
  );

  const lag = sampler.sampleLag(2000);

  assert.equal(lag.expectedAtEpochMs, 2000);
  assert.equal(lag.observedAtEpochMs, 2050);
});

test("composes telemetry snapshot", () => {
  const composer = new RuntimeTelemetrySnapshotComposer(
    new RuntimeTelemetryPressureClassifier(),
  );

  const snapshot = composer.compose({
    sampledAtEpochMs: 7000,
    runtimeStartedAtEpochMs: 1000,
    memory: memory(750),
    lagSample: {
      expectedAtEpochMs: 6950,
      observedAtEpochMs: 7000,
    },
    counters: {
      eventsPublished: 120,
      eventsFailed: 6,
      degradedZones: 2,
      openCircuits: 1,
      checkpointsSaved: 8,
    },
    windowMs: 60_000,
  });

  assert.equal(snapshot.uptimeMs, 6000);
  assert.equal(snapshot.memoryPressure, "ELEVATED");
  assert.equal(snapshot.eventLoopLagMs, 50);
  assert.equal(snapshot.eventsPerMinute, 120);
  assert.equal(snapshot.failureRate, 0.05);
  assert.equal(snapshot.degradedZones, 2);
  assert.equal(snapshot.openCircuits, 1);
  assert.equal(snapshot.checkpointsSaved, 8);
});

test("normalizes negative lag to zero", () => {
  const composer = new RuntimeTelemetrySnapshotComposer(
    new RuntimeTelemetryPressureClassifier(),
  );

  const snapshot = composer.compose({
    sampledAtEpochMs: 7000,
    runtimeStartedAtEpochMs: 1000,
    memory: memory(500),
    lagSample: {
      expectedAtEpochMs: 7100,
      observedAtEpochMs: 7000,
    },
    counters: {
      eventsPublished: 0,
      eventsFailed: 0,
      degradedZones: 0,
      openCircuits: 0,
      checkpointsSaved: 0,
    },
    windowMs: 60_000,
  });

  assert.equal(snapshot.eventLoopLagMs, 0);
  assert.equal(snapshot.eventsPerMinute, 0);
  assert.equal(snapshot.failureRate, 0);
});

test("rejects invalid counter consistency", () => {
  const composer = new RuntimeTelemetrySnapshotComposer(
    new RuntimeTelemetryPressureClassifier(),
  );

  assert.throws(
    () => composer.compose({
      sampledAtEpochMs: 7000,
      runtimeStartedAtEpochMs: 1000,
      memory: memory(500),
      lagSample: {
        expectedAtEpochMs: 7000,
        observedAtEpochMs: 7000,
      },
      counters: {
        eventsPublished: 1,
        eventsFailed: 2,
        degradedZones: 0,
        openCircuits: 0,
        checkpointsSaved: 0,
      },
      windowMs: 60_000,
    }),
    /eventsFailed cannot exceed/,
  );
});
