#!/usr/bin/env node
'use strict';

const path = require('node:path');

const {
  FirstPaperTradingReadinessCommand,
} = require('../dist/application/runtime/FirstPaperTradingReadinessCommand.js');

const {
  JsonPaperEntryLedgerRepositoryAdapter,
} = require('../dist/infrastructure/runtime/JsonPaperEntryLedgerRepositoryAdapter.js');

function parseArgs(argv) {
  const input = {
    file: path.join(process.cwd(), 'data', 'paper-runtime', 'paper-entry-ledger.jsonl'),
    format: 'text',
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
      key === 'latestEntryLimit'
    ) {
      input[key] = Number(value);
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

  if (typeof input.file !== 'string' || input.file.trim().length === 0) {
    throw new Error('--file is required');
  }

  const repository = new JsonPaperEntryLedgerRepositoryAdapter({
    filePath: input.file.trim(),
  });

  const command = new FirstPaperTradingReadinessCommand(repository);

  const policy = {
    minimumRecommendedLedgerEntries: input.minimumRecommendedLedgerEntries,
    maxDeniedByHudRatio: input.maxDeniedByHudRatio,
    maxRejectedByOperatorRatio: input.maxRejectedByOperatorRatio,
    latestEntryLimit: input.latestEntryLimit,
  };

  if (input.format === 'json') {
    const result = await command.evaluate(
      policy,
      Number.isFinite(input.generatedAtEpochMs) ? input.generatedAtEpochMs : Date.now(),
    );

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

  const result = await command.textReport(
    policy,
    Number.isFinite(input.generatedAtEpochMs) ? input.generatedAtEpochMs : Date.now(),
  );

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
      code: 'FIRST_PAPER_TRADING_READINESS_CLI_ERROR',
      message: error instanceof Error ? error.message : String(error),
    },
  });
  process.exitCode = 1;
});
