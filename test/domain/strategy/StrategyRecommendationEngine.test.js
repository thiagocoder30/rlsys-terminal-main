'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { StrategyResultLedgerEngine } = require('../../../src/domain/strategy/StrategyResultLedgerEngine');
const { StrategyCooldownEngine } = require('../../../src/domain/strategy/StrategyCooldownEngine');
const { StrategyRecoveryEngine } = require('../../../src/domain/strategy/StrategyRecoveryEngine');
const { StrategyCompatibilityEngine } = require('../../../src/domain/strategy/StrategyCompatibilityEngine');
const { StrategyRecommendationEngine } = require('../../../src/domain/strategy/StrategyRecommendationEngine');

function compatibleDecision() {
  const ledgerEngine = new StrategyResultLedgerEngine();
  const created = ledgerEngine.createEmptyLedger('fusion-reduzida', 'paper-session-recommendation');

  assert.equal(created.ok, true);

  const cooldown = new StrategyCooldownEngine().evaluate({
    ledger: created.value,
    currentRoundIndex: 0
  });

  const recovery = new StrategyRecoveryEngine().evaluate({
    ledger: created.value,
    cooldownDecision: cooldown,
    contextRecoveryScore: 1,
    riskScore: 0
  });

  const compatibility = new StrategyCompatibilityEngine().evaluate({
    strategyId: 'fusion-reduzida',
    recoveryDecision: recovery,
    tableContextScore: 0.9,
    operatorReadinessScore: 0.9,
    liveConsensusScore: 0.9,
    riskScore: 0.1,
    strategyDoctrineScore: 0.9,
    memoryTrustScore: 0.8
  });

  assert.equal(compatibility.status, 'PAPER_COMPATIBLE');
  return compatibility;
}

test('authorizes paper execution when compatibility is strong', () => {
  const recommendation = new StrategyRecommendationEngine().recommend({
    compatibilityDecision: compatibleDecision()
  });

  assert.equal(recommendation.status, 'EXECUTION_AUTHORIZED');
  assert.equal(recommendation.operatorAction, 'ENTRAR');
  assert.equal(recommendation.userAction, 'ENTRAR');
  assert.equal(recommendation.strategyGate, 'EXECUTION_AUTHORIZED');
  assert.equal(recommendation.paperGate, 'PAPER_AUTHORIZED');
  assert.equal(recommendation.liveGate, 'BLOCKED');
  assert.equal(recommendation.productionMoneyAllowed, false);
  assert.equal(recommendation.liveMoneyAuthorized, false);
});

test('returns observe action when strategy is observable only', () => {
  const recommendation = new StrategyRecommendationEngine().recommend({
    compatibilityDecision: {
      status: 'OBSERVE',
      compatible: false,
      strategyId: 'fusion-reduzida',
      compatibilityScore: 0.65,
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    }
  });

  assert.equal(recommendation.status, 'OBSERVE');
  assert.equal(recommendation.operatorAction, 'AGUARDAR');
  assert.equal(recommendation.userAction, 'AGUARDAR');
  assert.ok(recommendation.reasons.includes('strategy_observable_only'));
});

test('blocks recommendation when strategy is not compatible', () => {
  const recommendation = new StrategyRecommendationEngine().recommend({
    compatibilityDecision: {
      status: 'DO_NOT_USE',
      compatible: false,
      strategyId: 'fusion-reduzida',
      compatibilityScore: 0.3,
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    }
  });

  assert.equal(recommendation.status, 'DO_NOT_USE');
  assert.equal(recommendation.operatorAction, 'NAO_UTILIZAR');
  assert.ok(recommendation.reasons.includes('strategy_not_compatible'));
});

test('blocks recommendation on supervisor veto', () => {
  const recommendation = new StrategyRecommendationEngine().recommend({
    compatibilityDecision: compatibleDecision(),
    supervisorVetoActive: true
  });

  assert.equal(recommendation.status, 'DO_NOT_USE');
  assert.equal(recommendation.operatorAction, 'NAO_UTILIZAR');
  assert.ok(recommendation.reasons.includes('supervisor_veto_active'));
});

test('blocks recommendation when session is interrupted', () => {
  const recommendation = new StrategyRecommendationEngine().recommend({
    compatibilityDecision: compatibleDecision(),
    sessionInterrupted: true
  });

  assert.equal(recommendation.status, 'DO_NOT_USE');
  assert.ok(recommendation.reasons.includes('paper_session_interrupted'));
});

test('blocks live money invariant violations', () => {
  const recommendation = new StrategyRecommendationEngine().recommend({
    compatibilityDecision: {
      ...compatibleDecision(),
      liveGate: 'OPEN',
      productionMoneyAllowed: true,
      liveMoneyAuthorized: true
    }
  });

  assert.equal(recommendation.status, 'DO_NOT_USE');
  assert.equal(recommendation.liveGate, 'BLOCKED');
  assert.equal(recommendation.productionMoneyAllowed, false);
  assert.equal(recommendation.liveMoneyAuthorized, false);
  assert.ok(recommendation.reasons.includes('compatibility_live_gate_must_remain_blocked'));
});

test('rejects missing input safely', () => {
  const recommendation = new StrategyRecommendationEngine().recommend(null);

  assert.equal(recommendation.status, 'BLOCKED');
  assert.equal(recommendation.operatorAction, 'NAO_UTILIZAR');
  assert.ok(recommendation.reasons.includes('input_not_object'));
});

test('is deterministic and idempotent', () => {
  const engine = new StrategyRecommendationEngine();
  const input = {
    compatibilityDecision: compatibleDecision()
  };

  const first = engine.recommend(input);
  const second = engine.recommend(input);

  assert.deepEqual(first, second);
});

test('validates configuration defensively', () => {
  assert.throws(
    () => new StrategyRecommendationEngine({ minObserveScore: -1 }),
    /minObserveScore/
  );

  assert.throws(
    () => new StrategyRecommendationEngine({
      minObserveScore: 0.8,
      minExecutionScore: 0.7
    }),
    /minExecutionScore/
  );
});
