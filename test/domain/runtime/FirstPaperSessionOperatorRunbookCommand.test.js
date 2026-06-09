'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const {
  FirstPaperSessionOperatorRunbookCommand,
} = require('../../../dist/application/runtime/FirstPaperSessionOperatorRunbookCommand.js');

const {
  JsonPaperEntryLedgerRepositoryAdapter,
} = require('../../../dist/infrastructure/runtime/JsonPaperEntryLedgerRepositoryAdapter.js');

async function tempRunbook() {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-first-paper-runbook-'));
  const ledgerFile = join(dir, 'paper-entry-ledger.jsonl');
  const repository = new JsonPaperEntryLedgerRepositoryAdapter({ filePath: ledgerFile });
  const command = new FirstPaperSessionOperatorRunbookCommand(repository);

  return { dir, ledgerFile, command };
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
    notes: ['Runbook da primeira sessão PAPER.'],
    ...overrides,
  };
}

function runCli(args) {
  return spawnSync(
    process.execPath,
    ['scripts/first-paper-session-operator-runbook-command.js', ...args],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  );
}

test('first paper session operator runbook returns ready runbook', async () => {
  const { dir, command } = await tempRunbook();

  try {
    const result = await command.compose(readyInput(), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'RUNBOOK_READY');
    assert.equal(result.value.recorderStatus, 'FIRST_PAPER_SESSION_RECORDED');
    assert.equal(result.value.steps.length, 7);
    assert.equal(result.value.paperOnly, true);
    assert.equal(result.value.liveMoneyAuthorization, false);
    assert.equal(result.value.automaticExecutionAllowed, false);
    assert.equal(result.value.automaticBetExecutionAllowed, false);
    assert.equal(result.value.humanSupervisionRequired, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session operator runbook blocks when launch recorder is blocked', async () => {
  const { dir, command } = await tempRunbook();

  try {
    const result = await command.compose(readyInput({
      operatorConfirmedLaunch: false,
    }), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'RUNBOOK_BLOCKED');
    assert.equal(result.value.recorderStatus, 'FIRST_PAPER_SESSION_NOT_RECORDED_BLOCKED');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session operator runbook needs review when allowed review recording exists', async () => {
  const { dir, command } = await tempRunbook();

  try {
    const result = await command.compose(readyInput({
      snapshotPathAvailable: false,
      allowNeedsReviewRecording: true,
    }), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'RUNBOOK_NEEDS_REVIEW');
    assert.equal(result.value.recorderStatus, 'FIRST_PAPER_SESSION_RECORDED_WITH_REVIEW');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session operator runbook rejects empty session id', async () => {
  const { dir, command } = await tempRunbook();

  try {
    const result = await command.compose(readyInput({
      sessionId: '',
    }), 1760000010000);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'FIRST_PAPER_SESSION_OPERATOR_RUNBOOK_COMMAND_ERROR');
    assert.match(result.error.message, /sessionId is required/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session operator runbook text report includes procedural steps and governance', async () => {
  const { dir, command } = await tempRunbook();

  try {
    const result = await command.textReport(readyInput(), 1760000010000);

    assert.equal(result.ok, true);
    assert.match(result.value.text, /FIRST PAPER SESSION OPERATOR RUNBOOK/);
    assert.match(result.value.text, /Status: RUNBOOK_READY/);
    assert.match(result.value.text, /Executar warmup manual/);
    assert.match(result.value.text, /PaperOnly: true/);
    assert.match(result.value.text, /LiveMoneyAuthorization: false/);
    assert.match(result.value.text, /AutomaticBetExecutionAllowed: false/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session operator runbook CLI prints JSON report', async () => {
  const { dir, ledgerFile } = await tempRunbook();

  try {
    const result = runCli([
      '--ledgerFile', ledgerFile,
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
    assert.equal(parsed.report.status, 'RUNBOOK_READY');
    assert.equal(parsed.report.paperOnly, true);
    assert.equal(parsed.report.liveMoneyAuthorization, false);
    assert.equal(parsed.report.automaticBetExecutionAllowed, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session operator runbook CLI blocks without operator confirmation', async () => {
  const { dir, ledgerFile } = await tempRunbook();

  try {
    const result = runCli([
      '--ledgerFile', ledgerFile,
      '--sessionId', 'first-paper-session',
      '--operatorConfirmedLaunch', 'false',
      '--format', 'json',
      '--generatedAtEpochMs', '1760000010000',
    ]);

    assert.equal(result.status, 0);

    const parsed = JSON.parse(result.stdout);

    assert.equal(parsed.ok, true);
    assert.equal(parsed.report.status, 'RUNBOOK_BLOCKED');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
