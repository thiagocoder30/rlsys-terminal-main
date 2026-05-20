const test = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout: sleep } = require('node:timers/promises');
const {
  TrueEventLoopLagMonitor,
} = require('../dist/infrastructure/runtime');

test('TrueEventLoopLagMonitor starts, samples scheduler drift, and stops safely', async () => {
  const monitor = new TrueEventLoopLagMonitor(5);

  const before = monitor.snapshot();
  assert.equal(before.started, false);
  assert.equal(before.sampleCount, 0);

  monitor.start();
  monitor.start();

  await sleep(25);

  const during = monitor.snapshot();

  assert.equal(during.started, true);
  assert.ok(during.sampleCount > 0);
  assert.ok(during.lastLagMs >= 0);
  assert.ok(during.maxLagMs >= 0);
  assert.ok(during.averageLagMs >= 0);

  monitor.stop();
  monitor.stop();

  const after = monitor.snapshot();
  assert.equal(after.started, false);
});
