'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const {
  FirstPaperSessionManualExecutionProtocol,
} = require('../../../dist/application/runtime/FirstPaperSessionManualExecutionProtocol.js');

const {
  JsonPaperEntryLedgerRepositoryAdapter,
} = require('../../../dist/infrastructure/runtime/JsonPaperEntryLedgerRepositoryAdapter.js');

async function tempProtocol() {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-manual-protocol-'));
  const ledgerFile = join(dir, 'paper-entry-ledger.jsonl');
  const repository = new JsonPaperEntryLedgerRepositoryAdapter({ filePath: ledgerFile });
  const protocol = new FirstPaperSessionManualExecutionProtocol(repository);

  return { dir, ledgerFile, protocol };
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
    notes: ['Manual execution protocol.'],
    ...overrides,
  };
}

function runCli(args) {
  return spawnSync(
    process.execPath,
    ['scripts/first-paper-session-manual-execution-protocol.js', ...args],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  );
}

test('manual execution protocol returns ready protocol with eight phases', async () => {
  const { dir, protocol } = await tempProtocol();

  try {
    const result = await protocol.compose(readyInput(), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'MANUAL_PROTOCOL_READY');
    assert.equal(result.value.preflightVerdict, 'PAPER_OPERATIONAL_GO');
    assert.equal(result.value.totalPhases, 8);
    assert.equal(result.value.totalSteps, 24);
    assert.deepEqual(
      result.value.phases.map((phase) => phase.phaseId),
      [
        'OPEN_SESSION',
        'WARMUP_COLLECTION',
        'CONTEXT_QUALIFICATION',
        'SUGGESTION_MONITORING',
        'OPERATOR_CONFIRMATION',
        'PAPER_REGISTRATION',
        'SESSION_CLOSE',
        'AUDIT_EXPORT',
      ],
    );
    assert.equal(result.value.paperOnly, true);
    assert.equal(result.value.liveMoneyAuthorization, false);
    assert.equal(result.value.automaticExecutionAllowed, false);
    assert.equal(result.value.automaticBetExecutionAllowed, false);
    assert.equal(result.value.humanSupervisionRequired, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('manual execution protocol blocks when final preflight is blocked', async () => {
  const { dir, protocol } = await tempProtocol();

  try {
    const result = await protocol.compose(readyInput({
      operatorConfirmedLaunch: false,
    }), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'MANUAL_PROTOCOL_BLOCKED');
    assert.equal(result.value.preflightVerdict, 'PAPER_OPERATIONAL_BLOCKED');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('manual execution protocol returns review status when review preflight is allowed', async () => {
  const { dir, protocol } = await tempProtocol();

  try {
    const result = await protocol.compose(readyInput({
      snapshotPathAvailable: false,
      allowNeedsReviewRecording: true,
    }), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'MANUAL_PROTOCOL_REVIEW');
    assert.equal(result.value.preflightVerdict, 'PAPER_OPERATIONAL_REVIEW');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('manual execution protocol rejects empty session id', async () => {
  const { dir, protocol } = await tempProtocol();

  try {
    const result = await protocol.compose(readyInput({
      sessionId: '',
    }), 1760000010000);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'FIRST_PAPER_SESSION_MANUAL_EXECUTION_PROTOCOL_ERROR');
    assert.match(result.error.message, /sessionId is required/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('manual execution protocol text report includes phases and governance', async () => {
  const { dir, protocol } = await tempProtocol();

  try {
    const result = await protocol.textReport(readyInput(), 1760000010000);

    assert.equal(result.ok, true);
    assert.match(result.value.text, /FIRST PAPER SESSION MANUAL EXECUTION PROTOCOL/);
    assert.match(result.value.text, /WARMUP_COLLECTION/);
    assert.match(result.value.text, /PAPER_REGISTRATION/);
    assert.match(result.value.text, /AUDIT_EXPORT/);
    assert.match(result.value.text, /PaperOnly: true/);
    assert.match(result.value.text, /LiveMoneyAuthorization: false/);
    assert.match(result.value.text, /AutomaticBetExecutionAllowed: false/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('manual execution protocol CLI prints JSON report', async () => {
  const { dir, ledgerFile } = await tempProtocol();

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
    assert.equal(parsed.report.status, 'MANUAL_PROTOCOL_READY');
    assert.equal(parsed.report.totalPhases, 8);
    assert.equal(parsed.report.totalSteps, 24);
    assert.equal(parsed.report.paperOnly, true);
    assert.equal(parsed.report.liveMoneyAuthorization, false);
    assert.equal(parsed.report.automaticBetExecutionAllowed, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('manual execution protocol CLI blocks without operator confirmation', async () => {
  const { dir, ledgerFile } = await tempProtocol();

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
    assert.equal(parsed.report.status, 'MANUAL_PROTOCOL_BLOCKED');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
