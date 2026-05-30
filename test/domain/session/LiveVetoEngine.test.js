'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { IncrementalSessionUpdateEngine } = require('../../../src/domain/session/IncrementalSessionUpdateEngine');
const { LiveContextSnapshotEngine } = require('../../../src/domain/session/LiveContextSnapshotEngine');
const { LiveConsensusEngine } = require('../../../src/domain/session/LiveConsensusEngine');
const { LiveRiskEscalationEngine } = require('../../../src/domain/session/LiveRiskEscalationEngine');
const { LiveVetoEngine } = require('../../../src/domain/session/LiveVetoEngine');

function createRiskPipeline(scores) {
  const update = new IncrementalSessionUpdateEngine();
  const initial = update.createInitialState('paper-session-veto', scores.rounds || [1, 2, 3, 4, 5, 6]);

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
  const riskEscalation = new LiveRiskEscalationEngine().evaluate({ snapshot, consensus });

  return {
    snapshot,
    consensus,
    riskEscalation
  };
}

test('keeps veto clear for normal stable PAPER session risk', () => {
  const pipeline = createRiskPipeline({
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    supervisionRiskScore: 0.1,
    livePressureScore: 0.1,
    pressureBand: 'STABLE'
  });

  const veto = new LiveVetoEngine().evaluate({
    riskEscalation: pipeline.riskEscalation
  });

  assert.equal(veto.status, 'LIVE_VETO_CLEAR');
  assert.equal(veto.vetoActive, false);
  assert.equal(veto.shouldInterruptSession, false);
  assert.equal(veto.canContinuePaperSession, true);
  assert.equal(veto.paperGate, 'PAPER_AUTHORIZED');
  assert.equal(veto.liveGate, 'BLOCKED');
  assert.equal(veto.productionMoneyAllowed, false);
  assert.equal(veto.liveMoneyAuthorized, false);
});

test('keeps PAPER session running under WATCH but requires monitoring', () => {
  const veto = new LiveVetoEngine().evaluate({
    riskEscalation: {
      status: 'LIVE_RISK_ESCALATED',
      escalationActive: true,
      level: 'WATCH',
      escalationScore: 0.45,
      reasons: ['snapshot_pressure_watch'],
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    }
  });

  assert.equal(veto.status, 'LIVE_VETO_CLEAR');
  assert.equal(veto.vetoActive, false);
  assert.equal(veto.canContinuePaperSession, true);
  assert.ok(veto.reasons.includes('watch_monitoring_required'));
});

test('activates veto for critical risk escalation', () => {
  const pipeline = createRiskPipeline({
    rounds: [9, 9, 9, 0, 0, 9],
    tableContextScore: 0.2,
    operatorReadinessScore: 0.2,
    supervisionRiskScore: 0.95,
    livePressureScore: 0.9,
    pressureBand: 'CRITICAL'
  });

  const veto = new LiveVetoEngine().evaluate({
    riskEscalation: pipeline.riskEscalation
  });

  assert.equal(veto.status, 'LIVE_VETO_ACTIVE');
  assert.equal(veto.vetoActive, true);
  assert.equal(veto.shouldInterruptSession, true);
  assert.equal(veto.canContinuePaperSession, false);
  assert.equal(veto.paperGate, 'BLOCKED');
  assert.equal(veto.liveGate, 'BLOCKED');
  assert.equal(veto.productionMoneyAllowed, false);
  assert.equal(veto.liveMoneyAuthorized, false);
  assert.ok(veto.reasons.includes('critical_risk_level'));
});

test('activates veto when live consensus is blocked', () => {
  const pipeline = createRiskPipeline({
    tableContextScore: 0.8,
    operatorReadinessScore: 0.3,
    supervisionRiskScore: 0.2,
    livePressureScore: 0.2,
    pressureBand: 'STABLE'
  });

  const veto = new LiveVetoEngine().evaluate({
    riskEscalation: pipeline.riskEscalation
  });

  assert.equal(veto.status, 'LIVE_VETO_ACTIVE');
  assert.equal(veto.vetoActive, true);
  assert.ok(veto.reasons.includes('live_consensus_blocked'));
});

test('activates veto on manual override attempt', () => {
  const veto = new LiveVetoEngine().evaluate({
    manualOverrideRequested: true,
    riskEscalation: {
      status: 'LIVE_RISK_STABLE',
      escalationActive: false,
      level: 'NORMAL',
      escalationScore: 0.1,
      reasons: [],
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    }
  });

  assert.equal(veto.status, 'LIVE_VETO_ACTIVE');
  assert.equal(veto.vetoActive, true);
  assert.ok(veto.reasons.includes('manual_override_rejected'));
});

test('activates veto on live money invariant violation', () => {
  const veto = new LiveVetoEngine().evaluate({
    riskEscalation: {
      status: 'LIVE_RISK_STABLE',
      escalationActive: false,
      level: 'NORMAL',
      escalationScore: 0.1,
      reasons: [],
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'OPEN',
      productionMoneyAllowed: true,
      liveMoneyAuthorized: true
    }
  });

  assert.equal(veto.status, 'LIVE_VETO_ACTIVE');
  assert.equal(veto.paperGate, 'BLOCKED');
  assert.equal(veto.liveGate, 'BLOCKED');
  assert.equal(veto.productionMoneyAllowed, false);
  assert.equal(veto.liveMoneyAuthorized, false);
  assert.ok(veto.reasons.includes('risk_live_gate_must_remain_blocked'));
  assert.ok(veto.reasons.includes('risk_production_money_must_remain_disabled'));
  assert.ok(veto.reasons.includes('risk_live_money_must_remain_disabled'));
});

test('rejects missing input safely as active veto', () => {
  const veto = new LiveVetoEngine().evaluate(null);

  assert.equal(veto.status, 'LIVE_VETO_ACTIVE');
  assert.equal(veto.vetoActive, true);
  assert.equal(veto.paperGate, 'BLOCKED');
  assert.ok(veto.reasons.includes('input_not_object'));
});

test('is deterministic and idempotent', () => {
  const engine = new LiveVetoEngine();
  const input = {
    riskEscalation: {
      status: 'LIVE_RISK_STABLE',
      escalationActive: false,
      level: 'NORMAL',
      escalationScore: 0.1,
      reasons: [],
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    }
  };

  const first = engine.evaluate(input);
  const second = engine.evaluate(input);

  assert.deepEqual(first, second);
});

test('validates configuration defensively', () => {
  assert.throws(
    () => new LiveVetoEngine({ escalatedWatchThreshold: -1 }),
    /escalatedWatchThreshold/
  );

  assert.throws(
    () => new LiveVetoEngine({
      escalatedWatchThreshold: 0.8,
      criticalVetoThreshold: 0.7
    }),
    /criticalVetoThreshold/
  );
});
