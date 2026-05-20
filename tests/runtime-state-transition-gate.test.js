const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RuntimeStateTransitionGate,
} = require('../dist/application/runtime');

test('RuntimeStateTransitionGate accepts safe NO_GO to OBSERVE transition', () => {
  const gate = new RuntimeStateTransitionGate();

  const result = gate.apply({
    currentState: 'NO_GO',
    operationalVerdict: 'OBSERVE',
    reason: 'operator observation window',
    timestampEpochMs: 1,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.previousState, 'NO_GO');
  assert.equal(result.nextState, 'OBSERVE');
});

test('RuntimeStateTransitionGate rejects LOCKED to ALLOW bypass', () => {
  const gate = new RuntimeStateTransitionGate();

  const result = gate.apply({
    currentState: 'LOCKED',
    operationalVerdict: 'ALLOW',
    reason: 'unsafe direct unlock attempt',
    timestampEpochMs: 1,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.previousState, 'LOCKED');
  assert.equal(result.nextState, 'LOCKED');
  assert.match(result.reason, /illegal runtime transition/);
});

test('RuntimeStateTransitionGate rejects FREEZE to ALLOW without review', () => {
  const gate = new RuntimeStateTransitionGate();

  const result = gate.apply({
    currentState: 'FREEZE',
    operationalVerdict: 'ALLOW',
    reason: 'freeze recovery attempted too early',
    timestampEpochMs: 1,
  });

  assert.equal(result.accepted, false);
  assert.equal(result.nextState, 'FREEZE');
});

test('RuntimeStateTransitionGate allows FREEZE to REVIEW recovery path', () => {
  const gate = new RuntimeStateTransitionGate();

  const result = gate.apply({
    currentState: 'FREEZE',
    operationalVerdict: 'REVIEW',
    reason: 'controlled post-freeze review',
    timestampEpochMs: 1,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.nextState, 'REVIEW');
});

test('RuntimeStateTransitionGate maps BLOCKED verdict into BLOCKED lifecycle state', () => {
  const gate = new RuntimeStateTransitionGate();

  const result = gate.apply({
    currentState: 'NO_GO',
    operationalVerdict: 'BLOCKED',
    reason: 'fatal guard violation',
    timestampEpochMs: 1,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.nextState, 'BLOCKED');
});
