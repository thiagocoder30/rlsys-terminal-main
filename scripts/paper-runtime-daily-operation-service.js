'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  resolveLedgerPath,
  readLedger
} = require('./paper-runtime-ledger-service');

const {
  resolveDisciplineStatePath,
  readDisciplineState
} = require('./paper-runtime-operator-discipline-guard');

function resolveDailyOperationPath() {
  return process.env.RLSYS_PAPER_RUNTIME_DAILY_OPERATION_PATH ||
    path.join(
      process.cwd(),
      'data',
      'paper-runtime',
      'daily-operation.json'
    );
}

function nowIso() {
  return new Date().toISOString();
}

function readJsonSafely(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const raw = fs.readFileSync(
      filePath,
      'utf8'
    ).trim();

    if (raw.length === 0) {
      return null;
    }

    const parsed = JSON.parse(raw);

    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function validateRuntimeEnvironment() {
  return {
    ok: true,
    nodeVersion: process.version,
    cwd: process.cwd(),
    timestamp: nowIso()
  };
}

function validateLedgerState() {
  const ledgerPath = resolveLedgerPath();
  const ledger = readLedger(ledgerPath);

  return {
    ok: true,
    ledgerPath,
    summary: ledger.summary || {
      wins: 0,
      losses: 0,
      balance: 0,
      maxDrawdown: 0
    }
  };
}

function validateDisciplineState() {
  const disciplinePath =
    resolveDisciplineStatePath();

  const discipline =
    readDisciplineState(disciplinePath);

  return {
    ok: true,
    disciplinePath,
    lock:
      discipline.lock || {
        active: false
      },
    warnings:
      Array.isArray(
        discipline.warnings
      )
        ? discipline.warnings.slice(-10)
        : []
  };
}

function buildDailyOperationSnapshot() {
  const runtime =
    validateRuntimeEnvironment();

  const ledger =
    validateLedgerState();

  const discipline =
    validateDisciplineState();

  const snapshot = {
    version: 1,
    generatedAt: nowIso(),
    product: 'RL.SYS CORE',
    mode: 'PAPER_RUNTIME_DAILY_OPERATION',
    runtime,
    ledger,
    discipline,
    operationalReadiness: {
      ready:
        runtime.ok &&
        ledger.ok &&
        discipline.ok &&
        !discipline.lock.active,
      blockedByDiscipline:
        discipline.lock.active === true
    }
  };

  return snapshot;
}

function writeDailyOperationSnapshot() {
  const snapshot =
    buildDailyOperationSnapshot();

  const outputPath =
    resolveDailyOperationPath();

  fs.mkdirSync(
    path.dirname(outputPath),
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    outputPath,
    `${JSON.stringify(snapshot, null, 2)}\n`,
    'utf8'
  );

  return {
    ok: true,
    outputPath,
    snapshot
  };
}

function formatDailyOperationSnapshot(snapshot) {
  return [
    'RL.SYS CORE DAILY OPERATION',
    '============================================================',
    `generatedAt: ${snapshot.generatedAt}`,
    `ready: ${snapshot.operationalReadiness.ready}`,
    `blockedByDiscipline: ${snapshot.operationalReadiness.blockedByDiscipline}`,
    '',
    'LEDGER',
    `balance: ${snapshot.ledger.summary.balance}`,
    `wins: ${snapshot.ledger.summary.wins}`,
    `losses: ${snapshot.ledger.summary.losses}`,
    `maxDrawdown: ${snapshot.ledger.summary.maxDrawdown}`,
    '',
    'DISCIPLINE',
    `lockActive: ${snapshot.discipline.lock.active}`,
    `warnings: ${snapshot.discipline.warnings.length}`
  ].join('\n');
}

module.exports = {
  resolveDailyOperationPath,
  validateRuntimeEnvironment,
  validateLedgerState,
  validateDisciplineState,
  buildDailyOperationSnapshot,
  writeDailyOperationSnapshot,
  formatDailyOperationSnapshot
};
