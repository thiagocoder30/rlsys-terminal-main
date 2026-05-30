'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { StrategyResultLedgerEngine } = require('../../../src/domain/strategy/StrategyResultLedgerEngine');
const { StrategyCooldownEngine } = require('../../../src/domain/strategy/StrategyCooldownEngine');
const { StrategyRecoveryEngine } = require('../../../src/domain/strategy/StrategyRecoveryEngine');
const { StrategyCompatibilityEngine } = require('../../../src/domain/strategy/StrategyCompatibilityEngine');
const { StrategyRecommendationEngine } = require('../../../src/domain/strategy/StrategyRecommendationEngine');
const { StrategyExplainabilityEngine } = require('../../../src/domain/strategy/StrategyExplainabilityEngine');
const { StrategyStatusPresenter } = require('../../../src/domain/strategy/StrategyStatusPresenter');

function buildExplanation() {
  const ledgerEngine = new StrategyResultLedgerEngine();
  const created = ledgerEngine.createEmptyLedger('fusion-reduzida', 'paper-session-presenter');

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

  const recommendation = new StrategyRecommendationEngine().recommend({
    compatibilityDecision: compatibility
  });

  const explanation = new StrategyExplainabilityEngine().explain({
    recommendation
  });

  assert.equal(explanation.status, 'STRATEGY_EXPLANATION_READY');
  return explanation;
}

test('presents execution authorized status card', () => {
  const presenter = new StrategyStatusPresenter();
  const view = presenter.present({
    explanation: buildExplanation()
  });

  assert.equal(view.status, 'STRATEGY_STATUS_READY');
  assert.equal(view.strategyId, 'fusion-reduzida');
  assert.equal(view.title, 'Fusion Reduzida');
  assert.equal(view.displayStatus, 'EXECUCAO_AUTORIZADA');
  assert.equal(view.displayAction, 'ENTRAR');
  assert.equal(view.actionPriority, 'HIGH');
  assert.ok(view.scorePercent >= 78);
  assert.ok(view.card.includes('Ação: ENTRAR'));
  assert.ok(view.card.includes('Live Money: BLOQUEADO'));
  assert.equal(view.liveGate, 'BLOCKED');
  assert.equal(view.productionMoneyAllowed, false);
  assert.equal(view.liveMoneyAuthorized, false);
});

test('presents observe status card', () => {
  const presenter = new StrategyStatusPresenter();
  const view = presenter.present({
    explanation: {
      status: 'STRATEGY_EXPLANATION_READY',
      strategyId: 'fusion-reduzida',
      recommendationStatus: 'OBSERVE',
      operatorAction: 'AGUARDAR',
      userAction: 'AGUARDAR',
      severity: 'WARNING',
      summary: 'Aguardar confirmação contextual.',
      operatorMessage: 'AGUARDAR.',
      recommendationScore: 0.65,
      reasons: ['strategy_requires_more_context_confirmation'],
      auditTags: ['strategy_explainability'],
      strategyGate: 'OBSERVE',
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    }
  });

  assert.equal(view.displayStatus, 'OBSERVAR');
  assert.equal(view.displayAction, 'AGUARDAR');
  assert.equal(view.actionPriority, 'MEDIUM');
  assert.equal(view.scorePercent, 65);
});

test('presents blocked status card', () => {
  const presenter = new StrategyStatusPresenter();
  const view = presenter.present({
    explanation: {
      status: 'STRATEGY_EXPLANATION_READY',
      strategyId: 'fusion-reduzida',
      recommendationStatus: 'DO_NOT_USE',
      operatorAction: 'NAO_UTILIZAR',
      userAction: 'NAO_UTILIZAR',
      severity: 'CRITICAL',
      summary: 'Estratégia não autorizada.',
      operatorMessage: 'NÃO UTILIZAR.',
      recommendationScore: 0.3,
      reasons: ['strategy_not_authorized_in_current_context'],
      auditTags: ['strategy_explainability'],
      strategyGate: 'BLOCKED',
      operationalGate: 'PAPER_AUTHORIZED',
      paperGate: 'PAPER_AUTHORIZED',
      liveGate: 'BLOCKED',
      productionMoneyAllowed: false,
      liveMoneyAuthorized: false
    }
  });

  assert.equal(view.displayStatus, 'BLOQUEADO');
  assert.equal(view.displayAction, 'NAO_UTILIZAR');
  assert.equal(view.actionPriority, 'BLOCKING');
  assert.equal(view.scorePercent, 30);
});

test('blocks status on invariant violation', () => {
  const presenter = new StrategyStatusPresenter();
  const view = presenter.present({
    explanation: {
      ...buildExplanation(),
      liveGate: 'OPEN',
      productionMoneyAllowed: true,
      liveMoneyAuthorized: true
    }
  });

  assert.equal(view.status, 'STRATEGY_STATUS_BLOCKED');
  assert.equal(view.displayStatus, 'BLOQUEADO');
  assert.equal(view.displayAction, 'NAO_UTILIZAR');
  assert.equal(view.paperGate, 'BLOCKED');
  assert.equal(view.liveGate, 'BLOCKED');
  assert.equal(view.productionMoneyAllowed, false);
  assert.equal(view.liveMoneyAuthorized, false);
  assert.ok(view.reasons.includes('explanation_live_gate_must_remain_blocked'));
});

test('rejects missing input safely', () => {
  const presenter = new StrategyStatusPresenter();
  const view = presenter.present(null);

  assert.equal(view.status, 'STRATEGY_STATUS_BLOCKED');
  assert.equal(view.displayAction, 'NAO_UTILIZAR');
  assert.ok(view.reasons.includes('input_not_object'));
});

test('is deterministic and idempotent', () => {
  const presenter = new StrategyStatusPresenter();
  const input = {
    explanation: buildExplanation()
  };

  const first = presenter.present(input);
  const second = presenter.present(input);

  assert.deepEqual(first, second);
});
