'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const {
  PaperTradingRepeatSessionStarter,
} = require('../../../dist/application/runtime/PaperTradingRepeatSessionStarter.js');

const {
  JsonPaperEntryLedgerRepositoryAdapter,
} = require('../../../dist/infrastructure/runtime/JsonPaperEntryLedgerRepositoryAdapter.js');

async function tempStarter() {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-repeat-starter-'));
  const ledgerFile = join(dir, 'paper-entry-ledger.jsonl');
  const startRecordFile = join(dir, 'paper-repeat-session-starts.jsonl');
  const repository = new JsonPaperEntryLedgerRepositoryAdapter({ filePath: ledgerFile });
  const starter = new PaperTradingRepeatSessionStarter(repository);

  return { dir, ledgerFile, startRecordFile, starter };
}

function validInput(overrides = {}) {
  return {
    sessionId: 'first-paper-session',
    repeatSessionId: 'paper-test-001',
    repeatSessionLabel: 'PAPER_TEST_001_REAL_TABLE_OBSERVED',
    operatorConfirmedLaunch: true,
    operatorConfirmedClose: true,
    runtimePaperAvailable: true,
    snapshotPathAvailable: true,
    ledgerPathConfigured: true,
    operatorId: 'operator-001',
    tableId: 'mesa-real-observada-001',
    strategyName: 'Triplicação',
    bankrollLabel: 'PAPER_BRL_70',
    plannedRounds: 200,
    notes: ['Sessão PAPER em plataforma real observada sem dinheiro real.'],
    snapshotValidated: true,
    ledgerValidated: true,
    reportExported: true,
    auditExported: true,
    totalWins: 1,
    totalLosses: 1,
    totalSkips: 0,
    closingNotes: ['Sessão anterior certificada.'],
    minimumCertificationScorePercent: 100,
    requirePerfectCertification: true,
    realPlatformObserved: true,
    realMoneyBlocked: true,
    automaticExecutionBlocked: true,
    operatorReady: true,
    ...overrides,
  };
}

function runCli(args) {
  return spawnSync(
    process.execPath,
    ['scripts/paper-trading-repeat-session-starter.js', ...args],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  );
}

test('paper trading repeat session starter returns ready start record', async () => {
  const { dir, starter } = await tempStarter();

  try {
    const result = await starter.start(validInput(), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'PAPER_REPEAT_READY');
    assert.equal(result.value.repeatSessionId, 'paper-test-001');
    assert.equal(result.value.acceptanceGateStatus, 'PAPER_ACCEPTED');
    assert.equal(result.value.realPlatformObserved, true);
    assert.equal(result.value.realMoneyBlocked, true);
    assert.equal(result.value.automaticExecutionBlocked, true);
    assert.equal(result.value.operatorReady, true);
    assert.equal(result.value.paperOnly, true);
    assert.equal(result.value.liveMoneyAuthorization, false);
    assert.equal(result.value.automaticExecutionAllowed, false);
    assert.equal(result.value.automaticBetExecutionAllowed, false);
    assert.equal(result.value.humanSupervisionRequired, true);
    assert.equal(result.value.checksum.length, 64);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper trading repeat session starter blocks when operator is not ready', async () => {
  const { dir, starter } = await tempStarter();

  try {
    const result = await starter.start(validInput({
      operatorReady: false,
    }), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'PAPER_REPEAT_BLOCKED');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper trading repeat session starter blocks when real money is not blocked', async () => {
  const { dir, starter } = await tempStarter();

  try {
    const result = await starter.start(validInput({
      realMoneyBlocked: false,
    }), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'PAPER_REPEAT_BLOCKED');
    assert.equal(result.value.liveMoneyAuthorization, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper trading repeat session starter blocks when automatic execution is not blocked', async () => {
  const { dir, starter } = await tempStarter();

  try {
    const result = await starter.start(validInput({
      automaticExecutionBlocked: false,
    }), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'PAPER_REPEAT_BLOCKED');
    assert.equal(result.value.automaticExecutionAllowed, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper trading repeat session starter rejects empty source session id', async () => {
  const { dir, starter } = await tempStarter();

  try {
    const result = await starter.start(validInput({
      sessionId: '',
    }), 1760000010000);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'PAPER_TRADING_REPEAT_SESSION_STARTER_ERROR');
    assert.match(result.error.message, /sessionId is required/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper trading repeat session starter text report includes governance', async () => {
  const { dir, starter } = await tempStarter();

  try {
    const result = await starter.textReport(validInput(), 1760000010000);

    assert.equal(result.ok, true);
    assert.match(result.value.text, /PAPER TRADING REPEAT SESSION STARTER/);
    assert.match(result.value.text, /Status: PAPER_REPEAT_READY/);
    assert.match(result.value.text, /RealMoneyBlocked: true/);
    assert.match(result.value.text, /AutomaticExecutionBlocked: true/);
    assert.match(result.value.text, /PaperOnly: true/);
    assert.match(result.value.text, /LiveMoneyAuthorization: false/);
    assert.match(result.value.text, /AutomaticBetExecutionAllowed: false/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper trading repeat session starter CLI persists ready start record', async () => {
  const { dir, ledgerFile, startRecordFile } = await tempStarter();

  try {
    const result = runCli([
      '--ledgerFile', ledgerFile,
      '--startRecordFile', startRecordFile,
      '--sessionId', 'first-paper-session',
      '--repeatSessionId', 'paper-test-001',
      '--repeatSessionLabel', 'PAPER_TEST_001_REAL_TABLE_OBSERVED',
      '--operatorConfirmedLaunch', 'true',
      '--operatorConfirmedClose', 'true',
      '--operatorId', 'operator-001',
      '--tableId', 'mesa-real-observada-001',
      '--strategyName', 'Triplicação',
      '--bankrollLabel', 'PAPER_BRL_70',
      '--plannedRounds', '200',
      '--totalWins', '1',
      '--totalLosses', '1',
      '--totalSkips', '0',
      '--operatorReady', 'true',
      '--format', 'json',
      '--generatedAtEpochMs', '1760000010000',
    ]);

    assert.equal(result.status, 0);

    const parsed = JSON.parse(result.stdout);

    assert.equal(parsed.ok, true);
    assert.equal(parsed.persisted, true);
    assert.equal(parsed.report.status, 'PAPER_REPEAT_READY');

    const raw = await readFile(startRecordFile, 'utf8');
    const persisted = JSON.parse(raw.trim());

    assert.equal(persisted.repeatSessionId, 'paper-test-001');
    assert.equal(persisted.paperOnly, true);
    assert.equal(persisted.liveMoneyAuthorization, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('paper trading repeat session starter CLI does not persist blocked start record', async () => {
  const { dir, ledgerFile, startRecordFile } = await tempStarter();

  try {
    const result = runCli([
      '--ledgerFile', ledgerFile,
      '--startRecordFile', startRecordFile,
      '--sessionId', 'first-paper-session',
      '--operatorConfirmedLaunch', 'true',
      '--operatorConfirmedClose', 'true',
      '--operatorReady', 'false',
      '--format', 'json',
      '--generatedAtEpochMs', '1760000010000',
    ]);

    assert.equal(result.status, 0);

    const parsed = JSON.parse(result.stdout);

    assert.equal(parsed.ok, true);
    assert.equal(parsed.persisted, false);
    assert.equal(parsed.report.status, 'PAPER_REPEAT_BLOCKED');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
