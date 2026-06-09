'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const {
  FirstPaperTradingSessionLaunchChecklist,
} = require('../../../dist/application/runtime/FirstPaperTradingSessionLaunchChecklist.js');

const {
  JsonPaperEntryLedgerRepositoryAdapter,
} = require('../../../dist/infrastructure/runtime/JsonPaperEntryLedgerRepositoryAdapter.js');

async function tempChecklist() {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-paper-session-launch-'));
  const filePath = join(dir, 'paper-entry-ledger.jsonl');
  const repository = new JsonPaperEntryLedgerRepositoryAdapter({ filePath });
  const checklist = new FirstPaperTradingSessionLaunchChecklist(repository);

  return { dir, filePath, checklist };
}

function runCli(args) {
  return spawnSync(
    process.execPath,
    ['scripts/first-paper-trading-session-launch-checklist.js', ...args],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  );
}

test('first paper session launch checklist returns ready when all launch conditions are confirmed', async () => {
  const { dir, checklist } = await tempChecklist();

  try {
    const result = await checklist.evaluate({
      sessionId: 'first-paper-session',
      operatorConfirmedLaunch: true,
      runtimePaperAvailable: true,
      snapshotPathAvailable: true,
      ledgerPathConfigured: true,
    }, 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'PAPER_SESSION_READY');
    assert.equal(result.value.readinessStatus, 'PAPER_READY');
    assert.equal(result.value.paperOnly, true);
    assert.equal(result.value.liveMoneyAuthorization, false);
    assert.equal(result.value.automaticExecutionAllowed, false);
    assert.equal(result.value.automaticBetExecutionAllowed, false);
    assert.equal(result.value.humanSupervisionRequired, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session launch checklist blocks without operator confirmation', async () => {
  const { dir, checklist } = await tempChecklist();

  try {
    const result = await checklist.evaluate({
      sessionId: 'first-paper-session',
      operatorConfirmedLaunch: false,
      runtimePaperAvailable: true,
      snapshotPathAvailable: true,
      ledgerPathConfigured: true,
    }, 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'PAPER_SESSION_BLOCKED');
    assert.equal(result.value.checks.some((check) => check.name === 'OPERATOR_CONFIRMATION'), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session launch checklist needs review when snapshot path is not confirmed', async () => {
  const { dir, checklist } = await tempChecklist();

  try {
    const result = await checklist.evaluate({
      sessionId: 'first-paper-session',
      operatorConfirmedLaunch: true,
      runtimePaperAvailable: true,
      snapshotPathAvailable: false,
      ledgerPathConfigured: true,
    }, 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'PAPER_SESSION_NEEDS_REVIEW');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session launch checklist rejects empty session id', async () => {
  const { dir, checklist } = await tempChecklist();

  try {
    const result = await checklist.evaluate({
      sessionId: '',
      operatorConfirmedLaunch: true,
      runtimePaperAvailable: true,
      snapshotPathAvailable: true,
      ledgerPathConfigured: true,
    }, 1760000010000);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'FIRST_PAPER_TRADING_SESSION_LAUNCH_CHECKLIST_ERROR');
    assert.match(result.error.message, /sessionId is required/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session launch checklist text report includes governance', async () => {
  const { dir, checklist } = await tempChecklist();

  try {
    const result = await checklist.textReport({
      sessionId: 'first-paper-session',
      operatorConfirmedLaunch: true,
      runtimePaperAvailable: true,
      snapshotPathAvailable: true,
      ledgerPathConfigured: true,
    }, 1760000010000);

    assert.equal(result.ok, true);
    assert.match(result.value.text, /FIRST PAPER SESSION LAUNCH CHECKLIST/);
    assert.match(result.value.text, /Status: PAPER_SESSION_READY/);
    assert.match(result.value.text, /PaperOnly: true/);
    assert.match(result.value.text, /LiveMoneyAuthorization: false/);
    assert.match(result.value.text, /AutomaticBetExecutionAllowed: false/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session launch checklist CLI prints JSON ready report', async () => {
  const { dir, filePath } = await tempChecklist();

  try {
    const result = runCli([
      '--file', filePath,
      '--sessionId', 'first-paper-session',
      '--operatorConfirmedLaunch', 'true',
      '--format', 'json',
      '--generatedAtEpochMs', '1760000010000',
    ]);

    assert.equal(result.status, 0);

    const parsed = JSON.parse(result.stdout);

    assert.equal(parsed.ok, true);
    assert.equal(parsed.report.status, 'PAPER_SESSION_READY');
    assert.equal(parsed.report.paperOnly, true);
    assert.equal(parsed.report.liveMoneyAuthorization, false);
    assert.equal(parsed.report.automaticBetExecutionAllowed, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session launch checklist CLI blocks when operator confirmation is missing', async () => {
  const { dir, filePath } = await tempChecklist();

  try {
    const result = runCli([
      '--file', filePath,
      '--sessionId', 'first-paper-session',
      '--format', 'json',
      '--generatedAtEpochMs', '1760000010000',
    ]);

    assert.equal(result.status, 0);

    const parsed = JSON.parse(result.stdout);

    assert.equal(parsed.ok, true);
    assert.equal(parsed.report.status, 'PAPER_SESSION_BLOCKED');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
