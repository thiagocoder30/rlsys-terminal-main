'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OperatorDecisionPresentationAdapter,
} = require('../../../dist/application/runtime/OperatorDecisionPresentationAdapter.js');

test('operator decision presentation adapter presents favorable recommendation clearly', () => {
  const adapter = new OperatorDecisionPresentationAdapter();

  const result = adapter.present({
    strategyName: 'Triplicação',
    finalDecision: 'PAPER_FAVORAVEL',
    confidenceScore: 0.82,
    riskScore: 0.22,
    reasons: [
      'CONSENSO_INSTITUCIONAL_POSITIVO',
      'VOLATILIDADE_CONTROLADA',
    ],
    currentRoundIndex: 201,
    observedRounds: 200,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.strategyName, 'Triplicação');
  assert.equal(result.value.status, 'FAVORAVEL');
  assert.equal(result.value.confidencePercent, 82);
  assert.equal(result.value.riskLevel, 'CONTROLADO');
  assert.equal(result.value.actionLabel, 'CONSIDERAR_ENTRADA_MANUAL_SUPERVISIONADA');
  assert.equal(result.value.operatorDecisionRequired, true);
  assert.equal(result.value.supervisedRecommendationOnly, true);
  assert.equal(result.value.institutionalAnalysisMode, true);
  assert.equal(result.value.currentRoundIndex, 201);
  assert.equal(result.value.observedRounds, 200);
});

test('operator decision presentation adapter presents observe decision as wait', () => {
  const adapter = new OperatorDecisionPresentationAdapter();

  const result = adapter.present({
    strategyName: 'Triplicação',
    finalDecision: 'OBSERVAR',
    confidenceScore: 0.49,
    riskScore: 0.48,
    warnings: ['CONFIRMACAO_AINDA_FRACA'],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'AGUARDAR');
  assert.equal(result.value.confidencePercent, 49);
  assert.equal(result.value.riskLevel, 'MODERADO');
  assert.equal(result.value.actionLabel, 'AGUARDAR_NOVO_GIRO');
  assert.match(result.value.explanation, /não confirmou|Confiança atual/);
});

test('operator decision presentation adapter presents no-use decision with blockers', () => {
  const adapter = new OperatorDecisionPresentationAdapter();

  const result = adapter.present({
    strategyName: 'Triplicação',
    finalDecision: 'NAO_UTILIZAR',
    confidenceScore: 0.21,
    riskScore: 0.71,
    blockers: [
      'RISCO_CONTEXTUAL_ELEVADO',
      'PADRAO_NAO_CONFIRMADO',
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'NAO_UTILIZAR');
  assert.equal(result.value.confidencePercent, 21);
  assert.equal(result.value.riskLevel, 'ELEVADO');
  assert.equal(result.value.actionLabel, 'NAO_UTILIZAR_ESTRATEGIA_AGORA');
  assert.equal(result.value.blockers.length, 2);
  assert.match(result.value.explanation, /bloqueou/);
});

test('operator decision presentation adapter uses operator summary when available', () => {
  const adapter = new OperatorDecisionPresentationAdapter();

  const result = adapter.present({
    strategyName: 'Triplicação',
    finalDecision: 'PAPER_FAVORAVEL',
    operatorSummary: 'Resumo institucional customizado para operador.',
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.explanation, 'Resumo institucional customizado para operador.');
});

test('operator decision presentation adapter clamps percent confidence safely', () => {
  const adapter = new OperatorDecisionPresentationAdapter();

  const high = adapter.present({
    strategyName: 'Triplicação',
    finalDecision: 'PAPER_FAVORAVEL',
    confidenceScore: 140,
  });

  const low = adapter.present({
    strategyName: 'Triplicação',
    finalDecision: 'NAO_UTILIZAR',
    confidenceScore: -12,
  });

  assert.equal(high.ok, true);
  assert.equal(low.ok, true);
  assert.equal(high.value.confidencePercent, 100);
  assert.equal(low.value.confidencePercent, 0);
});

test('operator decision presentation adapter rejects invalid input', () => {
  const adapter = new OperatorDecisionPresentationAdapter();

  const result = adapter.present({
    strategyName: '',
    finalDecision: 'OBSERVAR',
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_OPERATOR_PRESENTATION_INPUT');
  assert.equal(result.error.stage, 'VALIDATION');
});

test('operator decision presentation adapter rejects invalid final decision', () => {
  const adapter = new OperatorDecisionPresentationAdapter();

  const result = adapter.present({
    strategyName: 'Triplicação',
    finalDecision: 'ENTRAR_AGORA',
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_OPERATOR_PRESENTATION_INPUT');
});

test('operator decision presentation adapter does not expose external execution semantics', () => {
  const adapter = new OperatorDecisionPresentationAdapter();

  const result = adapter.present({
    strategyName: 'Triplicação',
    finalDecision: 'PAPER_FAVORAVEL',
    confidenceScore: 0.8,
  });

  assert.equal(result.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticBetExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'liveMoneyAuthorization'), false);
  assert.equal(result.value.operatorDecisionRequired, true);
  assert.equal(result.value.supervisedRecommendationOnly, true);
});
