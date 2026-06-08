'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OperatorLocalizationAdapter,
} = require('../../../dist/application/runtime/OperatorLocalizationAdapter.js');

test('operator localization adapter translates institutional decisions to pt-BR', () => {
  const adapter = new OperatorLocalizationAdapter();

  const result = adapter.localize({
    locale: 'pt-BR',
    tokens: ['PAPER_FAVORAVEL', 'OBSERVAR', 'NAO_UTILIZAR'],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.tokens[0].label, 'Favorável');
  assert.equal(result.value.tokens[1].label, 'Aguardar');
  assert.equal(result.value.tokens[2].label, 'Não utilizar');
  assert.equal(result.value.unknownTokens.length, 0);
});

test('operator localization adapter translates first paper session statuses', () => {
  const adapter = new OperatorLocalizationAdapter();

  const result = adapter.localize({
    locale: 'pt-BR',
    tokens: [
      'READY_FOR_FIRST_PAPER_SESSION',
      'WARMUP_REQUIRED',
      'SESSION_BLOCKED',
      'GUIDED_PACKAGE_READY',
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.tokens[0].label, 'Pronto para primeira sessão PAPER');
  assert.equal(result.value.tokens[1].label, 'Warmup obrigatório');
  assert.equal(result.value.tokens[2].label, 'Sessão bloqueada');
  assert.equal(result.value.tokens[3].label, 'Pacote guiado pronto');
});

test('operator localization adapter translates triplicacao pattern tokens', () => {
  const adapter = new OperatorLocalizationAdapter();

  const result = adapter.localize({
    locale: 'pt-BR',
    tokens: ['TC', 'NTC', 'TA', 'NTA', 'ZERO_DISCARDED', 'INSUFFICIENT_DATA'],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.tokens[0].label, 'Triplicação Contínua');
  assert.equal(result.value.tokens[1].label, 'Não Triplicação Contínua');
  assert.equal(result.value.tokens[4].label, 'Zero descartado');
  assert.equal(result.value.tokens[5].label, 'Dados insuficientes');
});

test('operator localization adapter preserves unknown tokens safely', () => {
  const adapter = new OperatorLocalizationAdapter();

  const result = adapter.localize({
    locale: 'pt-BR',
    tokens: ['CUSTOM_UNKNOWN_TOKEN'],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.tokens[0].token, 'CUSTOM_UNKNOWN_TOKEN');
  assert.equal(result.value.tokens[0].label, 'Custom unknown token');
  assert.equal(result.value.unknownTokens[0], 'CUSTOM_UNKNOWN_TOKEN');
});

test('operator localization adapter rejects unsupported locale', () => {
  const adapter = new OperatorLocalizationAdapter();

  const result = adapter.localize({
    locale: 'en-US',
    tokens: ['PAPER_FAVORAVEL'],
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_OPERATOR_LOCALIZATION_INPUT');
  assert.equal(result.error.stage, 'VALIDATION');
});

test('operator localization adapter rejects empty token', () => {
  const adapter = new OperatorLocalizationAdapter();

  const result = adapter.localize({
    locale: 'pt-BR',
    tokens: ['PAPER_FAVORAVEL', ''],
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_OPERATOR_LOCALIZATION_INPUT');
});

test('operator localization adapter preserves supervised recommendation semantics', () => {
  const adapter = new OperatorLocalizationAdapter();

  const result = adapter.localize({
    locale: 'pt-BR',
    tokens: ['GUIDED_PACKAGE_READY'],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.operatorDecisionRequired, true);
  assert.equal(result.value.supervisedRecommendationOnly, true);
  assert.equal(result.value.institutionalAnalysisMode, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticBetExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'liveMoneyAuthorization'), false);
});
