'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const {
  FirstSupervisedPaperTradingSessionRecorder,
} = require('../../../dist/application/runtime/FirstSupervisedPaperTradingSessionRecorder.js');

const {
  JsonPaperEntryLedgerRepositoryAdapter,
} = require('../../../dist/infrastructure/runtime/JsonPaperEntryLedgerRepositoryAdapter.js');

async function tempRecorder() {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-first-paper-recorder-'));
  const ledgerFile = join(dir, 'paper-entry-ledger.jsonl');
  const recordFile = join(dir, 'first-supervised-paper-session-records.jsonl');
  const repository = new JsonPaperEntryLedgerRepositoryAdapter({ filePath: ledgerFile });
  const recorder = new FirstSupervisedPaperTradingSessionRecorder(repository);

  return { dir, ledgerFile, recordFile, recorder };
}

function readyInput(overrides = {}) {
  return {
    sessionId: 'first-paper-session',
    operatorConfirmedLaunch: true,
    runtimePaperAvailable: true,
    snapshotPathAvailable: true,
    ledgerPathConfigured: true,
    operatorId: 'operator-001',
    tableId: 'mesa-paper-001',
    strategyName: 'Triplicação',
    bankrollLabel: 'PAPER_BRL_70',
    plannedRounds: 200,
    notes: ['Primeira sessão PAPER supervisionada.'],
    ...overrides,
  };
}

function runCli(args) {
  return spawnSync(
    process.execPath,
    ['scripts/first-supervised-paper-trading-session-recorder.js', ...args],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  );
}

test('first supervised paper trading session recorder creates ready audit record', async () => {
  const { dir, recorder } = await tempRecorder();

  try {
    const result = await recorder.record(readyInput(), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.recorded, true);
    assert.equal(result.value.record.status, 'FIRST_PAPER_SESSION_RECORDED');
    assert.equal(result.value.record.launchStatus, 'PAPER_SESSION_READY');
    assert.equal(result.value.record.sessionId, 'first-paper-session');
    assert.equal(result.value.record.operatorId, 'operator-001');
    assert.equal(result.value.record.strategyName, 'Triplicação');
    assert.equal(result.value.record.paperOnly, true);
    assert.equal(result.value.record.liveMoneyAuthorization, false);
    assert.equal(result.value.record.automaticExecutionAllowed, false);
    assert.equal(result.value.record.automaticBetExecutionAllowed, false);
    assert.equal(result.value.record.humanSupervisionRequired, true);
    assert.equal(result.value.record.checksum.length, 64);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first supervised paper trading session recorder does not record blocked launch', async () => {
  const { dir, recorder } = await tempRecorder();

  try {
    const result = await recorder.record(readyInput({
      operatorConfirmedLaunch: false,
    }), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.recorded, false);
    assert.equal(result.value.record.status, 'FIRST_PAPER_SESSION_NOT_RECORDED_BLOCKED');
    assert.equal(result.value.record.launchStatus, 'PAPER_SESSION_BLOCKED');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first supervised paper trading session recorder can record needs-review launch only when explicitly allowed', async () => {
  const { dir, recorder } = await tempRecorder();

  try {
    const blockedByDefault = await recorder.record(readyInput({
      snapshotPathAvailable: false,
    }), 1760000010000);

    const allowed = await recorder.record(readyInput({
      snapshotPathAvailable: false,
      allowNeedsReviewRecording: true,
    }), 1760000010000);

    assert.equal(blockedByDefault.ok, true);
    assert.equal(blockedByDefault.value.recorded, false);
    assert.equal(blockedByDefault.value.record.status, 'FIRST_PAPER_SESSION_NOT_RECORDED_BLOCKED');

    assert.equal(allowed.ok, true);
    assert.equal(allowed.value.recorded, true);
    assert.equal(allowed.value.record.status, 'FIRST_PAPER_SESSION_RECORDED_WITH_REVIEW');
    assert.equal(allowed.value.record.launchStatus, 'PAPER_SESSION_NEEDS_REVIEW');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first supervised paper trading session recorder rejects empty session id', async () => {
  const { dir, recorder } = await tempRecorder();

  try {
    const result = await recorder.record(readyInput({
      sessionId: '',
    }), 1760000010000);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'FIRST_SUPERVISED_PAPER_TRADING_SESSION_RECORDER_ERROR');
    assert.match(result.error.message, /sessionId is required/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first supervised paper trading session recorder text report includes governance', async () => {
  const { dir, recorder } = await tempRecorder();

  try {
    const result = await recorder.textReport(readyInput(), 1760000010000);

    assert.equal(result.ok, true);
    assert.match(result.value.text, /FIRST SUPERVISED PAPER TRADING SESSION RECORD/);
    assert.match(result.value.text, /RecordStatus: FIRST_PAPER_SESSION_RECORDED/);
    assert.match(result.value.text, /PaperOnly: true/);
    assert.match(result.value.text, /LiveMoneyAuthorization: false/);
    assert.match(result.value.text, /AutomaticBetExecutionAllowed: false/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first supervised paper trading session recorder CLI persists JSONL record', async () => {
  const { dir, ledgerFile, recordFile } = await tempRecorder();

  try {
    const result = runCli([
      '--ledgerFile', ledgerFile,
      '--recordFile', recordFile,
      '--sessionId', 'first-paper-session',
      '--operatorConfirmedLaunch', 'true',
      '--operatorId', 'operator-001',
      '--tableId', 'mesa-paper-001',
      '--strategyName', 'Triplicação',
      '--bankrollLabel', 'PAPER_BRL_70',
      '--plannedRounds', '200',
      '--format', 'json',
      '--generatedAtEpochMs', '1760000010000',
    ]);

    assert.equal(result.status, 0);

    const parsed = JSON.parse(result.stdout);

    assert.equal(parsed.ok, true);
    assert.equal(parsed.persisted, true);
    assert.equal(parsed.report.recorded, true);
    assert.equal(parsed.report.record.status, 'FIRST_PAPER_SESSION_RECORDED');

    const raw = await readFile(recordFile, 'utf8');
    const lines = raw.trim().split('\n');

    assert.equal(lines.length, 1);

    const persisted = JSON.parse(lines[0]);
    assert.equal(persisted.sessionId, 'first-paper-session');
    assert.equal(persisted.paperOnly, true);
    assert.equal(persisted.liveMoneyAuthorization, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first supervised paper trading session recorder CLI does not persist blocked record', async () => {
  const { dir, ledgerFile, recordFile } = await tempRecorder();

  try {
    const result = runCli([
      '--ledgerFile', ledgerFile,
      '--recordFile', recordFile,
      '--sessionId', 'first-paper-session',
      '--operatorConfirmedLaunch', 'false',
      '--format', 'json',
      '--generatedAtEpochMs', '1760000010000',
    ]);

    assert.equal(result.status, 0);

    const parsed = JSON.parse(result.stdout);

    assert.equal(parsed.ok, true);
    assert.equal(parsed.persisted, false);
    assert.equal(parsed.report.recorded, false);
    assert.equal(parsed.report.record.status, 'FIRST_PAPER_SESSION_NOT_RECORDED_BLOCKED');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
