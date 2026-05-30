'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { IncrementalSessionUpdateEngine } = require('../../../src/domain/session/IncrementalSessionUpdateEngine');
const { LiveContextSnapshotEngine } = require('../../../src/domain/session/LiveContextSnapshotEngine');
const { LiveConsensusEngine } = require('../../../src/domain/session/LiveConsensusEngine');

function createSnapshot(scores) {
  const update = new IncrementalSessionUpdateEngine();
  const initial = update.createInitialState('paper-session-consensus', [1, 2, 3, 4, 5, 6]);

  assert.equal(initial.ok, true);

  const snapshot = new LiveContextSnapshotEngine().compose({
    sessionState: initial.value,
    tableContextScore: scores.tableContextScore,
    operatorReadinessScore: scores.operatorReadinessScore,
    supervisionRiskScore: scores.supervisionRiskScore
  });

  assert.equal(snapshot.ok, true);

  return {
    ...snapshot.value,
    livePressureScore: scores.livePressureScore,
    pressureBand: scores.pressureBand || snapshot.value.pressureBand
  };
}

test('accepts strong live consensus while keeping live money blocked', () => {
  const snapshot = createSnapshot({
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    supervisionRiskScore: 0.1,
    livePressureScore: 0.1,
    pressureBand: 'STABLE'
  });

  const consensus = new LiveConsensusEngine().evaluate({ snapshot });

  assert.equal(consensus.status, 'LIVE_CONSENSUS_ACCEPTED');
  assert.equal(consensus.approved, true);
  assert.equal(consensus.band, 'STRONG');
  assert.equal(consensus.paperGate, 'PAPER_AUTHORIZED');
  assert.equal(consensus.liveGate, 'BLOCKED');
  assert.equal(consensus.productionMoneyAllowed, false);
  assert.equal(consensus.liveMoneyAuthorized, false);
});

test('blocks consensus when live pressure is critical', () => {
  const snapshot = createSnapshot({
    tableContextScore: 0.95,
    operatorReadinessScore: 0.95,
    supervisionRiskScore: 0.05,
    livePressureScore: 0.9,
    pressureBand: 'CRITICAL'
  });

  const consensus = new LiveConsensusEngine().evaluate({ snapshot });

  assert.equal(consensus.status, 'LIVE_CONSENSUS_BLOCKED');
  assert.equal(consensus.approved, false);
  assert.equal(consensus.band, 'BLOCKED');
  assert.ok(consensus.reasons.includes('critical_live_pressure'));
  assert.ok(consensus.reasons.includes('live_pressure_above_limit'));
  assert.equal(consensus.paperGate, 'BLOCKED');
});

test('blocks consensus when operator readiness is weak even if score remains high', () => {
  const snapshot = createSnapshot({
    tableContextScore: 0.8,
    operatorReadinessScore: 0.3,
    supervisionRiskScore: 0.2,
    livePressureScore: 0.2,
    pressureBand: 'STABLE'
  });

  const consensus = new LiveConsensusEngine().evaluate({ snapshot });

  assert.equal(consensus.status, 'LIVE_CONSENSUS_BLOCKED');
  assert.equal(consensus.band, 'BLOCKED');
  assert.ok(consensus.reasons.includes('operator_readiness_weak'));
  assert.equal(consensus.paperGate, 'BLOCKED');
});

test('blocks consensus when live money invariant is violated regardless of score', () => {
  const snapshot = createSnapshot({
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    supervisionRiskScore: 0.1,
    livePressureScore: 0.1,
    pressureBand: 'STABLE'
  });

  const consensus = new LiveConsensusEngine().evaluate({
    snapshot: {
      ...snapshot,
      liveGate: 'OPEN',
      productionMoneyAllowed: true,
      liveMoneyAuthorized: true
    }
  });

  assert.equal(consensus.status, 'LIVE_CONSENSUS_BLOCKED');
  assert.equal(consensus.band, 'BLOCKED');
  assert.equal(consensus.productionMoneyAllowed, false);
  assert.equal(consensus.liveMoneyAuthorized, false);
  assert.equal(consensus.liveGate, 'BLOCKED');
  assert.ok(consensus.reasons.includes('live_gate_must_remain_blocked'));
  assert.ok(consensus.reasons.includes('production_money_must_remain_disabled'));
  assert.ok(consensus.reasons.includes('live_money_must_remain_disabled'));
});

test('rejects invalid input safely', () => {
  const consensus = new LiveConsensusEngine().evaluate(null);

  assert.equal(consensus.status, 'LIVE_CONSENSUS_BLOCKED');
  assert.equal(consensus.approved, false);
  assert.ok(consensus.reasons.includes('input_not_object'));
});

test('is deterministic and idempotent', () => {
  const snapshot = createSnapshot({
    tableContextScore: 0.8,
    operatorReadinessScore: 0.8,
    supervisionRiskScore: 0.2,
    livePressureScore: 0.2,
    pressureBand: 'STABLE'
  });

  const engine = new LiveConsensusEngine();
  const first = engine.evaluate({ snapshot });
  const second = engine.evaluate({ snapshot });

  assert.deepEqual(first, second);
});

test('validates configuration defensively', () => {
  assert.throws(
    () => new LiveConsensusEngine({
      weakThreshold: 0.8,
      acceptableThreshold: 0.7,
      strongThreshold: 0.9
    }),
    /consensus thresholds/
  );

  assert.throws(
    () => new LiveConsensusEngine({ maxAllowedPressureScore: 2 }),
    /maxAllowedPressureScore/
  );
});
