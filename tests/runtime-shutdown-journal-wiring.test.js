const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RuntimeShutdownCoordinator,
} = require('../dist/application/runtime');

class MemoryJournalRepository {
  constructor() {
    this.events = [];
  }

  getPath() {
    return 'memory://journal.jsonl';
  }

  async append(event) {
    this.events.push(event);
    return { accepted: true, eventId: event.eventId, reason: 'journal persisted' };
  }
}

test('RuntimeShutdownCoordinator writes shutdown journal event', async () => {
  let shutdownCalls = 0;
  const journal = new MemoryJournalRepository();

  const coordinator = new RuntimeShutdownCoordinator({
    shutdown() {
      shutdownCalls += 1;
    },
  }, journal);

  const result = coordinator.shutdown('SIGTERM');

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(result.accepted, true);
  assert.equal(shutdownCalls, 1);
  assert.equal(journal.events.length, 1);
  assert.equal(journal.events[0].type, 'SHUTDOWN');
  assert.equal(journal.events[0].reason, 'SIGTERM');
});
