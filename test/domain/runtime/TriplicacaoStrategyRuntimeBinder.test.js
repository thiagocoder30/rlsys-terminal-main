'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  TriplicacaoStrategyRuntimeBinder,
} = require('../../../dist/application/runtime/TriplicacaoStrategyRuntimeBinder.js');

const generatedAtEpochMs = 1760000000000;

test('triplicacao strategy runtime binder creates favorable CLI session for qualified signal', () => {
  const binder = new TriplicacaoStrategyRuntimeBinder();

  const result = binder.bind({
    sessionId: 'triplicacao-session-264',
    generatedAtEpochMs,
    signals: [
      {
        patternKind: 'TC',
        confidenceScore: 0.82,
        riskScore: 0.22,
        reasons: ['CONSENSO_TRIPLICACAO_POSITIVO'],
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.strategyName, 'Triplicação');
  assert.equal(result.value.decisions.length, 1);
  assert.equal(result.value.decisions[0].finalDecision, 'PAPER_FAVORAVEL');
  assert.equal(result.value.cliSession.frames[0].statusLine, 'Status: FAVORAVEL');
  assert.match(result.value.cliSession.renderedText, /Triplicação/);
});

test('triplicacao strategy runtime binder maps zero rule to observe', () => {
  const binder = new TriplicacaoStrategyRuntimeBinder();

  const result = binder.bind({
    sessionId: 'triplicacao-session-264-zero',
    generatedAtEpochMs,
    signals: [
      {
        patternKind: 'ZERO_DISCARDED',
        confidenceScore: 0.91,
        riskScore: 0.1,
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decisions[0].finalDecision, 'OBSERVAR');
  assert.equal(result.value.cliSession.frames[0].statusLine, 'Status: AGUARDAR');
  assert.ok(result.value.decisions[0].warnings.includes('ZERO_DESCARTADO_REAVALIAR_PROXIMO_GIRO'));
});

test('triplicacao strategy runtime binder maps insufficient data to observe', () => {
  const binder = new TriplicacaoStrategyRuntimeBinder();

  const result = binder.bind({
    sessionId: 'triplicacao-session-264-insufficient',
    generatedAtEpochMs,
    signals: [
      {
        patternKind: 'INSUFFICIENT_DATA',
        confidenceScore: 0.2,
        riskScore: 0.4,
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decisions[0].finalDecision, 'OBSERVAR');
  assert.equal(result.value.cliSession.sessionReport.waitCount, 1);
});

test('triplicacao strategy runtime binder blocks high risk signal', () => {
  const binder = new TriplicacaoStrategyRuntimeBinder();

  const result = binder.bind({
    sessionId: 'triplicacao-session-264-risk',
    generatedAtEpochMs,
    signals: [
      {
        patternKind: 'TA',
        confidenceScore: 0.86,
        riskScore: 0.74,
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decisions[0].finalDecision, 'NAO_UTILIZAR');
  assert.equal(result.value.cliSession.frames[0].statusLine, 'Status: NAO_UTILIZAR');
});

test('triplicacao strategy runtime binder waits for medium confidence signal', () => {
  const binder = new TriplicacaoStrategyRuntimeBinder();

  const result = binder.bind({
    sessionId: 'triplicacao-session-264-wait',
    generatedAtEpochMs,
    signals: [
      {
        patternKind: 'NTA',
        confidenceScore: 0.55,
        riskScore: 0.3,
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decisions[0].finalDecision, 'OBSERVAR');
  assert.equal(result.value.cliSession.frames[0].statusLine, 'Status: AGUARDAR');
});

test('triplicacao strategy runtime binder builds mixed session summary', () => {
  const binder = new TriplicacaoStrategyRuntimeBinder();

  const result = binder.bind({
    sessionId: 'triplicacao-session-264-mixed',
    generatedAtEpochMs,
    signals: [
      { patternKind: 'TC', confidenceScore: 0.82, riskScore: 0.22 },
      { patternKind: 'NTA', confidenceScore: 0.55, riskScore: 0.3 },
      { patternKind: 'TA', confidenceScore: 0.86, riskScore: 0.74 },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.cliSession.sessionReport.totalRecommendations, 3);
  assert.equal(result.value.cliSession.sessionReport.favorableCount, 1);
  assert.equal(result.value.cliSession.sessionReport.waitCount, 1);
  assert.equal(result.value.cliSession.sessionReport.noUseCount, 1);
  assert.equal(result.value.cliSession.sessionReport.trend, 'SESSION_MIXED');
});

test('triplicacao strategy runtime binder rejects invalid pattern with index', () => {
  const binder = new TriplicacaoStrategyRuntimeBinder();

  const result = binder.bind({
    sessionId: 'triplicacao-session-264-invalid',
    generatedAtEpochMs,
    signals: [
      {
        patternKind: 'INVALID_PATTERN',
        confidenceScore: 0.8,
        riskScore: 0.2,
      },
    ],
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_TRIPLICACAO_RUNTIME_BINDER_INPUT');
  assert.equal(result.error.stage, 'VALIDATION');
  assert.equal(result.error.signalIndex, 0);
});

test('triplicacao strategy runtime binder preserves supervised recommendation semantics', () => {
  const binder = new TriplicacaoStrategyRuntimeBinder();

  const result = binder.bind({
    sessionId: 'triplicacao-session-264-semantics',
    generatedAtEpochMs,
    signals: [
      { patternKind: 'TC', confidenceScore: 0.82, riskScore: 0.22 },
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
