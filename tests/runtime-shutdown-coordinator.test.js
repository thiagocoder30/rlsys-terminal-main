const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RuntimeShutdownCoordinator,
} = require('../dist/application/runtime');

test('RuntimeShutdownCoordinator shuts down target once', () => {
  let calls = 0;
  const coordinator = new RuntimeShutdownCoordinator({
    shutdown() {
      calls += 1;
    },
  });

  const first = coordinator.shutdown('SIGINT');
  const second = coordinator.shutdown('SIGTERM');

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, true);
  assert.equal(calls, 1);
  assert.equal(coordinator.isClosed(), true);
});

test('RuntimeShutdownCoordinator preserves shutdown reason in result', () => {
  const coordinator = new RuntimeShutdownCoordinator({
    shutdown() {},
  });

  const result = coordinator.shutdown('UNCAUGHT_EXCEPTION');

  assert.equal(result.reason, 'UNCAUGHT_EXCEPTION');
  assert.match(result.message, /runtime shutdown completed/);
});
