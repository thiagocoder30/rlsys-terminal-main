const test = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout: sleep } = require('node:timers/promises');
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
    return { accepted: true, eventId: event.eventId, reason: 'persisted' };
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

test('RuntimeKernel does not treat operator think time as event loop lag', async () => {
  const repo = new MemoryReplayRepository();
  const kernel = new RuntimeKernel(repo);

  await sleep(50);

  const result = await kernel.handle('status');

  kernel.shutdown();

  assert.equal(result.shouldContinue, true);
  assert.notEqual(result.lifecycleState, 'FREEZE');
  assert.equal(repo.events.length, 1);
});
