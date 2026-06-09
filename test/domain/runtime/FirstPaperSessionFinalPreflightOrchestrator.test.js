'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const {
  FirstPaperSessionFinalPreflightOrchestrator,
} = require('../../../dist/application/runtime/FirstPaperSessionFinalPreflightOrchestrator.js');

const {
  JsonPaperEntryLedgerRepositoryAdapter,
} = require('../../../dist/infrastructure/runtime/JsonPaperEntryLedgerRepositoryAdapter.js');

async function tempOrchestrator() {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-final-preflight-'));
  const ledgerFile = join(dir, 'paper-entry-ledger.jsonl');
  const repository = new JsonPaperEntryLedgerRepositoryAdapter({ filePath: ledgerFile });
  const orchestrator = new FirstPaperSessionFinalPreflightOrchestrator(repository);

  return { dir, ledgerFile, orchestrator };
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
    notes: ['Preflight final da primeira sessão PAPER.'],
    ...overrides,
  };
}

function runCli(args) {
  return spawnSync(
    process.execPath,
    ['scripts/first-paper-session-final-preflight-orchestrator.js', ...args],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  );
}

test('first paper session final preflight returns operational go', async () => {
  const { dir, orchestrator } = await tempOrchestrator();

  try {
    const result = await orchestrator.evaluate(readyInput(), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.verdict, 'PAPER_OPERATIONAL_GO');
    assert.equal(result.value.readinessStatus, 'PAPER_READY');
    assert.equal(result.value.launchStatus, 'PAPER_SESSION_READY');
    assert.equal(result.value.recorderStatus, 'FIRST_PAPER_SESSION_RECORDED');
    assert.equal(result.value.runbookStatus, 'RUNBOOK_READY');
    assert.equal(result.value.paperOnly, true);
    assert.equal(result.value.liveMoneyAuthorization, false);
    assert.equal(result.value.automaticExecutionAllowed, false);
    assert.equal(result.value.automaticBetExecutionAllowed, false);
    assert.equal(result.value.humanSupervisionRequired, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session final preflight blocks without operator confirmation', async () => {
  const { dir, orchestrator } = await tempOrchestrator();

  try {
    const result = await orchestrator.evaluate(readyInput({
      operatorConfirmedLaunch: false,
    }), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.verdict, 'PAPER_OPERATIONAL_BLOCKED');
    assert.equal(result.value.launchStatus, 'PAPER_SESSION_BLOCKED');
    assert.equal(result.value.recorderStatus, 'FIRST_PAPER_SESSION_NOT_RECORDED_BLOCKED');
    assert.equal(result.value.runbookStatus, 'RUNBOOK_BLOCKED');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session final preflight returns review when review recording is explicitly allowed', async () => {
  const { dir, orchestrator } = await tempOrchestrator();

  try {
    const result = await orchestrator.evaluate(readyInput({
      snapshotPathAvailable: false,
      allowNeedsReviewRecording: true,
    }), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.verdict, 'PAPER_OPERATIONAL_REVIEW');
    assert.equal(result.value.launchStatus, 'PAPER_SESSION_NEEDS_REVIEW');
    assert.equal(result.value.recorderStatus, 'FIRST_PAPER_SESSION_RECORDED_WITH_REVIEW');
    assert.equal(result.value.runbookStatus, 'RUNBOOK_NEEDS_REVIEW');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session final preflight rejects empty session id', async () => {
  const { dir, orchestrator } = await tempOrchestrator();

  try {
    const result = await orchestrator.evaluate(readyInput({
      sessionId: '',
    }), 1760000010000);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'FIRST_PAPER_SESSION_FINAL_PREFLIGHT_ORCHESTRATOR_ERROR');
    assert.match(result.error.message, /sessionId is required/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session final preflight text report includes final verdict and governance', async () => {
  const { dir, orchestrator } = await tempOrchestrator();

  try {
    const result = await orchestrator.textReport(readyInput(), 1760000010000);

    assert.equal(result.ok, true);
    assert.match(result.value.text, /FIRST PAPER SESSION FINAL PREFLIGHT/);
    assert.match(result.value.text, /Verdict: PAPER_OPERATIONAL_GO/);
    assert.match(result.value.text, /PaperOnly: true/);
    assert.match(result.value.text, /LiveMoneyAuthorization: false/);
    assert.match(result.value.text, /AutomaticBetExecutionAllowed: false/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session final preflight CLI prints JSON go report', async () => {
  const { dir, ledgerFile } = await tempOrchestrator();

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
    assert.equal(parsed.report.verdict, 'PAPER_OPERATIONAL_GO');
    assert.equal(parsed.report.paperOnly, true);
    assert.equal(parsed.report.liveMoneyAuthorization, false);
    assert.equal(parsed.report.automaticBetExecutionAllowed, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first paper session final preflight CLI blocks when operator confirmation is missing', async () => {
  const { dir, ledgerFile } = await tempOrchestrator();

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
    assert.equal(parsed.report.verdict, 'PAPER_OPERATIONAL_BLOCKED');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
