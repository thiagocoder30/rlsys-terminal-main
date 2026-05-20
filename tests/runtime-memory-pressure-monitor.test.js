const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RuntimeMemoryPressureMonitor,
} = require('../dist/domain/runtime/RuntimeMemoryPressureMonitor');

test('RuntimeMemoryPressureMonitor returns bounded O(1) runtime sample', () => {
  const monitor = new RuntimeMemoryPressureMonitor();

  const sample = monitor.sample();

  assert.ok(sample.heapUsedBytes > 0);
  assert.ok(sample.heapTotalBytes > 0);
  assert.ok(sample.rssBytes > 0);
  assert.ok(sample.heapUsageRatio >= 0);
  assert.ok(sample.eventLoopLagMs >= 0);
  assert.ok(sample.sampledAtEpochMs > 0);
  assert.match(sample.reason, /runtime|pressure|heap/);
});

test('RuntimeMemoryPressureMonitor triggers review with strict thresholds', () => {
  const monitor = new RuntimeMemoryPressureMonitor({
    heapReviewRatio: 0.000001,
    heapCriticalRatio: 0.999999,
    eventLoopLagReviewMs: 999999,
    eventLoopLagCriticalMs: 9999999,
  });

  const sample = monitor.sample();

  assert.equal(sample.state, 'MEMORY_REVIEW');
});

test('RuntimeMemoryPressureMonitor triggers critical with strict thresholds', () => {
  const monitor = new RuntimeMemoryPressureMonitor({
    heapReviewRatio: 0.000001,
    heapCriticalRatio: 0.000001,
    eventLoopLagReviewMs: 999999,
    eventLoopLagCriticalMs: 9999999,
  });

  const sample = monitor.sample();

  assert.equal(sample.state, 'MEMORY_CRITICAL');
});
