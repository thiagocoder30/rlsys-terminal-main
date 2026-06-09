'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const {
  PaperTradingAcceptanceGate,
} = require('../../../dist/application/runtime/PaperTradingAcceptanceGate.js');

const {
  JsonPaperEntryLedgerRepositoryAdapter,
} = require('../../../dist/infrastructure/runtime/JsonPaperEntryLedgerRepositoryAdapter.js');

async function tempGate() {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-paper-acceptance-'));
  const ledgerFile = join(dir, 'paper-entry-ledger.jsonl');
  const repository = new JsonPaperEntryLedgerRepositoryAdapter({ filePath: ledgerFile });
  const gate = new PaperTradingAcceptanceGate(repository);

  return { dir, ledgerFile, gate };
}

function validInput(overrides = {}) {
  return {
    sessionId: 'first-paper-session',
    operatorConfirmedLaunch: true,
    operatorConfirmedClose: true,
    runtimePaperAvailable: true,
    snapshotPathAvailable: true,
    ledgerPathConfigured: true,
    operatorId: 'operator-001',
    tableId: 'mesa-paper-001',
    strategyName: 'Triplicação',
    bankrollLabel: 'PAPER_BRL_70',
    plannedRounds: 200,
    notes: ['Acceptance gate da primeira sessão PAPER.'],
    snapshotValidated: true,
    ledgerValidated: true,
    reportExported: true,
    auditExported: true,
    totalWins: 1,
    totalLosses: 1,
    totalSkips: 0,
    closingNotes: ['Sessão certificada para aceitação PAPER.'],
    minimumCertificationScorePercent: 100,
    requirePerfectCertification: true,
    ...overrides,
  };
}

function runCli(args) {
  return spawnSync(
    process.execPath,
    ['scripts/paper-trading-acceptance-gate.js', ...args],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  );
}

test('paper trading acceptance gate accepts certified paper session for repeat paper sessions', async () => {
  const { dir, gate } = await tempGate();

  try {
    const result = await gate.evaluate(validInput(), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'PAPER_ACCEPTED');
    assert.equal(result.value.certificationStatus, 'PAPER_SESSION_CERTIFIED');
    assert.equal(result.value.certificationScorePercent, 100);
    assert.equal(result.value.acceptedForRepeatPaperSessions, true);
    assert.equal(result.value.rejectedForPaperSessions, false);
    assert.equal(result.value.requiresHumanReview, false);
    assert.equal(result.value.paperOnly, true);
    assert.equal(result.value.liveMoneyAuthorization, false);
    assert.equal(result.value.automaticExecutionAllowed, false);
    assert.equal(result.value.automaticBetExecutionAllowed, false);
    assert.equal(result.value.humanSupervisionRequired, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper trading acceptance gate rejects failed certification', async () => {
  const { dir, gate } = await tempGate();

  try {
    const result = await gate.evaluate(validInput({
      operatorConfirmedLaunch: false,
    }), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'PAPER_REJECTED');
    assert.equal(result.value.certificationStatus, 'PAPER_SESSION_CERTIFICATION_REJECTED');
    assert.equal(result.value.acceptedForRepeatPaperSessions, false);
    assert.equal(result.value.rejectedForPaperSessions, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper trading acceptance gate requires review for reviewed certification', async () => {
  const { dir, gate } = await tempGate();

  try {
    const result = await gate.evaluate(validInput({
      snapshotValidated: false,
      allowCloseWithReview: true,
      requirePerfectCertification: false,
      minimumCertificationScorePercent: 80,
    }), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'PAPER_NEEDS_REVIEW');
    assert.equal(result.value.certificationStatus, 'PAPER_SESSION_CERTIFIED_WITH_REVIEW');
    assert.equal(result.value.requiresHumanReview, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper trading acceptance gate rejects empty session id', async () => {
  const { dir, gate } = await tempGate();

  try {
    const result = await gate.evaluate(validInput({
      sessionId: '',
    }), 1760000010000);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'PAPER_TRADING_ACCEPTANCE_GATE_ERROR');
    assert.match(result.error.message, /sessionId is required/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper trading acceptance gate text report includes governance and no live-money certification', async () => {
  const { dir, gate } = await tempGate();

  try {
    const result = await gate.textReport(validInput(), 1760000010000);

    assert.equal(result.ok, true);
    assert.match(result.value.text, /PAPER TRADING ACCEPTANCE GATE/);
    assert.match(result.value.text, /Status: PAPER_ACCEPTED/);
    assert.match(result.value.text, /CertifiesLiveMoney: false/);
    assert.match(result.value.text, /CertifiesProfit: false/);
    assert.match(result.value.text, /PaperOnly: true/);
    assert.match(result.value.text, /LiveMoneyAuthorization: false/);
    assert.match(result.value.text, /AutomaticBetExecutionAllowed: false/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper trading acceptance gate CLI prints JSON accepted report', async () => {
  const { dir, ledgerFile } = await tempGate();

  try {
    const result = runCli([
      '--ledgerFile', ledgerFile,
      '--sessionId', 'first-paper-session',
      '--operatorConfirmedLaunch', 'true',
      '--operatorConfirmedClose', 'true',
      '--operatorId', 'operator-001',
      '--tableId', 'mesa-paper-001',
      '--strategyName', 'Triplicação',
      '--bankrollLabel', 'PAPER_BRL_70',
      '--plannedRounds', '200',
      '--totalWins', '1',
      '--totalLosses', '1',
      '--totalSkips', '0',
      '--format', 'json',
      '--generatedAtEpochMs', '1760000010000',
    ]);

    assert.equal(result.status, 0);

    const parsed = JSON.parse(result.stdout);

    assert.equal(parsed.ok, true);
    assert.equal(parsed.report.status, 'PAPER_ACCEPTED');
    assert.equal(parsed.report.acceptedForRepeatPaperSessions, true);
    assert.equal(parsed.report.paperOnly, true);
    assert.equal(parsed.report.liveMoneyAuthorization, false);
    assert.equal(parsed.report.automaticBetExecutionAllowed, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
