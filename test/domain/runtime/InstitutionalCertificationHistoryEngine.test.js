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
    operatorSummary: `${status}: certification history fixture.`,
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
    sourceHead: '14751d6',
    certificationExport: exported.value,
  });

  assert.equal(entry.ok, true);
  return entry.value.ndjsonLine;
}

test('institutional certification history summarizes ledger counts and latest certification', () => {
  const engine = new InstitutionalCertificationHistoryEngine();
  const result = engine.summarize({
    ledgerLines: [
      ledgerLine('PAPER_BLOCKED', 'a', now),
      ledgerLine('PAPER_REVIEW', 'b', now + 1),
      ledgerLine('PAPER_CERTIFIED', 'c', now + 2),
      ledgerLine('PAPER_CERTIFIED', 'd', now + 3),
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.totalCertifications, 4);
  assert.equal(result.value.certifiedCount, 2);
  assert.equal(result.value.reviewCount, 1);
  assert.equal(result.value.blockedCount, 1);
  assert.equal(result.value.latestCertification.certificationId, 'certification-d');
  assert.equal(result.value.latestCertification.status, 'PAPER_CERTIFIED');
  assert.equal(result.value.certificationTrend, 'CERTIFICATION_HISTORY_IMPROVING');
  assert.equal(result.value.firstGeneratedAtEpochMs, now);
  assert.equal(result.value.latestGeneratedAtEpochMs, now + 3);
});

test('institutional certification history ignores blank ledger lines', () => {
  const engine = new InstitutionalCertificationHistoryEngine();
  const result = engine.summarize({
    ledgerLines: [
      '',
      '   ',
      ledgerLine('PAPER_CERTIFIED', 'blank-safe', now),
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.totalCertifications, 1);
  assert.equal(result.value.certifiedCount, 1);
  assert.equal(result.value.certificationTrend, 'CERTIFICATION_HISTORY_INSUFFICIENT_DATA');
});

test('institutional certification history detects blocked history', () => {
  const engine = new InstitutionalCertificationHistoryEngine();
  const result = engine.summarize({
    ledgerLines: [
      ledgerLine('PAPER_BLOCKED', 'blocked-a', now),
      ledgerLine('PAPER_BLOCKED', 'blocked-b', now + 1),
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.totalCertifications, 2);
  assert.equal(result.value.blockedCount, 2);
  assert.equal(result.value.certificationTrend, 'CERTIFICATION_HISTORY_BLOCKED');
});

test('institutional certification history detects degrading history', () => {
  const engine = new InstitutionalCertificationHistoryEngine();
  const result = engine.summarize({
    ledgerLines: [
      ledgerLine('PAPER_CERTIFIED', 'degrading-a', now),
      ledgerLine('PAPER_REVIEW', 'degrading-b', now + 1),
      ledgerLine('PAPER_BLOCKED', 'degrading-c', now + 2),
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.certificationTrend, 'CERTIFICATION_HISTORY_DEGRADING');
});

test('institutional certification history rejects invalid NDJSON lines', () => {
  const engine = new InstitutionalCertificationHistoryEngine();
  const result = engine.summarize({
    ledgerLines: [
      ledgerLine('PAPER_CERTIFIED', 'valid-before-invalid', now),
      '{invalid-json',
    ],
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_CERTIFICATION_LEDGER_LINE');
  assert.equal(result.error.stage, 'PARSING');
  assert.equal(result.error.lineIndex, 1);
});

test('institutional certification history rejects governance violations', () => {
  const validLine = ledgerLine('PAPER_CERTIFIED', 'governance', now);
  const parsed = JSON.parse(validLine);
  parsed.governance.automaticBetExecutionAllowed = true;

  const engine = new InstitutionalCertificationHistoryEngine();
  const result = engine.summarize({
    ledgerLines: [JSON.stringify(parsed)],
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'CERTIFICATION_LEDGER_GOVERNANCE_VIOLATION');
  assert.equal(result.error.stage, 'GOVERNANCE');
  assert.equal(result.error.lineIndex, 0);
});

test('institutional certification history preserves supervised PAPER-only locks', () => {
  const engine = new InstitutionalCertificationHistoryEngine();
  const result = engine.summarize({
    ledgerLines: [
      ledgerLine('PAPER_REVIEW', 'flags-a', now),
      ledgerLine('PAPER_CERTIFIED', 'flags-b', now + 1),
    ],
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
