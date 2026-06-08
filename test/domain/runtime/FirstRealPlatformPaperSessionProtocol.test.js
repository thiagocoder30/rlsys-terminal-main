'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FirstRealPlatformPaperSessionProtocol,
} = require('../../../dist/application/runtime/FirstRealPlatformPaperSessionProtocol.js');

test('first real-platform paper session protocol approves controlled paper session', () => {
  const protocol = new FirstRealPlatformPaperSessionProtocol();

  const result = protocol.evaluate({
    sessionId: 'first-paper-session-265',
    strategyName: 'Triplicação',
    observedRounds: 120,
    favorableCount: 2,
    waitCount: 8,
    noUseCount: 1,
    elevatedRiskCount: 1,
    averageConfidencePercent: 68,
    operatorConfirmedManualMode: true,
    operatorConfirmedNoExternalIntegration: true,
    operatorConfirmedPaperTracking: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'READY_FOR_FIRST_PAPER_SESSION');
  assert.equal(result.value.canStartPaperSession, true);
  assert.equal(result.value.warmupComplete, true);
  assert.equal(result.value.blockers.length, 0);
  assert.equal(result.value.operatorDecisionRequired, true);
  assert.equal(result.value.supervisedRecommendationOnly, true);
  assert.equal(result.value.institutionalAnalysisMode, true);
});

test('first real-platform paper session protocol requires warmup', () => {
  const protocol = new FirstRealPlatformPaperSessionProtocol();

  const result = protocol.evaluate({
    sessionId: 'first-paper-session-265-warmup',
    strategyName: 'Triplicação',
    observedRounds: 40,
    favorableCount: 0,
    waitCount: 4,
    noUseCount: 1,
    elevatedRiskCount: 0,
    averageConfidencePercent: 48,
    operatorConfirmedManualMode: true,
    operatorConfirmedNoExternalIntegration: true,
    operatorConfirmedPaperTracking: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'WARMUP_REQUIRED');
  assert.equal(result.value.canStartPaperSession, false);
  assert.equal(result.value.warmupComplete, false);
  assert.ok(result.value.blockers.includes('WARMUP_MINIMO_NAO_CONCLUIDO'));
});

test('first real-platform paper session protocol blocks when confirmations are missing', () => {
  const protocol = new FirstRealPlatformPaperSessionProtocol();

  const result = protocol.evaluate({
    sessionId: 'first-paper-session-265-blocked',
    strategyName: 'Triplicação',
    observedRounds: 120,
    favorableCount: 1,
    waitCount: 8,
    noUseCount: 1,
    elevatedRiskCount: 0,
    averageConfidencePercent: 64,
    operatorConfirmedManualMode: false,
    operatorConfirmedNoExternalIntegration: false,
    operatorConfirmedPaperTracking: false,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'SESSION_BLOCKED');
  assert.equal(result.value.canStartPaperSession, false);
  assert.ok(result.value.blockers.includes('OPERADOR_NAO_CONFIRMOU_MODO_MANUAL'));
  assert.ok(result.value.blockers.includes('OPERADOR_NAO_CONFIRMOU_AUSENCIA_DE_INTEGRACAO_EXTERNA'));
  assert.ok(result.value.blockers.includes('OPERADOR_NAO_CONFIRMOU_REGISTRO_PAPER'));
});

test('first real-platform paper session protocol blocks excessive elevated risk', () => {
  const protocol = new FirstRealPlatformPaperSessionProtocol();

  const result = protocol.evaluate({
    sessionId: 'first-paper-session-265-risk',
    strategyName: 'Triplicação',
    observedRounds: 150,
    favorableCount: 2,
    waitCount: 8,
    noUseCount: 5,
    elevatedRiskCount: 3,
    averageConfidencePercent: 61,
    operatorConfirmedManualMode: true,
    operatorConfirmedNoExternalIntegration: true,
    operatorConfirmedPaperTracking: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'SESSION_BLOCKED');
  assert.ok(result.value.blockers.includes('RISCO_ELEVADO_EXCESSIVO_NA_SESSAO'));
});

test('first real-platform paper session protocol warns on low confidence and excessive favorable count', () => {
  const protocol = new FirstRealPlatformPaperSessionProtocol();

  const result = protocol.evaluate({
    sessionId: 'first-paper-session-265-warning',
    strategyName: 'Triplicação',
    observedRounds: 140,
    favorableCount: 6,
    waitCount: 4,
    noUseCount: 1,
    elevatedRiskCount: 1,
    averageConfidencePercent: 49,
    operatorConfirmedManualMode: true,
    operatorConfirmedNoExternalIntegration: true,
    operatorConfirmedPaperTracking: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'READY_FOR_FIRST_PAPER_SESSION');
  assert.equal(result.value.warnings.length, 2);
  assert.ok(result.value.warnings.includes('CONFIANCA_MEDIA_ABAIXO_DO_MINIMO_RECOMENDADO'));
});

test('first real-platform paper session protocol supports custom config', () => {
  const protocol = new FirstRealPlatformPaperSessionProtocol();

  const result = protocol.evaluate({
    sessionId: 'first-paper-session-265-custom',
    strategyName: 'Triplicação',
    observedRounds: 60,
    favorableCount: 1,
    waitCount: 4,
    noUseCount: 0,
    elevatedRiskCount: 0,
    averageConfidencePercent: 70,
    operatorConfirmedManualMode: true,
    operatorConfirmedNoExternalIntegration: true,
    operatorConfirmedPaperTracking: true,
    config: {
      minWarmupRounds: 50,
      maxObservedRounds: 100,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, 'READY_FOR_FIRST_PAPER_SESSION');
  assert.equal(result.value.minWarmupRounds, 50);
  assert.equal(result.value.maxObservedRounds, 100);
});

test('first real-platform paper session protocol rejects invalid counters', () => {
  const protocol = new FirstRealPlatformPaperSessionProtocol();

  const result = protocol.evaluate({
    sessionId: 'first-paper-session-265-invalid',
    strategyName: 'Triplicação',
    observedRounds: 2,
    favorableCount: 2,
    waitCount: 2,
    noUseCount: 0,
    elevatedRiskCount: 0,
    averageConfidencePercent: 50,
    operatorConfirmedManualMode: true,
    operatorConfirmedNoExternalIntegration: true,
    operatorConfirmedPaperTracking: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_FIRST_PAPER_SESSION_PROTOCOL_INPUT');
  assert.equal(result.error.stage, 'VALIDATION');
});

test('first real-platform paper session protocol does not expose external execution semantics', () => {
  const protocol = new FirstRealPlatformPaperSessionProtocol();

  const result = protocol.evaluate({
    sessionId: 'first-paper-session-265-semantics',
    strategyName: 'Triplicação',
    observedRounds: 120,
    favorableCount: 1,
    waitCount: 5,
    noUseCount: 1,
    elevatedRiskCount: 0,
    averageConfidencePercent: 62,
    operatorConfirmedManualMode: true,
    operatorConfirmedNoExternalIntegration: true,
    operatorConfirmedPaperTracking: true,
  });

  assert.equal(result.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticBetExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'liveMoneyAuthorization'), false);
  assert.equal(result.value.operatorDecisionRequired, true);
  assert.equal(result.value.supervisedRecommendationOnly, true);
});
