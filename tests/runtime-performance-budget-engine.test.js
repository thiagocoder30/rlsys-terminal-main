const assert = require('node:assert/strict');
const test = require('node:test');
const { RuntimePerformanceBudgetEngine } = require('../dist/domain/performance/RuntimePerformanceBudgetEngine');

function sample(overrides = {}) {
  return {
    sessionId: 'session-performance',
    measuredAtSpin: 128,
    latencyMs: 72,
    heapUsedMb: 192,
    eventQueueDepth: 8,
    eventsPerSecond: 9,
    observerFailures: 0,
    pendingPersistenceWrites: 1,
    thermalState: 'NOMINAL',
    activeModules: 12,
    ...overrides
  };
}

test('RuntimePerformanceBudgetEngine keeps low-end runtime within budget', () => {
  const engine = new RuntimePerformanceBudgetEngine();
  const result = engine.evaluate(sample());

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'WITHIN_BUDGET');
  assert.equal(result.value.action, 'CONTINUE');
  assert.equal(result.value.throttleFactor, 1);
  assert.equal(result.value.violations.length, 0);
  assert.equal(result.value.policy.deviceClass, 'LOW_END_ANDROID');
  assert.equal(result.value.auditChecksum.length, 64);
});

test('RuntimePerformanceBudgetEngine throttles when queue and latency exceed policy', () => {
  const engine = new RuntimePerformanceBudgetEngine();
  const result = engine.evaluate(sample({ latencyMs: 220, eventQueueDepth: 40, thermalState: 'HOT' }));

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'THROTTLE');
  assert.equal(result.value.action, 'REDUCE_SAMPLING');
  assert.ok(result.value.throttleFactor > 0);
  assert.ok(result.value.throttleFactor < 1);
  assert.ok(result.value.violations.some(violation => violation.metric === 'latencyMs'));
  assert.ok(result.value.violations.some(violation => violation.metric === 'eventQueueDepth'));
});

test('RuntimePerformanceBudgetEngine blocks live evaluation on critical thermal state', () => {
  const engine = new RuntimePerformanceBudgetEngine();
  const result = engine.evaluate(sample({ thermalState: 'CRITICAL', heapUsedMb: 420 }));

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'BLOCKED');
  assert.equal(result.value.action, 'BLOCK_LIVE_EVALUATION');
  assert.equal(result.value.throttleFactor, 0);
  assert.ok(result.value.recommendations.some(recommendation => recommendation.includes('Bloquear avaliação live')));
});

test('RuntimePerformanceBudgetEngine produces deterministic checksums for repeated samples', () => {
  const engine = new RuntimePerformanceBudgetEngine();
  const first = engine.evaluate(sample({ eventsPerSecond: 12 }));
  const second = engine.evaluate(sample({ eventsPerSecond: 12 }));

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(first.value.auditChecksum, second.value.auditChecksum);
});

test('RuntimePerformanceBudgetEngine rejects malformed samples without silent failure', () => {
  const engine = new RuntimePerformanceBudgetEngine();
  const result = engine.evaluate(sample({ latencyMs: -1 }));

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'RUNTIME_PERFORMANCE_BUDGET_FAILED');
});
