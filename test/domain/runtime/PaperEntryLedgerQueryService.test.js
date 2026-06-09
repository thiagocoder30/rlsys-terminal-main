'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const {
  OperatorEntrySupervisionController,
} = require('../../../dist/application/runtime/OperatorEntrySupervisionController.js');

const {
  PaperEntrySupervisionLedgerExporter,
} = require('../../../dist/application/runtime/PaperEntrySupervisionLedgerExporter.js');

const {
  PaperEntryLedgerQueryService,
} = require('../../../dist/application/ledger/PaperEntryLedgerQueryService.js');

const {
  JsonPaperEntryLedgerRepositoryAdapter,
} = require('../../../dist/infrastructure/runtime/JsonPaperEntryLedgerRepositoryAdapter.js');

function supervision(overrides = {}) {
  const controller = new OperatorEntrySupervisionController();

  const result = controller.supervise({
    supervisionId: overrides.supervisionId || 'supervision-284',
    generatedAtEpochMs: overrides.generatedAtEpochMs || 1760000000000,
    sessionId: overrides.sessionId || 'paper-session-284',
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
    exportId: options.exportId || 'export-284',
    generatedAtEpochMs: options.exportGeneratedAtEpochMs || 1760000001000,
    format: 'JSON',
    supervision: supervision(options.supervision || {}),
  });

  assert.equal(result.ok, true);
  return result.value.ledgerEntry;
}

async function tempQueryService() {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-paper-entry-query-'));
  const filePath = join(dir, 'paper-entry-ledger.jsonl');
  const repository = new JsonPaperEntryLedgerRepositoryAdapter({ filePath });
  const service = new PaperEntryLedgerQueryService(repository);

  return { dir, repository, service };
}

test('paper entry ledger query service returns latest entries in descending order', async () => {
  const { dir, repository, service } = await tempQueryService();

  try {
    await repository.append(ledgerEntry({
      exportId: 'export-old',
      exportGeneratedAtEpochMs: 1760000001000,
      supervision: {
        supervisionId: 'supervision-old',
        generatedAtEpochMs: 1760000000000,
      },
    }));

    await repository.append(ledgerEntry({
      exportId: 'export-new',
      exportGeneratedAtEpochMs: 1760000003000,
      supervision: {
        supervisionId: 'supervision-new',
        generatedAtEpochMs: 1760000002000,
      },
    }));

    const result = await service.latest(10);

    assert.equal(result.ok, true);
    assert.equal(result.value.entries.length, 2);
    assert.equal(result.value.entries[0].exportId, 'export-new');
    assert.equal(result.value.entries[1].exportId, 'export-old');
    assert.equal(result.value.paperOnly, true);
    assert.equal(result.value.liveMoneyAuthorization, false);
    assert.equal(result.value.automaticExecutionAllowed, false);
    assert.equal(result.value.automaticBetExecutionAllowed, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper entry ledger query service filters by session and confidence', async () => {
  const { dir, repository, service } = await tempQueryService();

  try {
    await repository.append(ledgerEntry({
      exportId: 'export-session-a',
      exportGeneratedAtEpochMs: 1760000001000,
      supervision: {
        supervisionId: 'supervision-a',
        sessionId: 'session-a',
        confidencePercent: 93,
      },
    }));

    await repository.append(ledgerEntry({
      exportId: 'export-session-b',
      exportGeneratedAtEpochMs: 1760000002000,
      supervision: {
        supervisionId: 'supervision-b',
        sessionId: 'session-b',
        confidencePercent: 75,
      },
    }));

    const result = await service.query({
      sessionId: 'session-a',
      minimumConfidencePercent: 90,
      limit: 20,
    });

    assert.equal(result.ok, true);
    assert.equal(result.value.entries.length, 1);
    assert.equal(result.value.entries[0].sessionId, 'session-a');
    assert.equal(result.value.summary.scannedEntries, 2);
    assert.equal(result.value.summary.matchedEntries, 1);
    assert.equal(result.value.summary.returnedEntries, 1);
    assert.equal(result.value.summary.truncated, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper entry ledger query service filters rejected and denied decisions', async () => {
  const { dir, repository, service } = await tempQueryService();

  try {
    await repository.append(ledgerEntry({
      exportId: 'export-authorized',
      exportGeneratedAtEpochMs: 1760000001000,
      supervision: {
        supervisionId: 'supervision-authorized',
      },
    }));

    await repository.append(ledgerEntry({
      exportId: 'export-rejected',
      exportGeneratedAtEpochMs: 1760000002000,
      supervision: {
        supervisionId: 'supervision-rejected',
        operatorDecision: 'RECUSAR',
      },
    }));

    await repository.append(ledgerEntry({
      exportId: 'export-denied',
      exportGeneratedAtEpochMs: 1760000003000,
      supervision: {
        supervisionId: 'supervision-denied',
        hudRecommendation: 'AGUARDAR',
        hudRenderedText: 'RL.SYS CORE — PAPER HUD\nRecomendação: AGUARDAR ❌',
      },
    }));

    const rejected = await service.query({
      status: 'PAPER_ENTRY_REJECTED_BY_OPERATOR',
      operatorDecision: 'RECUSAR',
    });

    const denied = await service.query({
      status: 'PAPER_ENTRY_DENIED_BY_HUD',
      operatorDecision: 'CONFIRMAR',
    });

    assert.equal(rejected.ok, true);
    assert.equal(rejected.value.entries.length, 1);
    assert.equal(rejected.value.entries[0].exportId, 'export-rejected');

    assert.equal(denied.ok, true);
    assert.equal(denied.value.entries.length, 1);
    assert.equal(denied.value.entries[0].exportId, 'export-denied');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper entry ledger query service enforces bounded limit and truncation summary', async () => {
  const { dir, repository, service } = await tempQueryService();

  try {
    await repository.append(ledgerEntry({
      exportId: 'export-1',
      exportGeneratedAtEpochMs: 1760000001000,
      supervision: { supervisionId: 'supervision-1' },
    }));
    await repository.append(ledgerEntry({
      exportId: 'export-2',
      exportGeneratedAtEpochMs: 1760000002000,
      supervision: { supervisionId: 'supervision-2' },
    }));
    await repository.append(ledgerEntry({
      exportId: 'export-3',
      exportGeneratedAtEpochMs: 1760000003000,
      supervision: { supervisionId: 'supervision-3' },
    }));

    const result = await service.query({ limit: 2 });

    assert.equal(result.ok, true);
    assert.equal(result.value.entries.length, 2);
    assert.equal(result.value.summary.matchedEntries, 3);
    assert.equal(result.value.summary.returnedEntries, 2);
    assert.equal(result.value.summary.truncated, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper entry ledger query service generates operator text report', async () => {
  const { dir, repository, service } = await tempQueryService();

  try {
    await repository.append(ledgerEntry({
      exportId: 'export-report',
      exportGeneratedAtEpochMs: 1760000001000,
      supervision: { supervisionId: 'supervision-report' },
    }));

    const report = await service.textReport({ limit: 5 }, 1760000010000);

    assert.equal(report.ok, true);
    assert.match(report.value.text, /PAPER ENTRY LEDGER QUERY REPORT/);
    assert.match(report.value.text, /Total Entries: 1/);
    assert.match(report.value.text, /PaperOnly: true/);
    assert.match(report.value.text, /LiveMoneyAuthorization: false/);
    assert.equal(report.value.paperOnly, true);
    assert.equal(report.value.automaticBetExecutionAllowed, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
