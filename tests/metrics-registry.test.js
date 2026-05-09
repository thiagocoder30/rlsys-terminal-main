const test = require('node:test');
const assert = require('node:assert/strict');
const { MetricsRegistry } = require('../dist/infrastructure/observability/MetricsRegistry');

test('MetricsRegistry captures counters, timers, uptime and memory', () => {
  const metrics = new MetricsRegistry('test-service', '9.9.9');
  metrics.increment('requests.total');
  metrics.increment('requests.total', 2);
  metrics.observeDuration('request.duration_ms', 10);
  metrics.observeDuration('request.duration_ms', 40);

  const snapshot = metrics.snapshot();
  const counter = snapshot.counters.find(item => item.name === 'requests.total');
  const timer = snapshot.timers.find(item => item.name === 'request.duration_ms');

  assert.equal(snapshot.service, 'test-service');
  assert.equal(snapshot.version, '9.9.9');
  assert.equal(counter.value, 3);
  assert.equal(timer.count, 2);
  assert.equal(timer.maxMs, 40);
  assert.ok(snapshot.uptimeSeconds >= 0);
  assert.ok(snapshot.memory.rssMb > 0);
});
