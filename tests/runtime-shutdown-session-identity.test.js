const test = require('node:test');
const assert = require('node:assert/strict');
const { RuntimeShutdownCoordinator } = require('../dist/application/runtime');

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

test('RuntimeShutdownCoordinator propagates session identity to shutdown journal event', async () => {
  const journal = new MemoryJournalRepository();
  const identity = {
    sessionId: 'runtime-20260521-004501',
    startedAtEpochMs: 1,
  };

  const coordinator = new RuntimeShutdownCoordinator({
    shutdown() {},
  }, journal, identity);

  coordinator.shutdown('SIGINT');
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(journal.events[0].sessionId, identity.sessionId);
  assert.equal(journal.events[0].payload.sessionId, identity.sessionId);
});
