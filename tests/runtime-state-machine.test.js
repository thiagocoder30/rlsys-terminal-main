const test = require('node:test');
const assert = require('node:assert/strict');
const { RuntimeStateMachine } = require('../dist/domain/runtime/RuntimeStateMachine');

test('RuntimeStateMachine accepts safe bootstrap transition into NO_GO', () => {
  const machine = new RuntimeStateMachine();

  const result = machine.transition({
    from: 'BOOTSTRAP',
    to: 'NO_GO',
    reason: 'runtime starts fail-closed',
    timestampEpochMs: 1,
  });

  assert.equal(result.verdict, 'TRANSITION_ACCEPTED');
  assert.equal(result.accepted, true);
});

test('RuntimeStateMachine rejects LOCKED directly to ALLOW', () => {
  const machine = new RuntimeStateMachine();

  const result = machine.transition({
    from: 'LOCKED',
    to: 'ALLOW',
    reason: 'operator attempted unsafe bypass',
    timestampEpochMs: 1,
  });

  assert.equal(result.verdict, 'TRANSITION_REJECTED');
  assert.equal(result.accepted, false);
  assert.match(result.reason, /illegal runtime transition/);
});

test('RuntimeStateMachine rejects FREEZE directly to ALLOW', () => {
  const machine = new RuntimeStateMachine();

  assert.equal(machine.canTransition('FREEZE', 'ALLOW'), false);
  assert.equal(machine.canTransition('FREEZE', 'REVIEW'), true);
});

test('RuntimeStateMachine permits ALLOW to defensive states', () => {
  const machine = new RuntimeStateMachine();

  assert.equal(machine.canTransition('ALLOW', 'NO_GO'), true);
  assert.equal(machine.canTransition('ALLOW', 'FREEZE'), true);
  assert.equal(machine.canTransition('ALLOW', 'LOCKED'), true);
  assert.equal(machine.canTransition('ALLOW', 'BLOCKED'), true);
});

test('RuntimeStateMachine keeps SHUTDOWN terminal', () => {
  const machine = new RuntimeStateMachine();

  assert.equal(machine.canTransition('SHUTDOWN', 'SHUTDOWN'), true);
  assert.equal(machine.canTransition('SHUTDOWN', 'NO_GO'), false);
  assert.equal(machine.canTransition('SHUTDOWN', 'ALLOW'), false);
});
