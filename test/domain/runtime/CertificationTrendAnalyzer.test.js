'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PaperCertificationReportExporter,
} = require('../../../dist/application/runtime/PaperCertificationReportExporter.js');
const {
  CertificationLedgerExportEngine,
} = require('../../../dist/application/runtime/CertificationLedgerExportEngine.js');
const {
  InstitutionalCertificationHistoryEngine,
} = require('../../../dist/application/runtime/InstitutionalCertificationHistoryEngine.js');
const {
  CertificationTrendAnalyzer,
} = require('../../../dist/application/runtime/CertificationTrendAnalyzer.js');

const now = 1760000000000;

function certification(status, id, generatedAtEpochMs) {
  return {
    certificationId: id,
    status,
    generatedAtEpochMs,
    campaignCount: 2,
    dryRunCount: 6,
    certifiedCampaignCount: status === 'PAPER_CERTIFIED' ? 2 : 0,
    reviewCampaignCount: status === 'PAPER_REVIEW' ? 2 : 0,
    blockedCampaignCount: status === 'PAPER_BLOCKED' ? 2 : 0,
    decisionCounts: {
      paperFavoravel: status === 'PAPER_CERTIFIED' ? 5 : 0,
      observar: status === 'PAPER_REVIEW' ? 5 : 1,
      naoUtilizar: status === 'PAPER_BLOCKED' ? 5 : 0,
    },
    averageReadinessRatio: status === 'PAPER_CERTIFIED' ? 0.83 : 0.2,
    averageReviewRatio: status === 'PAPER_REVIEW' ? 0.7 : 0.1,
    averageBlockedRatio: status === 'PAPER_BLOCKED' ? 0.9 : 0,
    certificationScore: status === 'PAPER_CERTIFIED' ? 0.84 : status === 'PAPER_REVIEW' ? 0.52 : 0.1,
    reasons: [
      'PAPER_ONLY_POLICY_LOCK',
      'NO_LIVE_MONEY_AUTHORIZATION',
      'AUTOMATIC_BET_EXECUTION_BLOCKED',
      'HUMAN_SUPERVISION_REQUIRED',
      status,
    ],
    operatorSummary: `${status}: certification trend fixture.`,
    paperOnly: true,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
    automaticExecutionAllowed: false,
    automaticSuggestionAllowed: true,
    automaticBetExecutionAllowed: false,
    humanSupervisionRequired: true,
  };
}

function ledgerLine(status, suffix, generatedAtEpochMs) {
  const exporter = new PaperCertificationReportExporter();
  const ledger = new CertificationLedgerExportEngine();

  const exported = exporter.export({
    exportId: `export-${suffix}`,
    generatedAtEpochMs,
    certification: certification(status, `certification-${suffix}`, generatedAtEpochMs),
    format: 'JSON',
  });

  assert.equal(exported.ok, true);

  const entry = ledger.export({
    ledgerEntryId: `ledger-entry-${suffix}`,
    generatedAtEpochMs,
    sourceHead: 'd3fc170',
    certificationExport: exported.value,
  });

  assert.equal(entry.ok, true);
  return entry.value.ndjsonLine;
}

function historyFromStatuses(statuses) {
  const history = new InstitutionalCertificationHistoryEngine();
  const result = history.summarize({
    ledgerLines: statuses.map((status, index) => ledgerLine(status, `${index}`, now + index)),
  });

  assert.equal(result.ok, true);
  return result.value;
}

test('certification trend analyzer detects improving history', () => {
  const analyzer = new CertificationTrendAnalyzer();
  const result = analyzer.analyze({
    history: historyFromStatuses([
      'PAPER_BLOCKED',
      'PAPER_REVIEW',
      'PAPER_CERTIFIED',
      'PAPER_CERTIFIED',
    ]),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'TREND_IMPROVING');
  assert.equal(result.value.operatorRecommendation, 'CERTIFICATION_TREND_SUPPORTS_PAPER_CONTINUITY');
  assert.equal(result.value.latestStatus, 'PAPER_CERTIFIED');
  assert.equal(result.value.certifiedRatio, 0.5);
  assert.equal(result.value.reviewRatio, 0.25);
  assert.equal(result.value.blockedRatio, 0.25);
  assert.ok(result.value.confidenceScore > 0);
});

test('certification trend analyzer detects stable history', () => {
  const analyzer = new CertificationTrendAnalyzer();
  const result = analyzer.analyze({
    history: historyFromStatuses([
      'PAPER_REVIEW',
      'PAPER_REVIEW',
      'PAPER_REVIEW',
    ]),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'TREND_STABLE');
  assert.equal(result.value.operatorRecommendation, 'CERTIFICATION_TREND_SUPPORTS_OBSERVATION');
});

test('certification trend analyzer detects degrading history', () => {
  const analyzer = new CertificationTrendAnalyzer();
  const result = analyzer.analyze({
    history: historyFromStatuses([
      'PAPER_CERTIFIED',
      'PAPER_REVIEW',
      'PAPER_BLOCKED',
    ]),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'TREND_DEGRADING');
  assert.equal(result.value.operatorRecommendation, 'CERTIFICATION_TREND_REQUIRES_REVIEW');
});

test('certification trend analyzer detects blocked history', () => {
  const analyzer = new CertificationTrendAnalyzer();
  const result = analyzer.analyze({
    history: historyFromStatuses([
      'PAPER_BLOCKED',
      'PAPER_BLOCKED',
      'PAPER_BLOCKED',
    ]),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'TREND_BLOCKED');
  assert.equal(result.value.operatorRecommendation, 'CERTIFICATION_TREND_BLOCKS_OPERATION');
  assert.equal(result.value.blockedRatio, 1);
});

test('certification trend analyzer detects insufficient data', () => {
  const analyzer = new CertificationTrendAnalyzer();
  const result = analyzer.analyze({
    history: historyFromStatuses([
      'PAPER_CERTIFIED',
    ]),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'TREND_INSUFFICIENT_DATA');
  assert.equal(result.value.operatorRecommendation, 'CERTIFICATION_TREND_SUPPORTS_OBSERVATION');
});

test('certification trend analyzer rejects broken counters', () => {
  const analyzer = new CertificationTrendAnalyzer();
  const history = historyFromStatuses([
    'PAPER_CERTIFIED',
    'PAPER_REVIEW',
  ]);

  const result = analyzer.analyze({
    history: {
      ...history,
      totalCertifications: 99,
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_CERTIFICATION_TREND_INPUT');
  assert.equal(result.error.stage, 'VALIDATION');
});

test('certification trend analyzer rejects governance violations', () => {
  const analyzer = new CertificationTrendAnalyzer();
  const history = historyFromStatuses([
    'PAPER_CERTIFIED',
    'PAPER_CERTIFIED',
  ]);

  const result = analyzer.analyze({
    history: {
      ...history,
      automaticBetExecutionAllowed: true,
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'CERTIFICATION_TREND_GOVERNANCE_VIOLATION');
  assert.equal(result.error.stage, 'GOVERNANCE');
});

test('certification trend analyzer preserves supervised PAPER-only locks', () => {
  const analyzer = new CertificationTrendAnalyzer();
  const result = analyzer.analyze({
    history: historyFromStatuses([
      'PAPER_REVIEW',
      'PAPER_CERTIFIED',
    ]),
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.paperOnly, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
  assert.equal(result.value.automaticExecutionAllowed, false);
  assert.equal(result.value.automaticSuggestionAllowed, true);
  assert.equal(result.value.automaticBetExecutionAllowed, false);
  assert.equal(result.value.humanSupervisionRequired, true);
  assert.ok(result.value.reasons.includes('PAPER_ONLY_POLICY_LOCK'));
  assert.ok(result.value.reasons.includes('NO_LIVE_MONEY_AUTHORIZATION'));
});
