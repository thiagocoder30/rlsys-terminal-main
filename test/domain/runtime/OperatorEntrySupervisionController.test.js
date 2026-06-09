'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OperatorEntrySupervisionController,
} = require('../../../dist/application/runtime/OperatorEntrySupervisionController.js');

function input(overrides = {}) {
  return {
    supervisionId: 'supervision-281',
    generatedAtEpochMs: 1760000000000,
    sessionId: 'paper-session-281',
    strategyName: 'Triplicação',
    hudRecommendation: 'ENTRAR',
    hudRenderedText: 'RL.SYS CORE — PAPER HUD\nRecomendação: ENTRAR ✅',
    operatorDecision: 'CONFIRMAR',
    operatorNote: 'Operador confirmou entrada PAPER supervisionada.',
    requestedStake: 3.5,
    confidencePercent: 92,
    evidence: ['BANKROLL_SAFE', 'DAILY_LOCK_RELEASED', 'TRIPLICACAO_FAVORABLE'],
    ...overrides,
  };
}

test('operator entry supervision authorizes PAPER entry when HUD says enter and operator confirms', () => {
  const controller = new OperatorEntrySupervisionController();

  const result = controller.supervise(input());

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'PAPER_ENTRY_AUTHORIZED');
  assert.equal(result.value.paperEntryAuthorized, true);
  assert.equal(result.value.authorizedStake, 3.5);
  assert.match(result.value.renderedText, /PAPER Entry Authorized: true/);
});

test('operator entry supervision rejects when operator refuses favorable HUD', () => {
  const controller = new OperatorEntrySupervisionController();

  const result = controller.supervise(input({
    operatorDecision: 'RECUSAR',
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'PAPER_ENTRY_REJECTED_BY_OPERATOR');
  assert.equal(result.value.paperEntryAuthorized, false);
  assert.equal(result.value.authorizedStake, 0);
});

test('operator entry supervision denies entry when HUD says wait even if operator confirms', () => {
  const controller = new OperatorEntrySupervisionController();

  const result = controller.supervise(input({
    hudRecommendation: 'AGUARDAR',
    operatorDecision: 'CONFIRMAR',
    hudRenderedText: 'RL.SYS CORE — PAPER HUD\nRecomendação: AGUARDAR ❌',
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'PAPER_ENTRY_DENIED_BY_HUD');
  assert.equal(result.value.paperEntryAuthorized, false);
  assert.equal(result.value.authorizedStake, 0);
});

test('operator entry supervision validates required fields', () => {
  const controller = new OperatorEntrySupervisionController();

  const result = controller.supervise(input({
    supervisionId: '',
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_OPERATOR_ENTRY_SUPERVISION_INPUT');
});

test('operator entry supervision rejects invalid confidence', () => {
  const controller = new OperatorEntrySupervisionController();

  const result = controller.supervise(input({
    confidencePercent: 101,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_OPERATOR_ENTRY_SUPERVISION_INPUT');
});

test('operator entry supervision preserves supervised PAPER-only semantics', () => {
  const controller = new OperatorEntrySupervisionController();

  const result = controller.supervise(input());

  assert.equal(result.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticBetExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'liveMoneyAuthorization'), false);
  assert.equal(result.value.operatorDecisionRequired, true);
  assert.equal(result.value.supervisedRecommendationOnly, true);
  assert.equal(result.value.institutionalAnalysisMode, true);
  assert.equal(result.value.paperOnly, true);
});
