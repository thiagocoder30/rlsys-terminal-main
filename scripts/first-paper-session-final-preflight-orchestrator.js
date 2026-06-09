#!/usr/bin/env node
'use strict';

const path = require('node:path');

const {
  FirstPaperSessionFinalPreflightOrchestrator,
} = require('../dist/application/runtime/FirstPaperSessionFinalPreflightOrchestrator.js');

const {
  JsonPaperEntryLedgerRepositoryAdapter,
} = require('../dist/infrastructure/runtime/JsonPaperEntryLedgerRepositoryAdapter.js');

function parseArgs(argv) {
  const input = {
    ledgerFile: path.join(process.cwd(), 'data', 'paper-runtime', 'paper-entry-ledger.jsonl'),
    sessionId: '',
    format: 'text',
    operatorConfirmedLaunch: false,
    runtimePaperAvailable: true,
    snapshotPathAvailable: true,
    ledgerPathConfigured: true,
    strategyName: 'Triplicação',
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
      key === 'plannedRounds'
    ) {
      input[key] = Number(value);
    } else if (
      key === 'operatorConfirmedLaunch' ||
      key === 'runtimePaperAvailable' ||
      key === 'snapshotPathAvailable' ||
      key === 'ledgerPathConfigured' ||
      key === 'allowNeedsReviewRecording'
    ) {
      input[key] = value === 'true';
    } else if (key === 'note') {
      if (!Array.isArray(input.notes)) {
        input.notes = [];
      }
      input.notes.push(value);
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

async function main() {
  const input = parseArgs(process.argv);

  if (typeof input.ledgerFile !== 'string' || input.ledgerFile.trim().length === 0) {
    throw new Error('--ledgerFile is required');
  }

  const repository = new JsonPaperEntryLedgerRepositoryAdapter({
    filePath: input.ledgerFile.trim(),
  });

  const orchestrator = new FirstPaperSessionFinalPreflightOrchestrator(repository);

  const payload = {
    sessionId: input.sessionId,
    operatorConfirmedLaunch: input.operatorConfirmedLaunch === true,
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
  };

  const generatedAtEpochMs = Number.isFinite(input.generatedAtEpochMs)
    ? input.generatedAtEpochMs
    : Date.now();

  if (input.format === 'json') {
    const result = await orchestrator.evaluate(payload, generatedAtEpochMs);

    if (!result.ok) {
      printJson({ ok: false, error: result.error });
      process.exitCode = 1;
      return;
    }

    printJson({
      ok: true,
      report: result.value,
    });

    return;
  }

  const result = await orchestrator.textReport(payload, generatedAtEpochMs);

  if (!result.ok) {
    printJson({ ok: false, error: result.error });
    process.exitCode = 1;
    return;
  }

  process.stdout.write(result.value.text);
}

main().catch((error) => {
  printJson({
    ok: false,
    error: {
      code: 'FIRST_PAPER_SESSION_FINAL_PREFLIGHT_ORCHESTRATOR_CLI_ERROR',
      message: error instanceof Error ? error.message : String(error),
    },
  });
  process.exitCode = 1;
});
