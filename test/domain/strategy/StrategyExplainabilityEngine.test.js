'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { StrategyResultLedgerEngine } = require('../../../src/domain/strategy/StrategyResultLedgerEngine');
const { StrategyCooldownEngine } = require('../../../src/domain/strategy/StrategyCooldownEngine');
const { StrategyRecoveryEngine } = require('../../../src/domain/strategy/StrategyRecoveryEngine');
const { StrategyCompatibilityEngine } = require('../../../src/domain/strategy/StrategyCompatibilityEngine');
const { StrategyRecommendationEngine } = require('../../../src/domain/strategy/StrategyRecommendationEngine');
const { StrategyExplainabilityEngine } = require('../../../src/domain/strategy/StrategyExplainabilityEngine');

function buildRecommendation() {
  const ledgerEngine = new StrategyResultLedgerEngine();
  const created = ledgerEngine.createEmptyLedger('fusion-reduzida', 'paper-session-explainability');

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

  const recommendation = new StrategyRecommendationEngine().recommend({
    compatibilityDecision: compatibility
  });

  assert.equal(recommendation.status, 'EXECUTION_AUTHORIZED');
  return recommendation;
}

test('explains execution authorized recommendation', () => {
  const explanation = new StrategyExplainabilityEngine().explain({
    recommendation: buildRecommendation()
  });

  assert.equal(explanation.status, 'STRATEGY_EXPLANATION_READY');
  assert.equal(explanation.strategyId, 'fusion-reduzida');
  assert.equal(explanation.recommendationStatus, 'EXECUTION_AUTHORIZED');
  assert.equal(explanation.operatorAction, 'ENTRAR');
  assert.equal(explanation.severity, 'INFO');
  assert.ok(explanation.summary.includes('execução PAPER autorizada'));
  assert.ok(explanation.operatorMessage.includes('ENTRAR'));
  assert.ok(explanation.reasons.includes('live_money_remains_blocked'));
  assert.equal(explanation.liveGate, 'BLOCKED');
  assert.equal(explanation.productionMoneyAllowed, false);
  assert.equal(explanation.liveMoneyAuthorized, false);
});

test('explains observe recommendation', () => {
  const explanation = new StrategyExplainabilityEngine().explain({
    recommendation: {
      status: 'OBSERVE',
      strategyId: 'fusion-reduzida',
      operatorAction: 'AGUARDAR',
      userAction: 'AGUARDAR',
      recommendationScore: 0.65,
      reasons: ['strategy_observable_only'],
      strategyGate: 'OBSERVE',
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    }
  });

  assert.equal(explanation.status, 'STRATEGY_EXPLANATION_READY');
  assert.equal(explanation.severity, 'WARNING');
  assert.equal(explanation.operatorAction, 'AGUARDAR');
  assert.ok(explanation.reasons.includes('strategy_requires_more_context_confirmation'));
});

test('explains do not use recommendation', () => {
  const explanation = new StrategyExplainabilityEngine().explain({
    recommendation: {
      status: 'DO_NOT_USE',
      strategyId: 'fusion-reduzida',
      operatorAction: 'NAO_UTILIZAR',
      userAction: 'NAO_UTILIZAR',
      recommendationScore: 0.3,
      reasons: ['strategy_not_compatible'],
      strategyGate: 'BLOCKED',
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    }
  });

  assert.equal(explanation.status, 'STRATEGY_EXPLANATION_READY');
  assert.equal(explanation.severity, 'CRITICAL');
  assert.equal(explanation.operatorAction, 'NAO_UTILIZAR');
  assert.ok(explanation.reasons.includes('strategy_not_authorized_in_current_context'));
});

test('blocks explanation on invariant violation', () => {
  const explanation = new StrategyExplainabilityEngine().explain({
    recommendation: {
      ...buildRecommendation(),
      liveGate: 'OPEN',
      productionMoneyAllowed: true,
      liveMoneyAuthorized: true
    }
  });

  assert.equal(explanation.status, 'STRATEGY_EXPLANATION_BLOCKED');
  assert.equal(explanation.paperGate, 'BLOCKED');
  assert.equal(explanation.liveGate, 'BLOCKED');
  assert.equal(explanation.productionMoneyAllowed, false);
  assert.equal(explanation.liveMoneyAuthorized, false);
  assert.ok(explanation.reasons.includes('recommendation_live_gate_must_remain_blocked'));
});

test('rejects missing input safely', () => {
  const explanation = new StrategyExplainabilityEngine().explain(null);

  assert.equal(explanation.status, 'STRATEGY_EXPLANATION_BLOCKED');
  assert.ok(explanation.reasons.includes('input_not_object'));
});

test('is deterministic and idempotent', () => {
  const engine = new StrategyExplainabilityEngine();
  const input = {
    recommendation: buildRecommendation()
  };

  const first = engine.explain(input);
  const second = engine.explain(input);

  assert.deepEqual(first, second);
});
