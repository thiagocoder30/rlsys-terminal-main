const test = require('node:test');
const assert = require('node:assert/strict');
const { ReleaseReadinessService } = require('../dist/application/release/ReleaseReadinessService');

test('ReleaseReadinessService returns review when config has warnings but no blockers', () => {
  const service = new ReleaseReadinessService('1.0.0-test');
  const result = service.evaluate({
    config: { valid: true, issues: [], errors: [], warnings: [{ key: 'GEMINI_API_KEY', severity: 'warning', message: 'missing' }], sanitized: {} },
    health: { status: 'ok', service: 'rl-sys-core', version: '1.0.0-test', timestamp: new Date().toISOString(), checks: { runtime: { status: 'ok' }, filesystem: { status: 'ok' } } },
    metrics: { service: 'rl-sys-core', version: '1.0.0-test', timestamp: new Date().toISOString(), uptimeSeconds: 1, memory: { rssMb: 1, heapUsedMb: 1, heapTotalMb: 1 }, counters: [], timers: [] }
  });

  assert.equal(result.status, 'review');
  assert.ok(result.gates.some(gate => gate.name === 'decision_governance' && gate.status === 'pass'));
});

test('ReleaseReadinessService blocks failed readiness checks', () => {
  const service = new ReleaseReadinessService('1.0.0-test');
  const result = service.evaluate({
    config: { valid: true, issues: [], errors: [], warnings: [], sanitized: {} },
    health: { status: 'degraded', service: 'rl-sys-core', version: '1.0.0-test', timestamp: new Date().toISOString(), checks: { filesystem: { status: 'degraded', details: 'readonly' } } },
    metrics: { service: 'rl-sys-core', version: '1.0.0-test', timestamp: new Date().toISOString(), uptimeSeconds: 1, memory: { rssMb: 1, heapUsedMb: 1, heapTotalMb: 1 }, counters: [], timers: [] }
  });

  assert.equal(result.status, 'blocked');
});
