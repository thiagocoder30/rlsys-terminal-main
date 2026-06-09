'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LocalizedDailyRiskLockPresenter,
} = require('../../../dist/application/runtime/LocalizedDailyRiskLockPresenter.js');

const generatedAtEpochMs = 1760000000000;
const unlockAtEpochMs = 1760054400000;

function gate(overrides = {}) {
  return {
    status: 'OPERATION_BLOCKED_BY_DAILY_RISK_LOCK',
    allowed: false,
    intent: 'START',
    recoveryStatus: 'RECOVERY_LOCK_ACTIVE',
    isDailyRiskLocked: true,
    lockId: 'daily-lock-277',
    lockReason: 'STOP_LOSS_REACHED',
    unlockAtEpochMs,
    operatorSummary: 'Operação bloqueada.',
    reasons: ['DAILY_RISK_LOCK_ACTIVE'],
    operatorDecisionRequired: true,
    supervisedRecommendationOnly: true,
    institutionalAnalysisMode: true,
    ...overrides,
  };
}

test('localized daily risk lock presenter renders stop loss block in pt-BR', () => {
  const presenter = new LocalizedDailyRiskLockPresenter();

  const result = presenter.present({
    presentationId: 'presentation-277',
    generatedAtEpochMs,
    gate: gate(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'PRESENTATION_BLOCKED');
  assert.equal(result.value.title, 'Sessão PAPER bloqueada');
  assert.equal(result.value.reasonLabel, 'Stop Loss diário atingido');
  assert.match(result.value.mainMessage, /banca deve ser protegida/);
  assert.match(result.value.renderedText, /TRAVA DIÁRIA DE BANCA/);
  assert.match(result.value.renderedText, /Stop Loss diário atingido/);
});

test('localized daily risk lock presenter renders stop win block in pt-BR', () => {
  const presenter = new LocalizedDailyRiskLockPresenter();

  const result = presenter.present({
    presentationId: 'presentation-277-win',
    generatedAtEpochMs,
    gate: gate({
      lockReason: 'STOP_WIN_REACHED',
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'PRESENTATION_BLOCKED');
  assert.equal(result.value.reasonLabel, 'Stop Win diário atingido');
  assert.match(result.value.mainMessage, /lucro deve ser preservado/);
});

test('localized daily risk lock presenter allows operation when no daily lock exists', () => {
  const presenter = new LocalizedDailyRiskLockPresenter();

  const result = presenter.present({
    presentationId: 'presentation-277-allowed',
    generatedAtEpochMs,
    gate: gate({
      status: 'OPERATION_ALLOWED',
      allowed: true,
      recoveryStatus: 'RECOVERY_NO_LOCK',
      isDailyRiskLocked: false,
      lockId: null,
      lockReason: null,
      unlockAtEpochMs: null,
      reasons: [],
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'PRESENTATION_ALLOWED');
  assert.equal(result.value.title, 'Operação permitida');
  assert.equal(result.value.reasonLabel, 'Sem bloqueio diário ativo');
  assert.match(result.value.renderedText, /Operação permitida/);
});

test('localized daily risk lock presenter supports informational command during active lock', () => {
  const presenter = new LocalizedDailyRiskLockPresenter();

  const result = presenter.present({
    presentationId: 'presentation-277-info',
    generatedAtEpochMs,
    gate: gate({
      status: 'OPERATION_ALLOWED',
      allowed: true,
      intent: 'STATUS',
      isDailyRiskLocked: true,
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'PRESENTATION_INFORMATIONAL_LOCK');
  assert.equal(result.value.title, 'Trava diária ativa');
  assert.match(result.value.actionLabel, /Consultar status/);
});

test('localized daily risk lock presenter rejects invalid presentation id', () => {
  const presenter = new LocalizedDailyRiskLockPresenter();

  const result = presenter.present({
    presentationId: '',
    generatedAtEpochMs,
    gate: gate(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_LOCALIZED_DAILY_RISK_LOCK_PRESENTER_INPUT');
  assert.equal(result.error.stage, 'VALIDATION');
});

test('localized daily risk lock presenter rejects broken gate semantics', () => {
  const presenter = new LocalizedDailyRiskLockPresenter();

  const result = presenter.present({
    presentationId: 'presentation-277-broken',
    generatedAtEpochMs,
    gate: {
      ...gate(),
      supervisedRecommendationOnly: false,
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_LOCALIZED_DAILY_RISK_LOCK_PRESENTER_INPUT');
});

test('localized daily risk lock presenter preserves supervised recommendation semantics', () => {
  const presenter = new LocalizedDailyRiskLockPresenter();

  const result = presenter.present({
    presentationId: 'presentation-277-semantics',
    generatedAtEpochMs,
    gate: gate(),
  });

  assert.equal(result.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticBetExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'liveMoneyAuthorization'), false);
  assert.equal(result.value.operatorDecisionRequired, true);
  assert.equal(result.value.supervisedRecommendationOnly, true);
  assert.equal(result.value.institutionalAnalysisMode, true);
});
