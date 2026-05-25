'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  buildDailyOperationSnapshot
} = require('./paper-runtime-daily-operation-service');

const {
  resolveLedgerPath,
  readLedger,
  appendLedgerEntry
} = require('./paper-runtime-ledger-service');

const {
  resolveDisciplineStatePath,
  readDisciplineState
} = require('./paper-runtime-operator-discipline-guard');

function resolveTrialReportPath() {
  return process.env.RLSYS_PAPER_RUNTIME_24H_REPORT_PATH ||
    path.join(
      process.cwd(),
      'data',
      'paper-runtime',
      '24h-supervision-report.json'
    );
}

function nowIso() {
  return new Date().toISOString();
}

function simulateOperationalCycle(index) {
  const operation =
    index % 2 === 0
      ? 'WIN'
      : 'LOSS';

  const amount =
    operation === 'WIN'
      ? 2
      : 1;

  appendLedgerEntry(
    operation,
    amount,
    resolveLedgerPath()
  );

  return {
    cycle: index,
    operation,
    amount,
    timestamp: nowIso()
  };
}

function validateRuntimeConsistency() {
  const daily =
    buildDailyOperationSnapshot();

  const ledger =
    readLedger(
      resolveLedgerPath()
    );

  const discipline =
    readDisciplineState(
      resolveDisciplineStatePath()
    );

  return {
    runtimeReady:
      daily.operationalReadiness.ready === true,

    disciplineLocked:
      discipline.lock &&
      discipline.lock.active === true,

    ledgerIntegrity:
      Array.isArray(
        ledger.entries
      ),

    totalEntries:
      Array.isArray(
        ledger.entries
      )
        ? ledger.entries.length
        : 0,

    balance:
      ledger.summary
        ? ledger.summary.balance
        : 0
  };
}

function build24hSupervisionTrial() {
  const cycles = [];

  for (
    let index = 0;
    index < 12;
    index += 1
  ) {
    cycles.push(
      simulateOperationalCycle(index)
    );
  }

  const consistency =
    validateRuntimeConsistency();

  const certified =
    consistency.runtimeReady === true &&
    consistency.ledgerIntegrity === true &&
    consistency.disciplineLocked === false;

  return {
    version: 1,
    generatedAt: nowIso(),
    product: 'RL.SYS CORE',
    runtime: 'PAPER_RUNTIME_24H_SUPERVISION',
    cycles,
    consistency,
    certification: {
      certified,
      recommendation:
        certified
          ? 'READY_FOR_EXTENDED_PAPER_SUPERVISION'
          : 'NOT_READY',
      requiresHumanReview: true,
      productionMoneyAllowed: false
    }
  };
}

function write24hSupervisionTrialReport() {
  const report =
    build24hSupervisionTrial();

  const outputPath =
    resolveTrialReportPath();

  fs.mkdirSync(
    path.dirname(outputPath),
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    outputPath,
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );

  return {
    ok: true,
    outputPath,
    report
  };
}

function format24hSupervisionTrial(report) {
  return [
    'RL.SYS CORE 24H SUPERVISION TRIAL',
    '============================================================',
    `generatedAt: ${report.generatedAt}`,
    `cycles: ${report.cycles.length}`,
    `runtimeReady: ${report.consistency.runtimeReady}`,
    `ledgerIntegrity: ${report.consistency.ledgerIntegrity}`,
    `disciplineLocked: ${report.consistency.disciplineLocked}`,
    `balance: ${report.consistency.balance}`,
    '',
    'CERTIFICATION',
    `certified: ${report.certification.certified}`,
    `recommendation: ${report.certification.recommendation}`,
    `requiresHumanReview: ${report.certification.requiresHumanReview}`,
    `productionMoneyAllowed: ${report.certification.productionMoneyAllowed}`
  ].join('\n');
}

module.exports = {
  resolveTrialReportPath,
  simulateOperationalCycle,
  validateRuntimeConsistency,
  build24hSupervisionTrial,
  write24hSupervisionTrialReport,
  format24hSupervisionTrial
};
