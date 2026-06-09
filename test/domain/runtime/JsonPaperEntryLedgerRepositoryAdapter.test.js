'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { appendFile, mkdtemp, rm } = require('node:fs/promises');
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
    supervisionId: 'supervision-283',
    generatedAtEpochMs: 1760000000000,
    sessionId: 'paper-session-283',
    strategyName: 'Triplicação',
    hudRecommendation: 'ENTRAR',
    hudRenderedText: 'RL.SYS CORE — PAPER HUD\nRecomendação: ENTRAR ✅',
    operatorDecision: 'CONFIRMAR',
    operatorNote: 'Operador confirmou entrada PAPER supervisionada.',
    requestedStake: 3.5,
    confidencePercent: 92,
    evidence: ['BANKROLL_SAFE', 'DAILY_LOCK_RELEASED', 'TRIPLICACAO_FAVORABLE'],
    ...overrides,
  });

  assert.equal(result.ok, true);
  return result.value;
}

function ledgerEntry(options = {}) {
  const exporter = new PaperEntrySupervisionLedgerExporter();

  const result = exporter.export({
    exportId: options.exportId || 'export-283',
    generatedAtEpochMs: options.exportGeneratedAtEpochMs || 1760000001000,
    format: 'JSON',
    supervision: supervision(options.supervision || {}),
  });

  assert.equal(result.ok, true);
  return result.value.ledgerEntry;
}

async function tempRepo() {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-paper-entry-ledger-'));
  const filePath = join(dir, 'paper-entry-ledger.jsonl');
  const repository = new JsonPaperEntryLedgerRepositoryAdapter({ filePath });

  return { dir, filePath, repository };
}

test('json paper entry ledger repository appends and loads entries through infrastructure adapter', async () => {
  const { dir, repository } = await tempRepo();

  try {
    const appended = await repository.append(ledgerEntry());

    assert.equal(appended.ok, true);
    assert.equal(appended.value.appended, true);
    assert.equal(appended.value.ledgerEntryId.length > 0, true);

    const loaded = await repository.loadAll();

    assert.equal(loaded.ok, true);
    assert.equal(loaded.value.entries.length, 1);
    assert.equal(loaded.value.entries[0].status, 'PAPER_ENTRY_AUTHORIZED');
    assert.equal(loaded.value.entries[0].paperOnly, true);
    assert.equal(loaded.value.entries[0].automaticExecutionAllowed, false);
    assert.equal(loaded.value.entries[0].automaticBetExecutionAllowed, false);
    assert.equal(loaded.value.entries[0].liveMoneyAuthorization, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('json paper entry ledger repository computes operator decision stats', async () => {
  const { dir, repository } = await tempRepo();

  try {
    await repository.append(ledgerEntry({
      exportId: 'export-authorized',
      exportGeneratedAtEpochMs: 1760000001000,
    }));

    await repository.append(ledgerEntry({
      exportId: 'export-rejected',
      exportGeneratedAtEpochMs: 1760000002000,
      supervision: {
        supervisionId: 'supervision-rejected',
        generatedAtEpochMs: 1760000001000,
        operatorDecision: 'RECUSAR',
      },
    }));

    await repository.append(ledgerEntry({
      exportId: 'export-denied',
      exportGeneratedAtEpochMs: 1760000003000,
      supervision: {
        supervisionId: 'supervision-denied',
        generatedAtEpochMs: 1760000002000,
        hudRecommendation: 'AGUARDAR',
        hudRenderedText: 'RL.SYS CORE — PAPER HUD\nRecomendação: AGUARDAR ❌',
      },
    }));

    const stats = await repository.stats();

    assert.equal(stats.ok, true);
    assert.equal(stats.value.totalEntries, 3);
    assert.equal(stats.value.authorizedCount, 1);
    assert.equal(stats.value.rejectedByOperatorCount, 1);
    assert.equal(stats.value.deniedByHudCount, 1);
    assert.notEqual(stats.value.latestEntry, null);
    assert.equal(stats.value.latestEntry.exportId, 'export-denied');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('json paper entry ledger repository returns empty history when file is missing', async () => {
  const { dir, repository } = await tempRepo();

  try {
    const loaded = await repository.loadAll();
    const stats = await repository.stats();

    assert.equal(loaded.ok, true);
    assert.equal(loaded.value.entries.length, 0);
    assert.equal(stats.ok, true);
    assert.equal(stats.value.totalEntries, 0);
    assert.equal(stats.value.authorizedCount, 0);
    assert.equal(stats.value.rejectedByOperatorCount, 0);
    assert.equal(stats.value.deniedByHudCount, 0);
    assert.equal(stats.value.latestEntry, null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('json paper entry ledger repository clears history', async () => {
  const { dir, repository } = await tempRepo();

  try {
    await repository.append(ledgerEntry());

    const cleared = await repository.clear();
    assert.equal(cleared.ok, true);

    const loaded = await repository.loadAll();
    assert.equal(loaded.ok, true);
    assert.equal(loaded.value.entries.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('json paper entry ledger repository rejects invalid entry', async () => {
  const { dir, repository } = await tempRepo();

  try {
    const invalid = {
      ...ledgerEntry(),
      ledgerEntryId: '',
    };

    const result = await repository.append(invalid);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'INVALID_PAPER_ENTRY_LEDGER_REPOSITORY_INPUT');
    assert.equal(result.error.stage, 'VALIDATION');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('json paper entry ledger repository rejects malformed jsonl lines', async () => {
  const { dir, filePath, repository } = await tempRepo();

  try {
    await appendFile(filePath, '{"invalid": true}\n', 'utf8');

    const result = await repository.loadAll();

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'INVALID_PAPER_ENTRY_LEDGER_REPOSITORY_INPUT');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('json paper entry ledger repository constructor rejects invalid path', () => {
  assert.throws(
    () => new JsonPaperEntryLedgerRepositoryAdapter({ filePath: '' }),
    /filePath is required/,
  );
});
