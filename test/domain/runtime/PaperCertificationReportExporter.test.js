'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PaperCertificationReportExporter,
} = require('../../../dist/application/runtime/PaperCertificationReportExporter.js');

const now = 1760000000000;

function certification(overrides = {}) {
  return {
    certificationId: 'certification-256',
    status: 'PAPER_CERTIFIED',
    generatedAtEpochMs: now,
    campaignCount: 2,
    dryRunCount: 6,
    certifiedCampaignCount: 2,
    reviewCampaignCount: 0,
    blockedCampaignCount: 0,
    decisionCounts: {
      paperFavoravel: 5,
      observar: 1,
      naoUtilizar: 0,
    },
    averageReadinessRatio: 0.8333,
    averageReviewRatio: 0.1667,
    averageBlockedRatio: 0,
    certificationScore: 0.8421,
    reasons: [
      'PAPER_ONLY_POLICY_LOCK',
      'NO_LIVE_MONEY_AUTHORIZATION',
      'AUTOMATIC_BET_EXECUTION_BLOCKED',
      'HUMAN_SUPERVISION_REQUIRED',
      'CAMPAIGN_CERTIFIED',
    ],
    operatorSummary: 'PAPER_CERTIFIED: certificação institucional PAPER aprovada.',
    paperOnly: true,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
    automaticExecutionAllowed: false,
    automaticSuggestionAllowed: true,
    automaticBetExecutionAllowed: false,
    humanSupervisionRequired: true,
    ...overrides,
  };
}

test('paper certification report exporter produces audit friendly TEXT report', () => {
  const exporter = new PaperCertificationReportExporter();
  const result = exporter.export({
    exportId: 'export-256',
    generatedAtEpochMs: now,
    certification: certification(),
    format: 'TEXT',
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.exportId, 'export-256');
  assert.equal(result.value.status, 'PAPER_CERTIFIED');
  assert.equal(result.value.paperOnly, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
  assert.equal(result.value.automaticBetExecutionAllowed, false);
  assert.match(result.value.text, /RL\.SYS CORE — PAPER CERTIFICATION REPORT/);
  assert.match(result.value.text, /Status: PAPER_CERTIFIED/);
  assert.match(result.value.text, /automaticBetExecutionAllowed=false/);
});

test('paper certification report exporter produces deterministic JSON export', () => {
  const exporter = new PaperCertificationReportExporter();
  const payload = {
    exportId: 'export-json-256',
    generatedAtEpochMs: now,
    certification: certification(),
    format: 'JSON',
  };

  const first = exporter.export(payload);
  const second = exporter.export(payload);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first.value.json, second.value.json);
  assert.deepEqual(first.value.text, second.value.text);
});

test('paper certification report exporter rejects empty export id', () => {
  const exporter = new PaperCertificationReportExporter();
  const result = exporter.export({
    exportId: '',
    generatedAtEpochMs: now,
    certification: certification(),
    format: 'TEXT',
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.stage, 'VALIDATION');
  assert.equal(result.error.code, 'INVALID_PAPER_CERTIFICATION_REPORT_EXPORTER_INPUT');
});

test('paper certification report exporter rejects certification with broken PAPER locks', () => {
  const exporter = new PaperCertificationReportExporter();
  const result = exporter.export({
    exportId: 'export-broken-lock-256',
    generatedAtEpochMs: now,
    certification: certification({
      automaticBetExecutionAllowed: true,
    }),
    format: 'TEXT',
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.stage, 'VALIDATION');
});

test('paper certification report exporter preserves supervised PAPER-only semantics', () => {
  const exporter = new PaperCertificationReportExporter();
  const result = exporter.export({
    exportId: 'export-flags-256',
    generatedAtEpochMs: now,
    certification: certification(),
    format: 'TEXT',
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.paperOnly, true);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
  assert.equal(result.value.automaticExecutionAllowed, false);
  assert.equal(result.value.automaticSuggestionAllowed, true);
  assert.equal(result.value.automaticBetExecutionAllowed, false);
  assert.equal(result.value.humanSupervisionRequired, true);
});
