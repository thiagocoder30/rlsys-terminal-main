'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  PaperCertificationReportExporter,
} = require('../../../dist/application/runtime/PaperCertificationReportExporter.js');
const {
  CertificationLedgerExportEngine,
} = require('../../../dist/application/runtime/CertificationLedgerExportEngine.js');

const now = 1760000000000;

function certification(overrides = {}) {
  return {
    certificationId: 'certification-257',
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

function certificationExport(overrides = {}) {
  const exporter = new PaperCertificationReportExporter();
  const result = exporter.export({
    exportId: 'export-257',
    generatedAtEpochMs: now,
    certification: certification(),
    format: 'JSON',
  });

  assert.equal(result.ok, true);
  return {
    ...result.value,
    ...overrides,
  };
}

test('certification ledger export engine creates deterministic append-only NDJSON entry', () => {
  const engine = new CertificationLedgerExportEngine();
  const input = {
    ledgerEntryId: 'ledger-entry-257',
    generatedAtEpochMs: now,
    sourceHead: '2913429',
    certificationExport: certificationExport(),
  };

  const first = engine.export(input);
  const second = engine.export(input);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.value.checksum, second.value.checksum);
  assert.equal(first.value.ndjsonLine, second.value.ndjsonLine);
  assert.match(first.value.checksum, /^sha256:[a-f0-9]{64}$/);

  const parsed = JSON.parse(first.value.ndjsonLine);
  assert.equal(parsed.ledgerEntryId, 'ledger-entry-257');
  assert.equal(parsed.certificationId, 'certification-257');
  assert.equal(parsed.exportId, 'export-257');
  assert.equal(parsed.status, 'PAPER_CERTIFIED');
  assert.equal(parsed.sourceHead, '2913429');
  assert.equal(parsed.governance.appendOnly, true);
  assert.equal(parsed.governance.paperOnly, true);
  assert.equal(parsed.governance.productionMoneyAllowed, false);
  assert.equal(parsed.governance.liveMoneyAuthorization, false);
  assert.equal(parsed.governance.automaticBetExecutionAllowed, false);
});

test('certification ledger export engine rejects broken PAPER locks', () => {
  const engine = new CertificationLedgerExportEngine();
  const result = engine.export({
    ledgerEntryId: 'ledger-entry-broken-lock-257',
    generatedAtEpochMs: now,
    sourceHead: '2913429',
    certificationExport: certificationExport({
      automaticBetExecutionAllowed: true,
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.stage, 'VALIDATION');
  assert.equal(result.error.code, 'INVALID_CERTIFICATION_LEDGER_EXPORT_INPUT');
});

test('certification ledger export engine appends without loading or rewriting history', () => {
  const engine = new CertificationLedgerExportEngine();
  const tmpDir = path.join(process.cwd(), 'artifacts', 'tmp-sprint-257');
  const ledgerFile = path.join(tmpDir, 'paper-certification-ledger.ndjson');
  fs.rmSync(tmpDir, { recursive: true, force: true });

  const first = engine.appendToFile(ledgerFile, {
    ledgerEntryId: 'ledger-entry-257-a',
    generatedAtEpochMs: now,
    sourceHead: '2913429',
    certificationExport: certificationExport({ exportId: 'export-257-a' }),
  });

  const second = engine.appendToFile(ledgerFile, {
    ledgerEntryId: 'ledger-entry-257-b',
    generatedAtEpochMs: now + 1,
    sourceHead: '2913429',
    certificationExport: certificationExport({ exportId: 'export-257-b' }),
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);

  const lines = fs.readFileSync(ledgerFile, 'utf8').trim().split('\n');
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).ledgerEntryId, 'ledger-entry-257-a');
  assert.equal(JSON.parse(lines[1]).ledgerEntryId, 'ledger-entry-257-b');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('certification ledger export engine rejects empty ledger entry id', () => {
  const engine = new CertificationLedgerExportEngine();
  const result = engine.export({
    ledgerEntryId: '',
    generatedAtEpochMs: now,
    sourceHead: '2913429',
    certificationExport: certificationExport(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.stage, 'VALIDATION');
});

test('certification ledger export engine preserves supervised PAPER-only semantics', () => {
  const engine = new CertificationLedgerExportEngine();
  const result = engine.export({
    ledgerEntryId: 'ledger-entry-flags-257',
    generatedAtEpochMs: now,
    sourceHead: '2913429',
    certificationExport: certificationExport(),
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
