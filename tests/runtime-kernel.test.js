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
    return {
      accepted: true,
      eventId: event.eventId,
      reason: 'persisted in memory',
    };
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

test('RuntimeKernel parses roulette rounds safely', () => {
  const kernel = new RuntimeKernel(new MemoryReplayRepository());

  assert.equal(kernel.parse('17').type, 'ROUND');
  assert.equal(kernel.parse('17').value, 17);
  assert.equal(kernel.parse('99').type, 'INVALID');
  assert.equal(kernel.parse('status').type, 'STATUS');
  assert.equal(kernel.parse('quit').type, 'QUIT');
});

test('RuntimeKernel handles round as fail-closed NO_GO observation', async () => {
  const repo = new MemoryReplayRepository();
  const kernel = new RuntimeKernel(repo);

  const result = await kernel.handle('17');

  assert.equal(result.shouldContinue, true);
  assert.match(result.output, /RL\.SYS CORE/);
  assert.match(result.output, /Estado: NO_GO|Estado: REVIEW|Estado: FREEZE/);
  assert.equal(repo.events.length, 1);
});

test('RuntimeKernel blocks invalid input and persists replay event', async () => {
  const repo = new MemoryReplayRepository();
  const kernel = new RuntimeKernel(repo);

  const result = await kernel.handle('abc');

  assert.equal(result.shouldContinue, true);
  assert.equal(result.lifecycleState, 'BLOCKED');
  assert.match(result.reason, /invalid operator input|illegal runtime transition/);
  assert.equal(repo.events.length, 1);
});

test('RuntimeKernel handles status command without betting execution', async () => {
  const repo = new MemoryReplayRepository();
  const kernel = new RuntimeKernel(repo);

  const result = await kernel.handle('status');

  assert.equal(result.shouldContinue, true);
  assert.match(result.output, /Runtime:/);
  assert.equal(repo.events.length, 1);
});

test('RuntimeKernel handles quit command as shutdown', async () => {
  const repo = new MemoryReplayRepository();
  const kernel = new RuntimeKernel(repo);

  const result = await kernel.handle('quit');

  assert.equal(result.shouldContinue, false);
  assert.equal(result.lifecycleState, 'SHUTDOWN');
  assert.match(result.output, /shutdown completed/);
});
