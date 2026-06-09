'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const {
  FirstCompletePaperSessionCertification,
} = require('../../../dist/application/runtime/FirstCompletePaperSessionCertification.js');

const {
  JsonPaperEntryLedgerRepositoryAdapter,
} = require('../../../dist/infrastructure/runtime/JsonPaperEntryLedgerRepositoryAdapter.js');

async function tempCertification() {
  const dir = await mkdtemp(join(tmpdir(), 'rlsys-first-certification-'));
  const ledgerFile = join(dir, 'paper-entry-ledger.jsonl');
  const repository = new JsonPaperEntryLedgerRepositoryAdapter({ filePath: ledgerFile });
  const certification = new FirstCompletePaperSessionCertification(repository);

  return { dir, ledgerFile, certification };
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
    notes: ['Certificação da primeira sessão PAPER.'],
    snapshotValidated: true,
    ledgerValidated: true,
    reportExported: true,
    auditExported: true,
    totalWins: 1,
    totalLosses: 1,
    totalSkips: 0,
    closingNotes: ['Sessão encerrada e auditada.'],
    ...overrides,
  };
}

function runCli(args) {
  return spawnSync(
    process.execPath,
    ['scripts/first-complete-paper-session-certification.js', ...args],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    },
  );
}

test('first complete paper session certification certifies valid paper session protocol', async () => {
  const { dir, certification } = await tempCertification();

  try {
    const result = await certification.certify(validInput(), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'PAPER_SESSION_CERTIFIED');
    assert.equal(result.value.preflightVerdict, 'PAPER_OPERATIONAL_GO');
    assert.equal(result.value.manualProtocolStatus, 'MANUAL_PROTOCOL_READY');
    assert.equal(result.value.closingStatus, 'SESSION_CLOSED');
    assert.equal(result.value.certificationCandidate, true);
    assert.equal(result.value.totalChecks, 11);
    assert.equal(result.value.failedChecks, 0);
    assert.equal(result.value.certificationScorePercent, 100);
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

test('first complete paper session certification rejects blocked launch', async () => {
  const { dir, certification } = await tempCertification();

  try {
    const result = await certification.certify(validInput({
      operatorConfirmedLaunch: false,
    }), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'PAPER_SESSION_CERTIFICATION_REJECTED');
    assert.equal(result.value.preflightVerdict, 'PAPER_OPERATIONAL_BLOCKED');
    assert.equal(result.value.failedChecks > 0, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first complete paper session certification rejects blocked closing', async () => {
  const { dir, certification } = await tempCertification();

  try {
    const result = await certification.certify(validInput({
      operatorConfirmedClose: false,
    }), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'PAPER_SESSION_CERTIFICATION_REJECTED');
    assert.equal(result.value.closingStatus, 'SESSION_CLOSING_BLOCKED');
    assert.equal(result.value.certificationCandidate, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first complete paper session certification returns review status when closing is review', async () => {
  const { dir, certification } = await tempCertification();

  try {
    const result = await certification.certify(validInput({
      snapshotValidated: false,
      allowCloseWithReview: true,
    }), 1760000010000);

    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'PAPER_SESSION_CERTIFIED_WITH_REVIEW');
    assert.equal(result.value.closingStatus, 'SESSION_CLOSED_WITH_REVIEW');
    assert.equal(result.value.certificationCandidate, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first complete paper session certification rejects empty session id', async () => {
  const { dir, certification } = await tempCertification();

  try {
    const result = await certification.certify(validInput({
      sessionId: '',
    }), 1760000010000);

    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'FIRST_COMPLETE_PAPER_SESSION_CERTIFICATION_ERROR');
    assert.match(result.error.message, /sessionId is required/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first complete paper session certification text report includes governance and no profit certification', async () => {
  const { dir, certification } = await tempCertification();

  try {
    const result = await certification.textReport(validInput(), 1760000010000);

    assert.equal(result.ok, true);
    assert.match(result.value.text, /FIRST COMPLETE PAPER SESSION CERTIFICATION/);
    assert.match(result.value.text, /Status: PAPER_SESSION_CERTIFIED/);
    assert.match(result.value.text, /CertifiesProfit=false/);
    assert.match(result.value.text, /PaperOnly: true/);
    assert.match(result.value.text, /LiveMoneyAuthorization: false/);
    assert.match(result.value.text, /AutomaticBetExecutionAllowed: false/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('first complete paper session certification CLI prints JSON certification report', async () => {
  const { dir, ledgerFile } = await tempCertification();

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
    assert.equal(parsed.report.status, 'PAPER_SESSION_CERTIFIED');
    assert.equal(parsed.report.certificationScorePercent, 100);
    assert.equal(parsed.report.paperOnly, true);
    assert.equal(parsed.report.liveMoneyAuthorization, false);
    assert.equal(parsed.report.automaticBetExecutionAllowed, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
