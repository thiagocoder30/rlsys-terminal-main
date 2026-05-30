'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { IncrementalSessionUpdateEngine } = require('../../../src/domain/session/IncrementalSessionUpdateEngine');
const { LiveContextSnapshotEngine } = require('../../../src/domain/session/LiveContextSnapshotEngine');

function createState(rounds) {
  const update = new IncrementalSessionUpdateEngine();
  const created = update.createInitialState('paper-session-snapshot', rounds);

  assert.equal(created.ok, true);
  return created.value;
}

test('composes stable live context snapshot from PAPER session state', () => {
  const state = createState([1, 2, 3, 4, 5, 6]);
  const engine = new LiveContextSnapshotEngine();

  const snapshot = engine.compose({
    sessionState: state,
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    supervisionRiskScore: 0.1
  });

  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.value.sessionId, 'paper-session-snapshot');
  assert.equal(snapshot.value.totalRounds, 6);
  assert.equal(snapshot.value.pressureBand, 'STABLE');
  assert.equal(snapshot.value.operationalGate, 'PAPER_AUTHORIZED');
  assert.equal(snapshot.value.paperGate, 'PAPER_AUTHORIZED');
  assert.equal(snapshot.value.liveGate, 'BLOCKED');
  assert.equal(snapshot.value.productionMoneyAllowed, false);
  assert.equal(snapshot.value.liveMoneyAuthorized, false);
});

test('detects repeat pressure using maxRepeatStreak, not only current repeatStreak', () => {
  const state = createState([9, 9, 9, 0, 0, 9]);
  const engine = new LiveContextSnapshotEngine({ repeatPressureThreshold: 3 });

  const snapshot = engine.compose({
    sessionState: state,
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    supervisionRiskScore: 0.1
  });

  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.value.maxRepeatStreak, 3);
  assert.ok(snapshot.value.reasons.includes('repeat_pressure_elevated'));
});

test('detects recent zero pressure', () => {
  const state = createState([1, 2, 0, 3, 0, 4]);
  const engine = new LiveContextSnapshotEngine({
    recentWindowSize: 6,
    zeroPressureThreshold: 2
  });

  const snapshot = engine.compose({
    sessionState: state,
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    supervisionRiskScore: 0.1
  });

  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.value.recentZeroCount, 2);
  assert.ok(snapshot.value.reasons.includes('recent_zero_pressure_elevated'));
});

test('detects critical pressure from supervision risk and weak operator/table context', () => {
  const state = createState([9, 9, 9, 0, 0, 9]);
  const engine = new LiveContextSnapshotEngine({
    recentWindowSize: 6,
    zeroPressureThreshold: 2,
    repeatPressureThreshold: 3
  });

  const snapshot = engine.compose({
    sessionState: state,
    tableContextScore: 0.2,
    operatorReadinessScore: 0.2,
    supervisionRiskScore: 0.95
  });

  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.value.pressureBand, 'CRITICAL');
  assert.ok(snapshot.value.livePressureScore >= 0.82);
  assert.ok(snapshot.value.reasons.includes('repeat_pressure_elevated'));
  assert.ok(snapshot.value.reasons.includes('supervision_risk_elevated'));
  assert.ok(snapshot.value.reasons.includes('operator_readiness_pressure'));
  assert.ok(snapshot.value.reasons.includes('table_context_pressure'));
});

test('rejects state with live money invariant violation', () => {
  const state = createState([1, 2, 3]);
  const engine = new LiveContextSnapshotEngine();

  const snapshot = engine.compose({
    sessionState: {
      ...state,
      liveMoneyAuthorized: true,
      productionMoneyAllowed: true
    },
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    supervisionRiskScore: 0.1
  });

  assert.equal(snapshot.ok, false);
  assert.ok(snapshot.error.reasons.includes('production_money_must_remain_disabled'));
  assert.ok(snapshot.error.reasons.includes('live_money_must_remain_disabled'));
});

test('rejects non manual session state', () => {
  const state = createState([1, 2, 3]);
  const engine = new LiveContextSnapshotEngine();

  const snapshot = engine.compose({
    sessionState: {
      ...state,
      inputMode: 'OCR_UPLOAD'
    }
  });

  assert.equal(snapshot.ok, false);
  assert.ok(snapshot.error.reasons.includes('manual_input_mode_required'));
});

test('is deterministic and idempotent', () => {
  const state = createState([1, 2, 3, 4, 5]);
  const engine = new LiveContextSnapshotEngine();
  const input = {
    sessionState: state,
    tableContextScore: 0.8,
    operatorReadinessScore: 0.8,
    supervisionRiskScore: 0.2
  };

  const first = engine.compose(input);
  const second = engine.compose(input);

  assert.deepEqual(first, second);
});

test('validates configuration defensively', () => {
  assert.throws(
    () => new LiveContextSnapshotEngine({ recentWindowSize: 0 }),
    /recentWindowSize/
  );

  assert.throws(
    () => new LiveContextSnapshotEngine({ zeroPressureThreshold: 0 }),
    /zeroPressureThreshold/
  );

  assert.throws(
    () => new LiveContextSnapshotEngine({ repeatPressureThreshold: 0 }),
    /repeatPressureThreshold/
  );
});
