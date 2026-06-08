'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OperatorDecisionPresentationAdapter,
} = require('../../../dist/application/runtime/OperatorDecisionPresentationAdapter.js');
const {
  PerSpinRecommendationSessionReporter,
} = require('../../../dist/application/runtime/PerSpinRecommendationSessionReporter.js');
const {
  OperatorRecommendationExportFormatter,
} = require('../../../dist/application/runtime/OperatorRecommendationExportFormatter.js');

const generatedAtEpochMs = 1760000000000;

function presentation(finalDecision, confidenceScore, riskScore) {
  const adapter = new OperatorDecisionPresentationAdapter();
  const result = adapter.present({
    strategyName: 'Triplicação',
    finalDecision,
    confidenceScore,
    riskScore,
    reasons: ['TEST_REASON'],
  });

  assert.equal(result.ok, true);
  return result.value;
}

function sessionReport() {
  const reporter = new PerSpinRecommendationSessionReporter();
  const result = reporter.report({
    sessionId: 'session-262',
    strategyName: 'Triplicação',
    generatedAtEpochMs,
    presentations: [
      presentation('PAPER_FAVORAVEL', 0.82, 0.22),
      presentation('OBSERVAR', 0.51, 0.44),
      presentation('NAO_UTILIZAR', 0.21, 0.81),
    ],
  });

  assert.equal(result.ok, true);
  return result.value;
}

test('operator recommendation export formatter exports TEXT report', () => {
  const formatter = new OperatorRecommendationExportFormatter();
  const result = formatter.export({
    exportId: 'operator-export-262',
    generatedAtEpochMs,
    format: 'TEXT',
    report: sessionReport(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.exportId, 'operator-export-262');
  assert.equal(result.value.format, 'TEXT');
  assert.equal(result.value.sessionId, 'session-262');
  assert.equal(result.value.strategyName, 'Triplicação');
  assert.match(result.value.text, /RL\.SYS CORE — OPERATOR RECOMMENDATION EXPORT/);
  assert.match(result.value.text, /Strategy: Triplicação/);
  assert.match(result.value.text, /TIMELINE/);
  assert.equal(result.value.json.timeline.length, 3);
  assert.equal(result.value.operatorDecisionRequired, true);
  assert.equal(result.value.supervisedRecommendationOnly, true);
  assert.equal(result.value.institutionalAnalysisMode, true);
});

test('operator recommendation export formatter exports JSON as formatted text payload', () => {
  const formatter = new OperatorRecommendationExportFormatter();
  const result = formatter.export({
    exportId: 'operator-export-262-json',
    generatedAtEpochMs,
    format: 'JSON',
    report: sessionReport(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.format, 'JSON');

  const parsed = JSON.parse(result.value.text);
  assert.equal(parsed.exportId, 'operator-export-262-json');
  assert.equal(parsed.session.strategyName, 'Triplicação');
  assert.equal(parsed.timeline.length, 3);
  assert.equal(parsed.governance.operatorDecisionRequired, true);
});

test('operator recommendation export formatter can omit timeline', () => {
  const formatter = new OperatorRecommendationExportFormatter();
  const result = formatter.export({
    exportId: 'operator-export-262-no-timeline',
    generatedAtEpochMs,
    format: 'TEXT',
    report: sessionReport(),
    includeTimeline: false,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.json.timeline.length, 0);
  assert.doesNotMatch(result.value.text, /TIMELINE/);
});

test('operator recommendation export formatter rejects invalid export id', () => {
  const formatter = new OperatorRecommendationExportFormatter();
  const result = formatter.export({
    exportId: '',
    generatedAtEpochMs,
    format: 'TEXT',
    report: sessionReport(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_OPERATOR_RECOMMENDATION_EXPORT_INPUT');
  assert.equal(result.error.stage, 'VALIDATION');
});

test('operator recommendation export formatter rejects invalid format', () => {
  const formatter = new OperatorRecommendationExportFormatter();
  const result = formatter.export({
    exportId: 'operator-export-262-invalid-format',
    generatedAtEpochMs,
    format: 'PDF',
    report: sessionReport(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_OPERATOR_RECOMMENDATION_EXPORT_INPUT');
});

test('operator recommendation export formatter rejects broken report counters', () => {
  const formatter = new OperatorRecommendationExportFormatter();
  const report = sessionReport();

  const result = formatter.export({
    exportId: 'operator-export-262-broken',
    generatedAtEpochMs,
    format: 'TEXT',
    report: {
      ...report,
      totalRecommendations: 999,
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_OPERATOR_RECOMMENDATION_EXPORT_INPUT');
});

test('operator recommendation export formatter does not expose execution semantics', () => {
  const formatter = new OperatorRecommendationExportFormatter();
  const result = formatter.export({
    exportId: 'operator-export-262-semantics',
    generatedAtEpochMs,
    format: 'TEXT',
    report: sessionReport(),
  });

  assert.equal(result.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'automaticBetExecutionAllowed'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value, 'liveMoneyAuthorization'), false);
  assert.equal(result.value.json.governance.operatorDecisionRequired, true);
  assert.equal(result.value.json.governance.supervisedRecommendationOnly, true);
});
