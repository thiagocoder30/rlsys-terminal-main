'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PerSpinOperatorCliSession,
} = require('../../../dist/application/runtime/PerSpinOperatorCliSession.js');

const generatedAtEpochMs = 1760000000000;

test('per-spin operator cli session composes operator-ready frames and session report', () => {
  const cli = new PerSpinOperatorCliSession();

  const result = cli.compose({
    sessionId: 'cli-session-263',
    strategyName: 'Triplicação',
    generatedAtEpochMs,
    decisions: [
      {
        finalDecision: 'PAPER_FAVORAVEL',
        confidenceScore: 0.82,
        riskScore: 0.22,
        reasons: ['CONSENSO_POSITIVO'],
      },
      {
        finalDecision: 'OBSERVAR',
        confidenceScore: 0.51,
        riskScore: 0.44,
        warnings: ['CONFIRMACAO_PENDENTE'],
      },
      {
        finalDecision: 'NAO_UTILIZAR',
        confidenceScore: 0.21,
        riskScore: 0.81,
        blockers: ['RISCO_ELEVADO'],
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.sessionId, 'cli-session-263');
  assert.equal(result.value.strategyName, 'Triplicação');
  assert.equal(result.value.frames.length, 3);
  assert.equal(result.value.sessionReport.totalRecommendations, 3);
  assert.equal(result.value.sessionReport.favorableCount, 1);
  assert.equal(result.value.sessionReport.waitCount, 1);
  assert.equal(result.value.sessionReport.noUseCount, 1);
  assert.equal(result.value.sessionReport.trend, 'SESSION_MIXED');
  assert.match(result.value.renderedText, /RL\.SYS CORE — PER-SPIN OPERATOR CLI SESSION/);
  assert.match(result.value.renderedText, /Giro #1/);
  assert.match(result.value.renderedText, /Status: FAVORAVEL/);
  assert.match(result.value.renderedText, /Status: AGUARDAR/);
  assert.match(result.value.renderedText, /Status: NAO_UTILIZAR/);
});

test('per-spin operator cli session supports empty observed session', () => {
  const cli = new PerSpinOperatorCliSession();

  const result = cli.compose({
    sessionId: 'cli-session-263-empty',
    strategyName: 'Triplicação',
    generatedAtEpochMs,
    decisions: [],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.frames.length, 0);
  assert.equal(result.value.sessionReport.totalRecommendations, 0);
  assert.equal(result.value.sessionReport.trend, 'SESSION_EMPTY');
  assert.match(result.value.renderedText, /Nenhum giro registrado/);
});

test('per-spin operator cli session rejects missing session id', () => {
  const cli = new PerSpinOperatorCliSession();

  const result = cli.compose({
    sessionId: '',
    strategyName: 'Triplicação',
    generatedAtEpochMs,
    decisions: [],
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_PER_SPIN_OPERATOR_CLI_SESSION_INPUT');
  assert.equal(result.error.stage, 'VALIDATION');
  assert.equal(result.error.decisionIndex, null);
});

test('per-spin operator cli session rejects invalid decision with index', () => {
  const cli = new PerSpinOperatorCliSession();

  const result = cli.compose({
    sessionId: 'cli-session-263-invalid',
    strategyName: 'Triplicação',
    generatedAtEpochMs,
    decisions: [
      { finalDecision: 'PAPER_FAVORAVEL' },
      { finalDecision: 'ENTRAR_AGORA' },
    ],
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_PER_SPIN_OPERATOR_CLI_SESSION_INPUT');
  assert.equal(result.error.stage, 'VALIDATION');
  assert.equal(result.error.decisionIndex, 1);
});

test('per-spin operator cli session rejects invalid numeric scores', () => {
  const cli = new PerSpinOperatorCliSession();

  const result = cli.compose({
    sessionId: 'cli-session-263-invalid-score',
    strategyName: 'Triplicação',
    generatedAtEpochMs,
    decisions: [
      {
        finalDecision: 'OBSERVAR',
        confidenceScore: Number.NaN,
      },
    ],
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_PER_SPIN_OPERATOR_CLI_SESSION_INPUT');
  assert.equal(result.error.decisionIndex, 0);
});

test('per-spin operator cli session preserves supervised recommendation semantics', () => {
  const cli = new PerSpinOperatorCliSession();

  const result = cli.compose({
    sessionId: 'cli-session-263-semantics',
    strategyName: 'Triplicação',
    generatedAtEpochMs,
    decisions: [
      {
        finalDecision: 'PAPER_FAVORAVEL',
        confidenceScore: 0.8,
        riskScore: 0.2,
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.operatorDecisionRequired, true);
  assert.equal(result.value.supervisedRecommendationOnly, true);
  assert.equal(result.value.institutionalAnalysisMode, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticBetExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'liveMoneyAuthorization'), false);
});

test('per-spin operator cli session renders user-friendly action lines', () => {
  const cli = new PerSpinOperatorCliSession();

  const result = cli.compose({
    sessionId: 'cli-session-263-action-lines',
    strategyName: 'Triplicação',
    generatedAtEpochMs,
    decisions: [
      {
        finalDecision: 'PAPER_FAVORAVEL',
        confidenceScore: 0.9,
        riskScore: 0.1,
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.frames[0].statusLine, 'Status: FAVORAVEL');
  assert.equal(result.value.frames[0].confidenceLine, 'Confiança: 90%');
  assert.equal(result.value.frames[0].riskLine, 'Risco: CONTROLADO');
  assert.match(result.value.frames[0].actionLine, /CONSIDERAR_ENTRADA_MANUAL_SUPERVISIONADA/);
});
