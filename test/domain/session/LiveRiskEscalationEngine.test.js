'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { IncrementalSessionUpdateEngine } = require('../../../src/domain/session/IncrementalSessionUpdateEngine');
const { LiveContextSnapshotEngine } = require('../../../src/domain/session/LiveContextSnapshotEngine');
const { LiveConsensusEngine } = require('../../../src/domain/session/LiveConsensusEngine');
const { LiveRiskEscalationEngine } = require('../../../src/domain/session/LiveRiskEscalationEngine');

function createPipeline(scores) {
  const update = new IncrementalSessionUpdateEngine();
  const initial = update.createInitialState('paper-session-risk', scores.rounds || [1, 2, 3, 4, 5, 6]);

  assert.equal(initial.ok, true);

  const snapshotResult = new LiveContextSnapshotEngine({
    recentWindowSize: 6,
    zeroPressureThreshold: 2,
    repeatPressureThreshold: 3
  }).compose({
    sessionState: initial.value,
    tableContextScore: scores.tableContextScore,
    operatorReadinessScore: scores.operatorReadinessScore,
    supervisionRiskScore: scores.supervisionRiskScore
  });

  assert.equal(snapshotResult.ok, true);

  const snapshot = {
    ...snapshotResult.value,
    livePressureScore: scores.livePressureScore,
    pressureBand: scores.pressureBand || snapshotResult.value.pressureBand
  };

  const consensus = new LiveConsensusEngine().evaluate({ snapshot });

  return {
    snapshot,
    consensus
  };
}

test('keeps risk normal for stable accepted live consensus', () => {
  const pipeline = createPipeline({
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    supervisionRiskScore: 0.1,
    livePressureScore: 0.1,
    pressureBand: 'STABLE'
  });

  const risk = new LiveRiskEscalationEngine().evaluate(pipeline);

  assert.equal(risk.status, 'LIVE_RISK_STABLE');
  assert.equal(risk.escalationActive, false);
  assert.equal(risk.level, 'NORMAL');
  assert.equal(risk.paperGate, 'PAPER_AUTHORIZED');
  assert.equal(risk.liveGate, 'BLOCKED');
  assert.equal(risk.productionMoneyAllowed, false);
  assert.equal(risk.liveMoneyAuthorized, false);
});

test('raises watch level for moderate pressure', () => {
  const pipeline = createPipeline({
    tableContextScore: 0.8,
    operatorReadinessScore: 0.8,
    supervisionRiskScore: 0.35,
    livePressureScore: 0.45,
    pressureBand: 'WATCH'
  });

  const risk = new LiveRiskEscalationEngine().evaluate(pipeline);

  assert.equal(risk.status, 'LIVE_RISK_ESCALATED');
  assert.equal(risk.escalationActive, true);
  assert.equal(risk.level, 'WATCH');
  assert.ok(risk.reasons.includes('snapshot_pressure_watch'));
  assert.ok(risk.reasons.includes('live_pressure_watch'));
  assert.equal(risk.paperGate, 'PAPER_AUTHORIZED');
});

test('raises critical level when consensus is blocked', () => {
  const pipeline = createPipeline({
    tableContextScore: 0.8,
    operatorReadinessScore: 0.3,
    supervisionRiskScore: 0.2,
    livePressureScore: 0.2,
    pressureBand: 'STABLE'
  });

  const risk = new LiveRiskEscalationEngine().evaluate(pipeline);

  assert.equal(risk.status, 'LIVE_RISK_ESCALATED');
  assert.equal(risk.escalationActive, true);
  assert.equal(risk.level, 'CRITICAL');
  assert.ok(risk.reasons.includes('live_consensus_not_accepted'));
  assert.ok(risk.reasons.includes('live_consensus_blocked'));
  assert.equal(risk.paperGate, 'BLOCKED');
});

test('raises critical level for critical snapshot pressure', () => {
  const pipeline = createPipeline({
    rounds: [9, 9, 9, 0, 0, 9],
    tableContextScore: 0.2,
    operatorReadinessScore: 0.2,
    supervisionRiskScore: 0.95,
    livePressureScore: 0.9,
    pressureBand: 'CRITICAL'
  });

  const risk = new LiveRiskEscalationEngine().evaluate(pipeline);

  assert.equal(risk.level, 'CRITICAL');
  assert.equal(risk.paperGate, 'BLOCKED');
  assert.ok(risk.reasons.includes('snapshot_pressure_critical'));
  assert.ok(risk.reasons.includes('live_pressure_critical'));
});

test('raises critical on live money invariant violation', () => {
  const pipeline = createPipeline({
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    supervisionRiskScore: 0.1,
    livePressureScore: 0.1,
    pressureBand: 'STABLE'
  });

  const risk = new LiveRiskEscalationEngine().evaluate({
    snapshot: {
      ...pipeline.snapshot,
      liveGate: 'OPEN',
      productionMoneyAllowed: true,
      liveMoneyAuthorized: true
    },
    consensus: pipeline.consensus
  });

  assert.equal(risk.level, 'CRITICAL');
  assert.equal(risk.productionMoneyAllowed, false);
  assert.equal(risk.liveMoneyAuthorized, false);
  assert.equal(risk.liveGate, 'BLOCKED');
  assert.ok(risk.reasons.includes('snapshot_live_gate_must_remain_blocked'));
  assert.ok(risk.reasons.includes('snapshot_production_money_must_remain_disabled'));
  assert.ok(risk.reasons.includes('snapshot_live_money_must_remain_disabled'));
});

test('carries previous escalation pressure deterministically', () => {
  const pipeline = createPipeline({
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    supervisionRiskScore: 0.1,
    livePressureScore: 0.1,
    pressureBand: 'STABLE'
  });

  const engine = new LiveRiskEscalationEngine();

  const withoutCarry = engine.evaluate(pipeline);
  const withCarry = engine.evaluate({
    ...pipeline,
    previousEscalation: {
      level: 'CRITICAL'
    }
  });

  assert.ok(withCarry.escalationScore > withoutCarry.escalationScore);
  assert.ok(withCarry.reasons.includes('previous_escalation_carry'));
});

test('rejects missing input safely as critical blocked risk', () => {
  const risk = new LiveRiskEscalationEngine().evaluate(null);

  assert.equal(risk.level, 'CRITICAL');
  assert.equal(risk.paperGate, 'BLOCKED');
  assert.ok(risk.reasons.includes('input_not_object'));
});

test('is deterministic and idempotent', () => {
  const pipeline = createPipeline({
    tableContextScore: 0.8,
    operatorReadinessScore: 0.8,
    supervisionRiskScore: 0.2,
    livePressureScore: 0.2,
    pressureBand: 'STABLE'
  });

  const engine = new LiveRiskEscalationEngine();
  const first = engine.evaluate(pipeline);
  const second = engine.evaluate(pipeline);

  assert.deepEqual(first, second);
});

test('validates configuration defensively', () => {
  assert.throws(
    () => new LiveRiskEscalationEngine({
      watchThreshold: 0.7,
      escalatedThreshold: 0.6,
      criticalThreshold: 0.9
    }),
    /risk escalation thresholds/
  );

  assert.throws(
    () => new LiveRiskEscalationEngine({ maxPreviousEscalationCarry: 2 }),
    /maxPreviousEscalationCarry/
  );
});
