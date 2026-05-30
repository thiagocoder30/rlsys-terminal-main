'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { IncrementalSessionUpdateEngine } = require('../../../src/domain/session/IncrementalSessionUpdateEngine');
const { PaperSessionSupervisorV2 } = require('../../../src/domain/session/PaperSessionSupervisorV2');

function createInitialState(rounds) {
  const update = new IncrementalSessionUpdateEngine();
  const created = update.createInitialState('paper-session-supervisor-v2', rounds);

  assert.equal(created.ok, true);
  return created.value;
}

test('continues PAPER session when live pipeline is stable', () => {
  const supervisor = new PaperSessionSupervisorV2();
  const state = createInitialState([1, 2, 3, 4, 5]);

  const result = supervisor.supervise({
    state,
    nextNumber: 6,
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    supervisionRiskScore: 0.1
  });

  assert.equal(result.status, 'PAPER_SESSION_CONTINUES');
  assert.equal(result.canContinuePaperSession, true);
  assert.equal(result.shouldInterruptSession, false);
  assert.equal(result.update.accepted, true);
  assert.equal(result.consensus.status, 'LIVE_CONSENSUS_ACCEPTED');
  assert.equal(result.risk.status, 'LIVE_RISK_STABLE');
  assert.equal(result.veto.status, 'LIVE_VETO_CLEAR');
  assert.equal(result.paperGate, 'PAPER_AUTHORIZED');
  assert.equal(result.liveGate, 'BLOCKED');
  assert.equal(result.productionMoneyAllowed, false);
  assert.equal(result.liveMoneyAuthorized, false);
});

test('interrupts PAPER session when live veto becomes active', () => {
  const supervisor = new PaperSessionSupervisorV2();
  const state = createInitialState([9, 9, 9, 0, 0]);

  const result = supervisor.supervise({
    state,
    nextNumber: 9,
    tableContextScore: 0.2,
    operatorReadinessScore: 0.2,
    supervisionRiskScore: 0.95
  });

  assert.equal(result.status, 'PAPER_SESSION_INTERRUPTED');
  assert.equal(result.canContinuePaperSession, false);
  assert.equal(result.shouldInterruptSession, true);
  assert.equal(result.veto.status, 'LIVE_VETO_ACTIVE');
  assert.equal(result.paperGate, 'BLOCKED');
  assert.equal(result.liveGate, 'BLOCKED');
  assert.equal(result.productionMoneyAllowed, false);
  assert.equal(result.liveMoneyAuthorized, false);
});

test('interrupts PAPER session when manual update is rejected', () => {
  const supervisor = new PaperSessionSupervisorV2();
  const state = createInitialState([1, 2, 3]);

  const result = supervisor.supervise({
    state,
    nextNumber: 37,
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    supervisionRiskScore: 0.1
  });

  assert.equal(result.status, 'PAPER_SESSION_INTERRUPTED');
  assert.equal(result.shouldInterruptSession, true);
  assert.ok(result.reasons.includes('manual_update_rejected'));
  assert.ok(result.reasons.includes('roulette_number_out_of_range'));
  assert.equal(result.paperGate, 'BLOCKED');
});

test('rejects manual override request as institutional veto', () => {
  const supervisor = new PaperSessionSupervisorV2();
  const state = createInitialState([1, 2, 3, 4, 5]);

  const result = supervisor.supervise({
    state,
    nextNumber: 6,
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    supervisionRiskScore: 0.1,
    manualOverrideRequested: true
  });

  assert.equal(result.status, 'PAPER_SESSION_INTERRUPTED');
  assert.equal(result.veto.status, 'LIVE_VETO_ACTIVE');
  assert.ok(result.reasons.includes('manual_override_rejected'));
});

test('interrupts on live money invariant violation in state', () => {
  const supervisor = new PaperSessionSupervisorV2();
  const state = createInitialState([1, 2, 3]);

  const result = supervisor.supervise({
    state: {
      ...state,
      liveMoneyAuthorized: true,
      productionMoneyAllowed: true
    },
    nextNumber: 4,
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    supervisionRiskScore: 0.1
  });

  assert.equal(result.status, 'PAPER_SESSION_INTERRUPTED');
  assert.equal(result.liveGate, 'BLOCKED');
  assert.equal(result.productionMoneyAllowed, false);
  assert.equal(result.liveMoneyAuthorized, false);
  assert.ok(result.reasons.includes('production_money_must_remain_disabled'));
  assert.ok(result.reasons.includes('live_money_must_remain_disabled'));
});

test('is deterministic and idempotent', () => {
  const supervisor = new PaperSessionSupervisorV2();
  const state = createInitialState([1, 2, 3, 4, 5]);

  const input = {
    state,
    nextNumber: 6,
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    supervisionRiskScore: 0.1
  };

  const first = supervisor.supervise(input);
  const second = supervisor.supervise(input);

  assert.deepEqual(first, second);
});

test('rejects missing input safely', () => {
  const supervisor = new PaperSessionSupervisorV2();
  const result = supervisor.supervise(null);

  assert.equal(result.status, 'PAPER_SESSION_INTERRUPTED');
  assert.equal(result.paperGate, 'BLOCKED');
  assert.ok(result.reasons.includes('input_not_object'));
});
