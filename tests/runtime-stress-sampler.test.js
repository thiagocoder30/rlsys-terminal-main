const test = require('node:test');
const assert = require('node:assert/strict');
const { RuntimeStressSampler } = require('../dist/application/stress');
const { RuntimeStressHarness } = require('../dist/domain/stress');

test('RuntimeStressSampler converts valid telemetry frame into stress sample', () => {
  const sampler = new RuntimeStressSampler();

  const result = sampler.sample({
    scenario: 'EVENT_LOOP_LAG',
    iterations: 100,
    heapUsedBeforeBytes: 1000,
    heapUsedAfterBytes: 2500,
    maxLatencyMs: 120,
    rejectedEvents: 3,
    blockedEvents: 1,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.sample.heapDeltaBytes, 1500);
  assert.equal(result.sample.scenario, 'EVENT_LOOP_LAG');
});

test('RuntimeStressSampler clamps negative heap delta to zero', () => {
  const sampler = new RuntimeStressSampler();

  const result = sampler.sample({
    scenario: 'HEAP_PRESSURE',
    iterations: 10,
    heapUsedBeforeBytes: 5000,
    heapUsedAfterBytes: 3000,
    maxLatencyMs: 20,
    rejectedEvents: 0,
    blockedEvents: 0,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.sample.heapDeltaBytes, 0);
});

test('RuntimeStressSampler rejects invalid telemetry frame', () => {
  const sampler = new RuntimeStressSampler();

  const result = sampler.sample({
    scenario: 'OCR_BURST',
    iterations: -1,
    heapUsedBeforeBytes: 1000,
    heapUsedAfterBytes: 2000,
    maxLatencyMs: 10,
    rejectedEvents: 0,
    blockedEvents: 0,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.sample, null);
});

test('RuntimeStressSampler output feeds RuntimeStressHarness', () => {
  const sampler = new RuntimeStressSampler();
  const harness = new RuntimeStressHarness();

  const sampled = sampler.sample({
    scenario: 'REPLAY_FLOOD',
    iterations: 500,
    heapUsedBeforeBytes: 1024,
    heapUsedAfterBytes: 4096,
    maxLatencyMs: 80,
    rejectedEvents: 2,
    blockedEvents: 1,
  });

  assert.equal(sampled.accepted, true);

  const report = harness.evaluate([sampled.sample]);

  assert.equal(report.verdict, 'STRESS_PASSED');
  assert.equal(report.totalIterations, 500);
});
