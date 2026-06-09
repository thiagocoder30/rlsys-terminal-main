'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const {
  FirstPaperSessionClosingProtocol,
} = require('../../../dist/application/runtime/FirstPaperSessionClosingProtocol.js');

const {
  OperatorEntrySupervisionController,
} = require('../../../dist/application/runtime/OperatorEntrySupervisionController.js');

const {
  PaperEntrySupervisionLedgerExporter,
} = require('../../../dist/application/runtime/PaperEntrySupervisionLedgerExporter.js');

const {
  JsonPaperEntryLedgerRepositoryAdapter,
} = require('../../../dist/infrastructure/runtime/JsonPaperEntryLedgerRepositoryAdapter.js');

async function tempClosing() {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-closing-protocol-'));
  const ledgerFile = join(dir, 'paper-entry-ledger.jsonl');
  const repository = new JsonPaperEntryLedgerRepositoryAdapter({ filePath: ledgerFile });
  const protocol = new FirstPaperSessionClosingProtocol(repository);

  return { dir, ledgerFile, repository, protocol };
}

function supervision(overrides = {}) {
  const controller = new OperatorEntrySupervisionController();

  const result = controller.supervise({
    supervisionId: overrides.supervisionId || 'supervision-292',
    generatedAtEpochMs: overrides.generatedAtEpochMs || 1760000000000,
    sessionId: overrides.sessionId || 'first-paper-session',
    strategyName: overrides.strategyName || 'Triplicação',
    hudRecommendation: overrides.hudRecommendation || 'ENTRAR',
    hudRenderedText: overrides.hudRenderedText || 'RL.SYS CORE — PAPER HUD\nRecomendação: ENTRAR ✅',
    operatorDecision: overrides.operatorDecision || 'CONFIRMAR',
    operatorNote: overrides.operatorNote === undefined
      ? 'Operador confirmou entrada PAPER supervisionada.'
      : overrides.operatorNote,
    requestedStake: overrides.requestedStake || 3.5,
    confidencePercent: overrides.confidencePercent || 92,
    evidence: overrides.evidence || ['BANKROLL_SAFE', 'DAILY_LOCK_RELEASED'],
  });

  assert.equal(result.ok, true);
  return result.value;
}

function ledgerEntry(options = {}) {
  const exporter = new PaperEntrySupervisionLedgerExporter();

  const result = exporter.export({
    exportId: options.exportId || 'export-292',
    generatedAtEpochMs: options.exportGeneratedAtEpochMs || 1760000001000,
    format: 'JSON',
    supervision: supervision(options.supervision || {}),
  });

  assert.equal(result.ok, true);
  return result.value.ledgerEntry;
}

async function seedLedger(repository) {
  await repository.append(ledgerEntry({
    exportId: 'export-close-1',
    exportGeneratedAtEpochMs: 1760000001000,
  }));
  await repository.append(ledgerEntry({
    exportId: 'export-close-2',
    exportGeneratedAtEpochMs: 1760000002000,
  }));
}

function readyClose(overrides = {}) {
  return {
    sessionId: 'first-paper-session',
    operatorConfirmedClose: true,
    ledgerValidated: true,
    snapshotValidated: true,
    reportExported: true,
    auditExported: true,
    totalWins: 1,
    totalLosses: 1,
    totalSkips: 0,
    closingNotes: ['Sessão PAPER encerrada conforme protocolo.'],
    ...overrides,
  };
}

function runCli(args) {
  return spawnSync(
    process.execPath,
    ['scripts/first-paper-session-closing-protocol.js', ...args],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  );
}

test('first paper session closing protocol closes valid paper session', async () => {
  const { dir, repository, protocol } = await tempClosing();

  try {
    await seedLedger(repository);

    const result = await protocol.close(readyClose(), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'SESSION_CLOSED');
    assert.equal(result.value.certificationCandidate, true);
    assert.equal(result.value.totalEntries, 2);
    assert.equal(result.value.totalWins, 1);
    assert.equal(result.value.totalLosses, 1);
    assert.equal(result.value.paperOnly, true);
    assert.equal(result.value.liveMoneyAuthorization, false);
    assert.equal(result.value.automaticExecutionAllowed, false);
    assert.equal(result.value.automaticBetExecutionAllowed, false);
    assert.equal(result.value.humanSupervisionRequired, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session closing protocol blocks without operator confirmation', async () => {
  const { dir, repository, protocol } = await tempClosing();

  try {
    await seedLedger(repository);

    const result = await protocol.close(readyClose({
      operatorConfirmedClose: false,
    }), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'SESSION_CLOSING_BLOCKED');
    assert.equal(result.value.certificationCandidate, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session closing protocol closes with review when snapshot missing and explicitly allowed', async () => {
  const { dir, repository, protocol } = await tempClosing();

  try {
    await seedLedger(repository);

    const result = await protocol.close(readyClose({
      snapshotValidated: false,
      allowCloseWithReview: true,
    }), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'SESSION_CLOSED_WITH_REVIEW');
    assert.equal(result.value.certificationCandidate, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session closing protocol rejects empty session id', async () => {
  const { dir, protocol } = await tempClosing();

  try {
    const result = await protocol.close(readyClose({
      sessionId: '',
    }), 1760000010000);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'FIRST_PAPER_SESSION_CLOSING_PROTOCOL_ERROR');
    assert.match(result.error.message, /sessionId is required/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session closing protocol text report includes audit and governance', async () => {
  const { dir, repository, protocol } = await tempClosing();

  try {
    await seedLedger(repository);

    const result = await protocol.textReport(readyClose(), 1760000010000);

    assert.equal(result.ok, true);
    assert.match(result.value.text, /FIRST PAPER SESSION CLOSING PROTOCOL/);
    assert.match(result.value.text, /Status: SESSION_CLOSED/);
    assert.match(result.value.text, /CertificationCandidate: true/);
    assert.match(result.value.text, /PaperOnly: true/);
    assert.match(result.value.text, /LiveMoneyAuthorization: false/);
    assert.match(result.value.text, /AutomaticBetExecutionAllowed: false/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session closing protocol CLI prints JSON closing report', async () => {
  const { dir, ledgerFile, repository } = await tempClosing();

  try {
    await seedLedger(repository);

    const result = runCli([
      '--ledgerFile', ledgerFile,
      '--sessionId', 'first-paper-session',
      '--operatorConfirmedClose', 'true',
      '--totalWins', '1',
      '--totalLosses', '1',
      '--totalSkips', '0',
      '--format', 'json',
      '--generatedAtEpochMs', '1760000010000',
    ]);

    assert.equal(result.status, 0);

    const parsed = JSON.parse(result.stdout);

    assert.equal(parsed.ok, true);
    assert.equal(parsed.report.status, 'SESSION_CLOSED');
    assert.equal(parsed.report.certificationCandidate, true);
    assert.equal(parsed.report.paperOnly, true);
    assert.equal(parsed.report.liveMoneyAuthorization, false);
    assert.equal(parsed.report.automaticBetExecutionAllowed, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session closing protocol CLI blocks without operator confirmation', async () => {
  const { dir, ledgerFile, repository } = await tempClosing();

  try {
    await seedLedger(repository);

    const result = runCli([
      '--ledgerFile', ledgerFile,
      '--sessionId', 'first-paper-session',
      '--operatorConfirmedClose', 'false',
      '--format', 'json',
      '--generatedAtEpochMs', '1760000010000',
    ]);

    assert.equal(result.status, 0);

    const parsed = JSON.parse(result.stdout);

    assert.equal(parsed.ok, true);
    assert.equal(parsed.report.status, 'SESSION_CLOSING_BLOCKED');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
