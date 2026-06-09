'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const {
  OperatorEntrySupervisionController,
} = require('../../../dist/application/runtime/OperatorEntrySupervisionController.js');

const {
  PaperEntrySupervisionLedgerExporter,
} = require('../../../dist/application/runtime/PaperEntrySupervisionLedgerExporter.js');

const {
  JsonPaperEntryLedgerRepositoryAdapter,
} = require('../../../dist/infrastructure/runtime/JsonPaperEntryLedgerRepositoryAdapter.js');

function supervision(overrides = {}) {
  const controller = new OperatorEntrySupervisionController();

  const result = controller.supervise({
    supervisionId: overrides.supervisionId || 'supervision-285',
    generatedAtEpochMs: overrides.generatedAtEpochMs || 1760000000000,
    sessionId: overrides.sessionId || 'paper-session-285',
    strategyName: overrides.strategyName || 'Triplicação',
    hudRecommendation: overrides.hudRecommendation || 'ENTRAR',
    hudRenderedText: overrides.hudRenderedText || 'RL.SYS CORE — PAPER HUD\nRecomendação: ENTRAR ✅',
    operatorDecision: overrides.operatorDecision || 'CONFIRMAR',
    operatorNote: overrides.operatorNote === undefined
      ? 'Operador confirmou entrada PAPER supervisionada.'
      : overrides.operatorNote,
    requestedStake: overrides.requestedStake || 3.5,
    confidencePercent: overrides.confidencePercent || 92,
    evidence: overrides.evidence || ['BANKROLL_SAFE', 'DAILY_LOCK_RELEASED', 'TRIPLICACAO_FAVORABLE'],
  });

  assert.equal(result.ok, true);
  return result.value;
}

function ledgerEntry(options = {}) {
  const exporter = new PaperEntrySupervisionLedgerExporter();

  const result = exporter.export({
    exportId: options.exportId || 'export-285',
    generatedAtEpochMs: options.exportGeneratedAtEpochMs || 1760000001000,
    format: 'JSON',
    supervision: supervision(options.supervision || {}),
  });

  assert.equal(result.ok, true);
  return result.value.ledgerEntry;
}

async function tempLedger() {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-paper-entry-cli-'));
  const filePath = join(dir, 'paper-entry-ledger.jsonl');
  const repository = new JsonPaperEntryLedgerRepositoryAdapter({ filePath });

  return { dir, filePath, repository };
}

function runCli(args) {
  return spawnSync(
    process.execPath,
    ['scripts/paper-entry-ledger-cli-reporter.js', ...args],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  );
}

test('paper entry ledger CLI reporter prints latest text report', async () => {
  const { dir, filePath, repository } = await tempLedger();

  try {
    await repository.append(ledgerEntry({
      exportId: 'export-cli-latest',
      exportGeneratedAtEpochMs: 1760000001000,
    }));

    const result = runCli([
      '--file', filePath,
      '--mode', 'latest',
      '--format', 'text',
      '--limit', '5',
      '--generatedAtEpochMs', '1760000010000',
    ]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /PAPER ENTRY LEDGER QUERY REPORT/);
    assert.match(result.stdout, /Total Entries: 1/);
    assert.match(result.stdout, /PaperOnly: true/);
    assert.match(result.stdout, /LiveMoneyAuthorization: false/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper entry ledger CLI reporter prints JSON query report', async () => {
  const { dir, filePath, repository } = await tempLedger();

  try {
    await repository.append(ledgerEntry({
      exportId: 'export-cli-json',
      exportGeneratedAtEpochMs: 1760000001000,
      supervision: {
        supervisionId: 'supervision-cli-json',
        sessionId: 'session-cli-json',
        confidencePercent: 94,
      },
    }));

    const result = runCli([
      '--file', filePath,
      '--mode', 'query',
      '--format', 'json',
      '--sessionId', 'session-cli-json',
      '--minimumConfidencePercent', '90',
      '--limit', '10',
    ]);

    assert.equal(result.status, 0);

    const parsed = JSON.parse(result.stdout);

    assert.equal(parsed.ok, true);
    assert.equal(parsed.mode, 'query');
    assert.equal(parsed.report.entries.length, 1);
    assert.equal(parsed.report.entries[0].exportId, 'export-cli-json');
    assert.equal(parsed.report.paperOnly, true);
    assert.equal(parsed.report.automaticBetExecutionAllowed, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper entry ledger CLI reporter prints stats without loading UI execution permissions', async () => {
  const { dir, filePath, repository } = await tempLedger();

  try {
    await repository.append(ledgerEntry({
      exportId: 'export-cli-stats',
      exportGeneratedAtEpochMs: 1760000001000,
    }));

    const result = runCli([
      '--file', filePath,
      '--mode', 'stats',
      '--format', 'json',
    ]);

    assert.equal(result.status, 0);

    const parsed = JSON.parse(result.stdout);

    assert.equal(parsed.ok, true);
    assert.equal(parsed.stats.totalEntries, 1);
    assert.equal(parsed.paperOnly, true);
    assert.equal(parsed.liveMoneyAuthorization, false);
    assert.equal(parsed.automaticExecutionAllowed, false);
    assert.equal(parsed.automaticBetExecutionAllowed, false);
    assert.equal(parsed.humanSupervisionRequired, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper entry ledger CLI reporter requires sessionId for session mode', async () => {
  const { dir, filePath } = await tempLedger();

  try {
    const result = runCli([
      '--file', filePath,
      '--mode', 'session',
      '--format', 'json',
    ]);

    assert.equal(result.status, 1);

    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.error.code, 'PAPER_ENTRY_LEDGER_OPERATOR_CLI_REPORTER_ERROR');
    assert.match(parsed.error.message, /sessionId is required/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
