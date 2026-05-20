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

test('RuntimeKernel writes command, transition and HUD events to journal', async () => {
  const replay = new MemoryReplayRepository();
  const journal = new MemoryJournalRepository();
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
  );

  const result = await kernel.handle('status');
  kernel.shutdown();

  assert.equal(result.shouldContinue, true);
  assert.equal(replay.events.length, 1);

  const types = journal.events.map((event) => event.type);

  assert.deepEqual(types, ['COMMAND', 'STATE_TRANSITION', 'HUD']);
});

test('RuntimeKernel writes shutdown journal event on quit command', async () => {
  const replay = new MemoryReplayRepository();
  const journal = new MemoryJournalRepository();
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
  );

  const result = await kernel.handle('quit');

  assert.equal(result.shouldContinue, false);
  assert.equal(journal.events.some((event) => event.type === 'SHUTDOWN'), true);
});
