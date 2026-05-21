const test = require('node:test');
const assert = require('node:assert/strict');
const { RuntimeKernel } = require('../dist/application/runtime');

class MemoryReplayRepository {
  constructor() {
    this.events = [];
  }

  getPath() {
    return 'memory://replay.jsonl';
  }

  async append(event) {
    this.events.push(event);
    return { accepted: true, eventId: event.eventId, reason: 'replay persisted' };
  }

  async persist(event) {
    return this.append(event);
  }

  async appendEvent(event) {
    return this.append(event);
  }

  async record(event) {
    return this.append(event);
  }
}

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

test('RuntimeKernel propagates session identity to replay and journal', async () => {
  const replay = new MemoryReplayRepository();
  const journal = new MemoryJournalRepository();
  const identity = {
    sessionId: 'runtime-20260521-004501',
    startedAtEpochMs: 1,
  };

  const kernel = new RuntimeKernel(
    replay,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    journal,
    identity,
  );

  await kernel.handle('status');
  kernel.shutdown();

  assert.equal(kernel.getSessionId(), identity.sessionId);
  assert.equal(replay.events[0].sessionId, identity.sessionId);
  assert.equal(journal.events.every((event) => event.sessionId === identity.sessionId), true);
});
