#!/usr/bin/env node
'use strict';

const { appendFile, mkdir } = require('node:fs/promises');
const path = require('node:path');

const {
  PaperTradingRepeatSessionStarter,
} = require('../dist/application/runtime/PaperTradingRepeatSessionStarter.js');

const {
  JsonPaperEntryLedgerRepositoryAdapter,
} = require('../dist/infrastructure/runtime/JsonPaperEntryLedgerRepositoryAdapter.js');

function parseArgs(argv) {
  const input = {
    ledgerFile: path.join(process.cwd(), 'data', 'paper-runtime', 'paper-entry-ledger.jsonl'),
    startRecordFile: path.join(process.cwd(), 'data', 'paper-runtime', 'paper-repeat-session-starts.jsonl'),
    sessionId: '',
    format: 'text',
    appendStartRecord: true,
    operatorConfirmedLaunch: false,
    operatorConfirmedClose: false,
    runtimePaperAvailable: true,
    snapshotPathAvailable: true,
    ledgerPathConfigured: true,
    snapshotValidated: true,
    ledgerValidated: true,
    reportExported: true,
    auditExported: true,
    realPlatformObserved: true,
    realMoneyBlocked: true,
    automaticExecutionBlocked: true,
    operatorReady: false,
    strategyName: 'Triplicação',
    requirePerfectCertification: true,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const value = argv[index + 1];

    if (value === undefined || value.startsWith('--')) {
      input[key] = true;
      continue;
    }

    if (
      key === 'generatedAtEpochMs' ||
      key === 'minimumRecommendedLedgerEntries' ||
      key === 'maxDeniedByHudRatio' ||
      key === 'maxRejectedByOperatorRatio' ||
      key === 'plannedRounds' ||
      key === 'totalWins' ||
      key === 'totalLosses' ||
      key === 'totalSkips' ||
      key === 'minimumCertificationScorePercent'
    ) {
      input[key] = Number(value);
    } else if (
      key === 'appendStartRecord' ||
      key === 'operatorConfirmedLaunch' ||
      key === 'operatorConfirmedClose' ||
      key === 'runtimePaperAvailable' ||
      key === 'snapshotPathAvailable' ||
      key === 'ledgerPathConfigured' ||
      key === 'allowNeedsReviewRecording' ||
      key === 'snapshotValidated' ||
      key === 'ledgerValidated' ||
      key === 'reportExported' ||
      key === 'auditExported' ||
      key === 'allowCloseWithReview' ||
      key === 'requirePerfectCertification' ||
      key === 'realPlatformObserved' ||
      key === 'realMoneyBlocked' ||
      key === 'automaticExecutionBlocked' ||
      key === 'operatorReady'
    ) {
      input[key] = value === 'true';
    } else if (key === 'note') {
      if (!Array.isArray(input.notes)) {
        input.notes = [];
      }
      input.notes.push(value);
    } else if (key === 'closingNote') {
      if (!Array.isArray(input.closingNotes)) {
        input.closingNotes = [];
      }
      input.closingNotes.push(value);
    } else {
      input[key] = value;
    }

    index += 1;
  }

  return input;
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function appendStartRecord(recordFile, record) {
  await mkdir(path.dirname(recordFile), { recursive: true });
  await appendFile(recordFile, `${JSON.stringify(record)}\n`, 'utf8');
}

async function main() {
  const input = parseArgs(process.argv);

  if (typeof input.ledgerFile !== 'string' || input.ledgerFile.trim().length === 0) {
    throw new Error('--ledgerFile is required');
  }

  if (typeof input.startRecordFile !== 'string' || input.startRecordFile.trim().length === 0) {
    throw new Error('--startRecordFile is required');
  }

  const repository = new JsonPaperEntryLedgerRepositoryAdapter({
    filePath: input.ledgerFile.trim(),
  });

  const starter = new PaperTradingRepeatSessionStarter(repository);

  const payload = {
    sessionId: input.sessionId,
    repeatSessionId: input.repeatSessionId,
    repeatSessionLabel: input.repeatSessionLabel,
    operatorConfirmedLaunch: input.operatorConfirmedLaunch === true,
    operatorConfirmedClose: input.operatorConfirmedClose === true,
    runtimePaperAvailable: input.runtimePaperAvailable !== false,
    snapshotPathAvailable: input.snapshotPathAvailable !== false,
    ledgerPathConfigured: input.ledgerPathConfigured !== false,
    minimumRecommendedLedgerEntries: input.minimumRecommendedLedgerEntries,
    maxDeniedByHudRatio: input.maxDeniedByHudRatio,
    maxRejectedByOperatorRatio: input.maxRejectedByOperatorRatio,
    operatorId: input.operatorId,
    tableId: input.tableId,
    strategyName: input.strategyName,
    bankrollLabel: input.bankrollLabel,
    plannedRounds: input.plannedRounds,
    notes: Array.isArray(input.notes) ? input.notes : [],
    allowNeedsReviewRecording: input.allowNeedsReviewRecording === true,
    snapshotValidated: input.snapshotValidated !== false,
    ledgerValidated: input.ledgerValidated !== false,
    reportExported: input.reportExported !== false,
    auditExported: input.auditExported !== false,
    totalWins: input.totalWins,
    totalLosses: input.totalLosses,
    totalSkips: input.totalSkips,
    closingNotes: Array.isArray(input.closingNotes) ? input.closingNotes : [],
    allowCloseWithReview: input.allowCloseWithReview === true,
    minimumCertificationScorePercent: input.minimumCertificationScorePercent,
    requirePerfectCertification: input.requirePerfectCertification !== false,
    realPlatformObserved: input.realPlatformObserved !== false,
    realMoneyBlocked: input.realMoneyBlocked !== false,
    automaticExecutionBlocked: input.automaticExecutionBlocked !== false,
    operatorReady: input.operatorReady === true,
  };

  const generatedAtEpochMs = Number.isFinite(input.generatedAtEpochMs)
    ? input.generatedAtEpochMs
    : Date.now();

  const result = await starter.start(payload, generatedAtEpochMs);

  if (!result.ok) {
    printJson({ ok: false, error: result.error });
    process.exitCode = 1;
    return;
  }

  let persisted = false;

  if (input.appendStartRecord === true && result.value.status === 'PAPER_REPEAT_READY') {
    await appendStartRecord(input.startRecordFile.trim(), result.value);
    persisted = true;
  }

  if (input.format === 'json') {
    printJson({
      ok: true,
      persisted,
      startRecordFile: input.startRecordFile,
      report: result.value,
    });
    return;
  }

  const text = await starter.textReport(payload, generatedAtEpochMs);

  if (!text.ok) {
    printJson({ ok: false, error: text.error });
    process.exitCode = 1;
    return;
  }

  process.stdout.write(text.value.text);
  process.stdout.write(`Persisted: ${persisted}\n`);
  process.stdout.write(`StartRecordFile: ${input.startRecordFile}\n`);
}

main().catch((error) => {
  printJson({
    ok: false,
    error: {
      code: 'PAPER_TRADING_REPEAT_SESSION_STARTER_CLI_ERROR',
      message: error instanceof Error ? error.message : String(error),
    },
  });
  process.exitCode = 1;
});
