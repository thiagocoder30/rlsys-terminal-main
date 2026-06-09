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
  FirstPaperTradingReadinessCommand,
} = require('../../../dist/application/runtime/FirstPaperTradingReadinessCommand.js');

const {
  JsonPaperEntryLedgerRepositoryAdapter,
} = require('../../../dist/infrastructure/runtime/JsonPaperEntryLedgerRepositoryAdapter.js');

function supervision(overrides = {}) {
  const controller = new OperatorEntrySupervisionController();

  const result = controller.supervise({
    supervisionId: overrides.supervisionId || 'supervision-286',
    generatedAtEpochMs: overrides.generatedAtEpochMs || 1760000000000,
    sessionId: overrides.sessionId || 'paper-session-286',
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
    exportId: options.exportId || 'export-286',
    generatedAtEpochMs: options.exportGeneratedAtEpochMs || 1760000001000,
    format: 'JSON',
    supervision: supervision(options.supervision || {}),
  });

  assert.equal(result.ok, true);
  return result.value.ledgerEntry;
}

async function tempReadiness() {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-first-paper-readiness-'));
  const filePath = join(dir, 'paper-entry-ledger.jsonl');
  const repository = new JsonPaperEntryLedgerRepositoryAdapter({ filePath });
  const command = new FirstPaperTradingReadinessCommand(repository);

  return { dir, filePath, repository, command };
}

function runCli(args) {
  return spawnSync(
    process.execPath,
    ['scripts/first-paper-trading-readiness-command.js', ...args],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  );
}

test('first paper trading readiness returns PAPER_READY for empty first-session ledger', async () => {
  const { dir, command } = await tempReadiness();

  try {
    const result = await command.evaluate({}, 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'PAPER_READY');
    assert.equal(result.value.totalEntries, 0);
    assert.equal(result.value.paperOnly, true);
    assert.equal(result.value.liveMoneyAuthorization, false);
    assert.equal(result.value.automaticExecutionAllowed, false);
    assert.equal(result.value.automaticBetExecutionAllowed, false);
    assert.equal(result.value.humanSupervisionRequired, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper trading readiness returns PAPER_READY with healthy ledger history', async () => {
  const { dir, repository, command } = await tempReadiness();

  try {
    await repository.append(ledgerEntry({
      exportId: 'export-ready-1',
      exportGeneratedAtEpochMs: 1760000001000,
      supervision: { supervisionId: 'supervision-ready-1' },
    }));

    await repository.append(ledgerEntry({
      exportId: 'export-ready-2',
      exportGeneratedAtEpochMs: 1760000002000,
      supervision: { supervisionId: 'supervision-ready-2' },
    }));

    const result = await command.evaluate({
      minimumRecommendedLedgerEntries: 1,
      maxDeniedByHudRatio: 0.8,
      maxRejectedByOperatorRatio: 0.8,
    }, 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'PAPER_READY');
    assert.equal(result.value.totalEntries, 2);
    assert.equal(result.value.authorizedCount, 2);
    assert.equal(result.value.latestEntryCount, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper trading readiness returns NEEDS_REVIEW when denial ratio is high', async () => {
  const { dir, repository, command } = await tempReadiness();

  try {
    await repository.append(ledgerEntry({
      exportId: 'export-denied-1',
      exportGeneratedAtEpochMs: 1760000001000,
      supervision: {
        supervisionId: 'supervision-denied-1',
        hudRecommendation: 'AGUARDAR',
        hudRenderedText: 'RL.SYS CORE — PAPER HUD\nRecomendação: AGUARDAR ❌',
      },
    }));

    await repository.append(ledgerEntry({
      exportId: 'export-denied-2',
      exportGeneratedAtEpochMs: 1760000002000,
      supervision: {
        supervisionId: 'supervision-denied-2',
        hudRecommendation: 'AGUARDAR',
        hudRenderedText: 'RL.SYS CORE — PAPER HUD\nRecomendação: AGUARDAR ❌',
      },
    }));

    const result = await command.evaluate({
      maxDeniedByHudRatio: 0.25,
    }, 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'NEEDS_REVIEW');
    assert.equal(result.value.deniedByHudCount, 2);
    assert.equal(result.value.checks.some((check) => check.name === 'HUD_DENIAL_RATIO'), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper trading readiness text report includes governance and recommendation', async () => {
  const { dir, command } = await tempReadiness();

  try {
    const result = await command.textReport({}, 1760000010000);

    assert.equal(result.ok, true);
    assert.match(result.value.text, /FIRST PAPER TRADING READINESS/);
    assert.match(result.value.text, /Status: PAPER_READY/);
    assert.match(result.value.text, /PaperOnly: true/);
    assert.match(result.value.text, /LiveMoneyAuthorization: false/);
    assert.match(result.value.text, /AutomaticBetExecutionAllowed: false/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper trading readiness CLI prints JSON readiness report', async () => {
  const { dir, filePath, repository } = await tempReadiness();

  try {
    await repository.append(ledgerEntry({
      exportId: 'export-cli-ready',
      exportGeneratedAtEpochMs: 1760000001000,
    }));

    const result = runCli([
      '--file', filePath,
      '--format', 'json',
      '--generatedAtEpochMs', '1760000010000',
    ]);

    assert.equal(result.status, 0);

    const parsed = JSON.parse(result.stdout);

    assert.equal(parsed.ok, true);
    assert.equal(parsed.report.status, 'PAPER_READY');
    assert.equal(parsed.report.paperOnly, true);
    assert.equal(parsed.report.liveMoneyAuthorization, false);
    assert.equal(parsed.report.automaticExecutionAllowed, false);
    assert.equal(parsed.report.automaticBetExecutionAllowed, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper trading readiness CLI prints text readiness report for missing default ledger', async () => {
  const { dir, filePath } = await tempReadiness();

  try {
    const result = runCli([
      '--file', filePath,
      '--format', 'text',
      '--generatedAtEpochMs', '1760000010000',
    ]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /FIRST PAPER TRADING READINESS/);
    assert.match(result.stdout, /Status: PAPER_READY/);
    assert.match(result.stdout, /Total Entries: 0/);
    assert.match(result.stdout, /HumanSupervisionRequired: true/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
