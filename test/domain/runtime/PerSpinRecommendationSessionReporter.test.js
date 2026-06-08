'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OperatorDecisionPresentationAdapter,
} = require('../../../dist/application/runtime/OperatorDecisionPresentationAdapter.js');
const {
  PerSpinRecommendationSessionReporter,
} = require('../../../dist/application/runtime/PerSpinRecommendationSessionReporter.js');

const generatedAtEpochMs = 1760000000000;

function presentation(finalDecision, confidenceScore, riskScore) {
  const adapter = new OperatorDecisionPresentationAdapter();
  const result = adapter.present({
    strategyName: 'Triplicação',
    finalDecision,
    confidenceScore,
    riskScore,
    reasons: ['TEST_REASON'],
    warnings: finalDecision === 'OBSERVAR' ? ['TEST_WARNING'] : [],
    blockers: finalDecision === 'NAO_UTILIZAR' ? ['TEST_BLOCKER'] : [],
  });

  assert.equal(result.ok, true);
  return result.value;
}

test('per-spin recommendation session reporter summarizes favorable dominant session', () => {
  const reporter = new PerSpinRecommendationSessionReporter();

  const result = reporter.report({
    sessionId: 'session-261',
    strategyName: 'Triplicação',
    generatedAtEpochMs,
    presentations: [
      presentation('PAPER_FAVORAVEL', 0.82, 0.22),
      presentation('OBSERVAR', 0.51, 0.44),
      presentation('PAPER_FAVORAVEL', 0.86, 0.19),
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.sessionId, 'session-261');
  assert.equal(result.value.strategyName, 'Triplicação');
  assert.equal(result.value.totalRecommendations, 3);
  assert.equal(result.value.favorableCount, 2);
  assert.equal(result.value.waitCount, 1);
  assert.equal(result.value.noUseCount, 0);
  assert.equal(result.value.controlledRiskCount, 2);
  assert.equal(result.value.moderateRiskCount, 1);
  assert.equal(result.value.elevatedRiskCount, 0);
  assert.equal(result.value.averageConfidencePercent, 73);
  assert.equal(result.value.trend, 'SESSION_FAVORABLE_DOMINANT');
  assert.equal(result.value.latestRecommendation.status, 'FAVORAVEL');
  assert.equal(result.value.timeline.length, 3);
  assert.equal(result.value.timeline[0].spinIndex, 1);
  assert.equal(result.value.timeline[2].spinIndex, 3);
});

test('per-spin recommendation session reporter summarizes no-use dominant session', () => {
  const reporter = new PerSpinRecommendationSessionReporter();

  const result = reporter.report({
    sessionId: 'session-261-blocked',
    strategyName: 'Triplicação',
    generatedAtEpochMs,
    presentations: [
      presentation('NAO_UTILIZAR', 0.22, 0.72),
      presentation('OBSERVAR', 0.48, 0.45),
      presentation('NAO_UTILIZAR', 0.31, 0.8),
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.noUseCount, 2);
  assert.equal(result.value.elevatedRiskCount, 2);
  assert.equal(result.value.trend, 'SESSION_NO_USE_DOMINANT');
});

test('per-spin recommendation session reporter summarizes wait dominant session', () => {
  const reporter = new PerSpinRecommendationSessionReporter();

  const result = reporter.report({
    sessionId: 'session-261-wait',
    strategyName: 'Triplicação',
    generatedAtEpochMs,
    presentations: [
      presentation('OBSERVAR', 0.48, 0.45),
      presentation('OBSERVAR', 0.52, 0.5),
      presentation('PAPER_FAVORAVEL', 0.73, 0.3),
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.waitCount, 2);
  assert.equal(result.value.trend, 'SESSION_WAIT_DOMINANT');
});

test('per-spin recommendation session reporter supports empty session report', () => {
  const reporter = new PerSpinRecommendationSessionReporter();

  const result = reporter.report({
    sessionId: 'session-261-empty',
    strategyName: 'Triplicação',
    generatedAtEpochMs,
    presentations: [],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.totalRecommendations, 0);
  assert.equal(result.value.averageConfidencePercent, 0);
  assert.equal(result.value.trend, 'SESSION_EMPTY');
  assert.equal(result.value.latestRecommendation, null);
  assert.equal(result.value.timeline.length, 0);
});

test('per-spin recommendation session reporter rejects missing session id', () => {
  const reporter = new PerSpinRecommendationSessionReporter();

  const result = reporter.report({
    sessionId: '',
    strategyName: 'Triplicação',
    generatedAtEpochMs,
    presentations: [],
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_PER_SPIN_SESSION_REPORT_INPUT');
  assert.equal(result.error.stage, 'VALIDATION');
});

test('per-spin recommendation session reporter rejects invalid timestamps', () => {
  const reporter = new PerSpinRecommendationSessionReporter();

  const result = reporter.report({
    sessionId: 'session-261-invalid-time',
    strategyName: 'Triplicação',
    generatedAtEpochMs: -1,
    presentations: [],
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_PER_SPIN_SESSION_REPORT_INPUT');
});

test('per-spin recommendation session reporter rejects strategy mismatch', () => {
  const reporter = new PerSpinRecommendationSessionReporter();
  const adapter = new OperatorDecisionPresentationAdapter();

  const presentationResult = adapter.present({
    strategyName: 'Outra Estratégia',
    finalDecision: 'PAPER_FAVORAVEL',
  });

  assert.equal(presentationResult.ok, true);

  const result = reporter.report({
    sessionId: 'session-261-mismatch',
    strategyName: 'Triplicação',
    generatedAtEpochMs,
    presentations: [presentationResult.value],
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_PER_SPIN_SESSION_REPORT_INPUT');
  assert.match(result.error.message, /another strategy/);
});

test('per-spin recommendation session reporter preserves supervised recommendation semantics', () => {
  const reporter = new PerSpinRecommendationSessionReporter();

  const result = reporter.report({
    sessionId: 'session-261-semantics',
    strategyName: 'Triplicação',
    generatedAtEpochMs,
    presentations: [
      presentation('PAPER_FAVORAVEL', 0.82, 0.22),
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
