'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { StrategyResultLedgerEngine } = require('../../../src/domain/strategy/StrategyResultLedgerEngine');
const { StrategyCooldownEngine } = require('../../../src/domain/strategy/StrategyCooldownEngine');
const { StrategyRecoveryEngine } = require('../../../src/domain/strategy/StrategyRecoveryEngine');
const { StrategyCompatibilityEngine } = require('../../../src/domain/strategy/StrategyCompatibilityEngine');

function availableRecovery() {
  const ledgerEngine = new StrategyResultLedgerEngine();
  const created = ledgerEngine.createEmptyLedger('fusion-reduzida', 'paper-session-compatibility');

  assert.equal(created.ok, true);

  const cooldown = new StrategyCooldownEngine().evaluate({
    ledger: created.value,
    currentRoundIndex: 0
  });

  assert.equal(cooldown.status, 'STRATEGY_AVAILABLE');

  const recovery = new StrategyRecoveryEngine().evaluate({
    ledger: created.value,
    cooldownDecision: cooldown,
    contextRecoveryScore: 1,
    riskScore: 0
  });

  assert.equal(recovery.status, 'STRATEGY_RECOVERY_APPROVED');
  return recovery;
}

test('marks strategy as paper compatible when all components are strong', () => {
  const compatibility = new StrategyCompatibilityEngine().evaluate({
    strategyId: 'fusion-reduzida',
    recoveryDecision: availableRecovery(),
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    liveConsensusScore: 0.9,
    riskScore: 0.1,
    strategyDoctrineScore: 0.9,
    memoryTrustScore: 0.8
  });

  assert.equal(compatibility.status, 'PAPER_COMPATIBLE');
  assert.equal(compatibility.compatible, true);
  assert.equal(compatibility.action, 'ALLOW_PAPER_EVALUATION');
  assert.equal(compatibility.paperGate, 'PAPER_AUTHORIZED');
  assert.equal(compatibility.liveGate, 'BLOCKED');
  assert.equal(compatibility.productionMoneyAllowed, false);
  assert.equal(compatibility.liveMoneyAuthorized, false);
});

test('marks strategy as observe when score is moderate', () => {
  const compatibility = new StrategyCompatibilityEngine().evaluate({
    strategyId: 'fusion-reduzida',
    recoveryDecision: availableRecovery(),
    tableContextScore: 0.7,
    operatorReadinessScore: 0.7,
    liveConsensusScore: 0.65,
    riskScore: 0.25,
    strategyDoctrineScore: 0.55,
    memoryTrustScore: 0.5
  });

  assert.equal(compatibility.status, 'OBSERVE');
  assert.equal(compatibility.compatible, false);
  assert.equal(compatibility.action, 'WAIT');
});

test('marks strategy as do not use when score is weak', () => {
  const compatibility = new StrategyCompatibilityEngine().evaluate({
    strategyId: 'fusion-reduzida',
    recoveryDecision: availableRecovery(),
    tableContextScore: 0.3,
    operatorReadinessScore: 0.6,
    liveConsensusScore: 0.4,
    riskScore: 0.2,
    strategyDoctrineScore: 0.3,
    memoryTrustScore: 0.5
  });

  assert.equal(compatibility.status, 'DO_NOT_USE');
  assert.equal(compatibility.action, 'DO_NOT_USE');
});

test('blocks strategy when recovery is not approved', () => {
  const recovery = {
    status: 'STRATEGY_RECOVERY_WAIT_COOLDOWN',
    strategyRecovered: false,
    strategyAvailableForEvaluation: false,
    strategyGate: 'COOLDOWN',
    liveGate: 'BLOCKED',
    productionMoneyAllowed: false,
    liveMoneyAuthorized: false
  };

  const compatibility = new StrategyCompatibilityEngine().evaluate({
    strategyId: 'fusion-reduzida',
    recoveryDecision: recovery,
    tableContextScore: 1,
    operatorReadinessScore: 1,
    liveConsensusScore: 1,
    riskScore: 0,
    strategyDoctrineScore: 1,
    memoryTrustScore: 1
  });

  assert.equal(compatibility.status, 'BLOCKED');
  assert.ok(compatibility.reasons.includes('strategy_not_recovered_for_evaluation'));
});

test('blocks strategy when supervisor veto is active', () => {
  const compatibility = new StrategyCompatibilityEngine().evaluate({
    strategyId: 'fusion-reduzida',
    recoveryDecision: availableRecovery(),
    tableContextScore: 1,
    operatorReadinessScore: 1,
    liveConsensusScore: 1,
    riskScore: 0,
    strategyDoctrineScore: 1,
    memoryTrustScore: 1,
    supervisorVetoActive: true
  });

  assert.equal(compatibility.status, 'BLOCKED');
  assert.ok(compatibility.reasons.includes('supervisor_veto_active'));
});

test('blocks strategy when risk is above strategy limit', () => {
  const compatibility = new StrategyCompatibilityEngine().evaluate({
    strategyId: 'fusion-reduzida',
    recoveryDecision: availableRecovery(),
    tableContextScore: 1,
    operatorReadinessScore: 1,
    liveConsensusScore: 1,
    riskScore: 0.8,
    strategyDoctrineScore: 1,
    memoryTrustScore: 1
  });

  assert.equal(compatibility.status, 'BLOCKED');
  assert.ok(compatibility.reasons.includes('risk_above_strategy_limit'));
});

test('blocks invariant violation from recovery decision', () => {
  const recovery = {
    ...availableRecovery(),
    liveGate: 'OPEN',
    productionMoneyAllowed: true,
    liveMoneyAuthorized: true
  };

  const compatibility = new StrategyCompatibilityEngine().evaluate({
    strategyId: 'fusion-reduzida',
    recoveryDecision: recovery,
    tableContextScore: 1,
    operatorReadinessScore: 1,
    liveConsensusScore: 1,
    riskScore: 0,
    strategyDoctrineScore: 1,
    memoryTrustScore: 1
  });

  assert.equal(compatibility.status, 'BLOCKED');
  assert.equal(compatibility.liveGate, 'BLOCKED');
  assert.equal(compatibility.productionMoneyAllowed, false);
  assert.equal(compatibility.liveMoneyAuthorized, false);
  assert.ok(compatibility.reasons.includes('recovery_live_gate_must_remain_blocked'));
});

test('is deterministic and idempotent', () => {
  const engine = new StrategyCompatibilityEngine();
  const input = {
    strategyId: 'fusion-reduzida',
    recoveryDecision: availableRecovery(),
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    liveConsensusScore: 0.9,
    riskScore: 0.1,
    strategyDoctrineScore: 0.9,
    memoryTrustScore: 0.8
  };

  const first = engine.evaluate(input);
  const second = engine.evaluate(input);

  assert.deepEqual(first, second);
});

test('validates configuration defensively', () => {
  assert.throws(
    () => new StrategyCompatibilityEngine({ observableThreshold: -1 }),
    /observableThreshold/
  );

  assert.throws(
    () => new StrategyCompatibilityEngine({
      observableThreshold: 0.8,
      compatibleThreshold: 0.7
    }),
    /compatibleThreshold/
  );
});
