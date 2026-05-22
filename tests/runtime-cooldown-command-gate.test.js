const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RuntimeCooldownCommandGate,
} = require('../dist/application/runtime');

test('RuntimeCooldownCommandGate allows normal round without prior loss', () => {
  const gate = new RuntimeCooldownCommandGate();

  const result = gate.evaluate({
    commandType: 'ROUND',
    nowEpochMs: 1000,
  });

  assert.equal(result.verdict, 'ALLOW');
  assert.equal(result.cooldown.state, 'COOLDOWN_CLEAR');
});

test('RuntimeCooldownCommandGate escalates to review after repeated losses', () => {
  const gate = new RuntimeCooldownCommandGate();

  gate.evaluate({ commandType: 'LOSS', nowEpochMs: 1000 });
  const result = gate.evaluate({ commandType: 'LOSS', nowEpochMs: 2000 });

  assert.equal(result.verdict, 'REVIEW');
  assert.equal(result.cooldown.state, 'COOLDOWN_REVIEW');
});

test('RuntimeCooldownCommandGate blocks after dangerous loss streak', () => {
  const gate = new RuntimeCooldownCommandGate();

  gate.evaluate({ commandType: 'LOSS', nowEpochMs: 1000 });
  gate.evaluate({ commandType: 'LOSS', nowEpochMs: 2000 });
  const locked = gate.evaluate({ commandType: 'LOSS', nowEpochMs: 3000 });
  const blocked = gate.evaluate({ commandType: 'ROUND', nowEpochMs: 4000 });

  assert.equal(locked.verdict, 'BLOCK');
  assert.equal(locked.cooldown.state, 'COOLDOWN_LOCKED');
  assert.equal(blocked.verdict, 'BLOCK');
  assert.match(blocked.reason, /Cooldown emocional ativo/);
});

test('RuntimeCooldownCommandGate resets after win', () => {
  const gate = new RuntimeCooldownCommandGate();

  gate.evaluate({ commandType: 'LOSS', nowEpochMs: 1000 });
  gate.evaluate({ commandType: 'LOSS', nowEpochMs: 2000 });

  const reset = gate.evaluate({ commandType: 'WIN', nowEpochMs: 3000 });
  const next = gate.evaluate({ commandType: 'ROUND', nowEpochMs: 4000 });

  assert.equal(reset.verdict, 'RESET');
  assert.equal(next.verdict, 'ALLOW');
  assert.equal(gate.snapshot().consecutiveLosses, 0);
});

test('RuntimeCooldownCommandGate allows status report and quit during lock', () => {
  const gate = new RuntimeCooldownCommandGate();

  gate.evaluate({ commandType: 'LOSS', nowEpochMs: 1000 });
  gate.evaluate({ commandType: 'LOSS', nowEpochMs: 2000 });
  gate.evaluate({ commandType: 'LOSS', nowEpochMs: 3000 });

  assert.equal(gate.evaluate({ commandType: 'STATUS', nowEpochMs: 4000 }).verdict, 'ALLOW');
  assert.equal(gate.evaluate({ commandType: 'REPORT', nowEpochMs: 4000 }).verdict, 'ALLOW');
  assert.equal(gate.evaluate({ commandType: 'QUIT', nowEpochMs: 4000 }).verdict, 'ALLOW');
});

test('RuntimeCooldownCommandGate releases lock after cooldown expires', () => {
  const gate = new RuntimeCooldownCommandGate();

  gate.evaluate({ commandType: 'LOSS', nowEpochMs: 1000 });
  gate.evaluate({ commandType: 'LOSS', nowEpochMs: 2000 });
  gate.evaluate({ commandType: 'LOSS', nowEpochMs: 3000 });

  const afterLock = gate.evaluate({
    commandType: 'ROUND',
    nowEpochMs: 20 * 60 * 1000,
  });

  assert.notEqual(afterLock.verdict, 'BLOCK');
});

test('RuntimeCooldownCommandGate rejects invalid timestamps', () => {
  const gate = new RuntimeCooldownCommandGate();

  assert.throws(() => gate.evaluate({
    commandType: 'ROUND',
    nowEpochMs: 0,
  }), /nowEpochMs/);
});
