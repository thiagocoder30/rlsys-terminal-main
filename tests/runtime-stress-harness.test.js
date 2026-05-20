const test = require('node:test');
const assert = require('node:assert/strict');
const { RuntimeStressHarness } = require('../dist/domain/stress');

test('RuntimeStressHarness passes bounded healthy stress samples', () => {
  const harness = new RuntimeStressHarness();

  const report = harness.evaluate([
    {
      scenario: 'OCR_BURST',
      iterations: 300,
      heapDeltaBytes: 1024 * 1024,
      maxLatencyMs: 90,
      rejectedEvents: 4,
      blockedEvents: 1,
    },
    {
      scenario: 'REPLAY_FLOOD',
      iterations: 500,
      heapDeltaBytes: 2 * 1024 * 1024,
      maxLatencyMs: 120,
      rejectedEvents: 2,
      blockedEvents: 0,
    },
  ]);

  assert.equal(report.verdict, 'STRESS_PASSED');
  assert.equal(report.totalIterations, 800);
  assert.equal(report.blockedEvents, 1);
});

test('RuntimeStressHarness escalates to review on latency degradation', () => {
  const harness = new RuntimeStressHarness();

  const report = harness.evaluate([
    {
      scenario: 'EVENT_LOOP_LAG',
      iterations: 100,
      heapDeltaBytes: 1024,
      maxLatencyMs: 750,
      rejectedEvents: 0,
      blockedEvents: 0,
    },
  ]);

  assert.equal(report.verdict, 'STRESS_REVIEW');
});

test('RuntimeStressHarness fails on critical heap pressure', () => {
  const harness = new RuntimeStressHarness();

  const report = harness.evaluate([
    {
      scenario: 'HEAP_PRESSURE',
      iterations: 100,
      heapDeltaBytes: 30 * 1024 * 1024,
      maxLatencyMs: 100,
      rejectedEvents: 0,
      blockedEvents: 0,
    },
  ]);

  assert.equal(report.verdict, 'STRESS_FAILED');
});

test('RuntimeStressHarness blocks empty sample sets', () => {
  const harness = new RuntimeStressHarness();

  const report = harness.evaluate([]);

  assert.equal(report.verdict, 'BLOCKED');
  assert.match(report.reason, /no stress samples/);
});

test('RuntimeStressHarness fails excessive blocked events', () => {
  const harness = new RuntimeStressHarness();

  const report = harness.evaluate([
    {
      scenario: 'GC_STORM',
      iterations: 100,
      heapDeltaBytes: 1024,
      maxLatencyMs: 100,
      rejectedEvents: 0,
      blockedEvents: 200,
    },
  ]);

  assert.equal(report.verdict, 'STRESS_FAILED');
});
