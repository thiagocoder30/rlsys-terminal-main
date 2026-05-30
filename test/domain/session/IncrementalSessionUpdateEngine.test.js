'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { IncrementalSessionUpdateEngine } = require('../../../src/domain/session/IncrementalSessionUpdateEngine');

test('creates initial manual PAPER session state from warmup rounds', () => {
  const engine = new IncrementalSessionUpdateEngine();
  const result = engine.createInitialState('paper-session-1', [0, 32, 15, 19]);

  assert.equal(result.ok, true);
  assert.equal(result.value.totalRounds, 4);
  assert.equal(result.value.lastNumber, 19);
  assert.equal(result.value.inputMode, 'MANUAL_INPUT');
  assert.equal(result.value.operationalGate, 'PAPER_AUTHORIZED');
  assert.equal(result.value.paperGate, 'PAPER_AUTHORIZED');
  assert.equal(result.value.liveGate, 'BLOCKED');
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorized, false);
});

test('accepts one manual number and returns updated immutable state', () => {
  const engine = new IncrementalSessionUpdateEngine();
  const initial = engine.createInitialState('paper-session-1', [1, 2, 3]).value;

  const decision = engine.apply({
    state: initial,
    nextNumber: 4,
    source: 'MANUAL_INPUT'
  });

  assert.equal(decision.status, 'MANUAL_ROUND_ACCEPTED');
  assert.equal(decision.accepted, true);
  assert.equal(decision.state.totalRounds, 4);
  assert.equal(decision.state.lastNumber, 4);
  assert.equal(decision.state.manualUpdates, 1);
  assert.deepEqual(decision.state.rounds, [1, 2, 3, 4]);
  assert.equal(decision.liveGate, 'BLOCKED');
});

test('rejects invalid roulette number', () => {
  const engine = new IncrementalSessionUpdateEngine();
  const initial = engine.createInitialState('paper-session-1', [1, 2, 3]).value;

  const decision = engine.apply({
    state: initial,
    nextNumber: 37,
    source: 'MANUAL_INPUT'
  });

  assert.equal(decision.status, 'SESSION_UPDATE_REJECTED');
  assert.equal(decision.accepted, false);
  assert.ok(decision.reasons.includes('roulette_number_out_of_range'));
  assert.equal(decision.paperGate, 'BLOCKED');
});

test('rejects non-manual input after warmup', () => {
  const engine = new IncrementalSessionUpdateEngine();
  const initial = engine.createInitialState('paper-session-1', [1, 2, 3]).value;

  const decision = engine.apply({
    state: initial,
    nextNumber: 4,
    source: 'OCR_UPLOAD'
  });

  assert.equal(decision.status, 'SESSION_UPDATE_REJECTED');
  assert.ok(decision.reasons.includes('only_manual_input_allowed_after_warmup'));
});

test('rejects live money invariant violation in state', () => {
  const engine = new IncrementalSessionUpdateEngine();
  const initial = engine.createInitialState('paper-session-1', [1, 2, 3]).value;

  const decision = engine.apply({
    state: {
      ...initial,
      liveMoneyAuthorized: true,
      productionMoneyAllowed: true
    },
    nextNumber: 4,
    source: 'MANUAL_INPUT'
  });

  assert.equal(decision.status, 'SESSION_UPDATE_REJECTED');
  assert.ok(decision.reasons.includes('production_money_must_remain_disabled'));
  assert.ok(decision.reasons.includes('live_money_must_remain_disabled'));
  assert.equal(decision.liveMoneyAuthorized, false);
  assert.equal(decision.productionMoneyAllowed, false);
});

test('tracks zero count and repeat streaks', () => {
  const engine = new IncrementalSessionUpdateEngine();
  const initial = engine.createInitialState('paper-session-1', [0, 7, 7]).value;

  const decision = engine.apply({
    state: initial,
    nextNumber: 7,
    source: 'MANUAL_INPUT'
  });

  assert.equal(decision.accepted, true);
  assert.equal(decision.state.zeroCount, 1);
  assert.equal(decision.state.repeatStreak, 3);
  assert.equal(decision.state.maxRepeatStreak, 3);
});

test('does not mutate previous state', () => {
  const engine = new IncrementalSessionUpdateEngine();
  const initial = engine.createInitialState('paper-session-1', [1, 2, 3]).value;

  const decision = engine.apply({
    state: initial,
    nextNumber: 4,
    source: 'MANUAL_INPUT'
  });

  assert.deepEqual(initial.rounds, [1, 2, 3]);
  assert.deepEqual(decision.state.rounds, [1, 2, 3, 4]);
});

test('is deterministic and idempotent', () => {
  const engine = new IncrementalSessionUpdateEngine();
  const initial = engine.createInitialState('paper-session-1', [1, 2, 3]).value;
  const input = {
    state: initial,
    nextNumber: 4,
    source: 'MANUAL_INPUT'
  };

  const first = engine.apply(input);
  const second = engine.apply(input);

  assert.deepEqual(first, second);
});

test('rejects max round overflow', () => {
  const engine = new IncrementalSessionUpdateEngine({ maxRounds: 3 });
  const initial = engine.createInitialState('paper-session-1', [1, 2, 3]).value;

  const decision = engine.apply({
    state: initial,
    nextNumber: 4,
    source: 'MANUAL_INPUT'
  });

  assert.equal(decision.status, 'SESSION_UPDATE_REJECTED');
  assert.ok(decision.reasons.includes('max_rounds_exceeded'));
});

test('validates configuration defensively', () => {
  assert.throws(
    () => new IncrementalSessionUpdateEngine({ maxRounds: 0 }),
    /maxRounds/
  );
});
