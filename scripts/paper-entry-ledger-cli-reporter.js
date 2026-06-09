#!/usr/bin/env node
'use strict';

const path = require('node:path');

const {
  PaperEntryLedgerQueryService,
} = require('../dist/application/ledger/PaperEntryLedgerQueryService.js');

const {
  JsonPaperEntryLedgerRepositoryAdapter,
} = require('../dist/infrastructure/runtime/JsonPaperEntryLedgerRepositoryAdapter.js');

function parseArgs(argv) {
  const input = {
    file: path.join(process.cwd(), 'data', 'paper-runtime', 'paper-entry-ledger.jsonl'),
    mode: 'latest',
    format: 'text',
    limit: 10,
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
      key === 'limit' ||
      key === 'fromEpochMs' ||
      key === 'toEpochMs' ||
      key === 'minimumConfidencePercent' ||
      key === 'generatedAtEpochMs'
    ) {
      input[key] = Number(value);
    } else {
      input[key] = value;
    }

    index += 1;
  }

  return input;
}

function normalizeMode(value) {
  if (value === 'session') return 'session';
  if (value === 'query') return 'query';
  if (value === 'stats') return 'stats';
  if (value === 'latest') return 'latest';
  return 'latest';
}

function normalizeFormat(value) {
  return value === 'json' ? 'json' : 'text';
}

function buildQuery(input) {
  const query = {};

  if (typeof input.sessionId === 'string' && input.sessionId.trim().length > 0) {
    query.sessionId = input.sessionId.trim();
  }

  if (typeof input.strategyName === 'string' && input.strategyName.trim().length > 0) {
    query.strategyName = input.strategyName.trim();
  }

  if (typeof input.status === 'string' && input.status.trim().length > 0) {
    query.status = input.status.trim();
  }

  if (typeof input.operatorDecision === 'string' && input.operatorDecision.trim().length > 0) {
    query.operatorDecision = input.operatorDecision.trim();
  }

  if (Number.isFinite(input.fromEpochMs)) {
    query.fromEpochMs = input.fromEpochMs;
  }

  if (Number.isFinite(input.toEpochMs)) {
    query.toEpochMs = input.toEpochMs;
  }

  if (Number.isFinite(input.minimumConfidencePercent)) {
    query.minimumConfidencePercent = input.minimumConfidencePercent;
  }

  if (Number.isFinite(input.limit)) {
    query.limit = input.limit;
  }

  if (input.sortOrder === 'ASC' || input.sortOrder === 'DESC') {
    query.sortOrder = input.sortOrder;
  }

  return query;
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const input = parseArgs(process.argv);
  const mode = normalizeMode(input.mode);
  const format = normalizeFormat(input.format);

  if (typeof input.file !== 'string' || input.file.trim().length === 0) {
    throw new Error('--file is required');
  }

  const repository = new JsonPaperEntryLedgerRepositoryAdapter({
    filePath: input.file.trim(),
  });

  const service = new PaperEntryLedgerQueryService(repository);

  if (mode === 'stats') {
    const stats = await repository.stats();

    if (!stats.ok) {
      printJson({ ok: false, error: stats.error });
      process.exitCode = 1;
      return;
    }

    const payload = {
      ok: true,
      mode,
      stats: stats.value,
      paperOnly: true,
      liveMoneyAuthorization: false,
      automaticExecutionAllowed: false,
      automaticBetExecutionAllowed: false,
      humanSupervisionRequired: true,
    };

    if (format === 'json') {
      printJson(payload);
    } else {
      process.stdout.write('RL.SYS CORE — PAPER ENTRY LEDGER STATS\n');
      process.stdout.write('======================================\n');
      process.stdout.write(`Total Entries: ${stats.value.totalEntries}\n`);
      process.stdout.write(`Authorized: ${stats.value.authorizedCount}\n`);
      process.stdout.write(`Rejected By Operator: ${stats.value.rejectedByOperatorCount}\n`);
      process.stdout.write(`Denied By HUD: ${stats.value.deniedByHudCount}\n`);
      process.stdout.write('PaperOnly: true\n');
      process.stdout.write('LiveMoneyAuthorization: false\n');
      process.stdout.write('AutomaticExecutionAllowed: false\n');
      process.stdout.write('AutomaticBetExecutionAllowed: false\n');
      process.stdout.write('HumanSupervisionRequired: true\n');
    }

    return;
  }

  let result;

  if (mode === 'session') {
    if (typeof input.sessionId !== 'string' || input.sessionId.trim().length === 0) {
      throw new Error('--sessionId is required when --mode session');
    }

    result = await service.bySession(input.sessionId.trim(), Number.isFinite(input.limit) ? input.limit : 50);
  } else if (mode === 'query') {
    result = await service.query(buildQuery(input));
  } else {
    result = await service.latest(Number.isFinite(input.limit) ? input.limit : 10);
  }

  if (!result.ok) {
    printJson({ ok: false, error: result.error });
    process.exitCode = 1;
    return;
  }

  if (format === 'json') {
    printJson({
      ok: true,
      mode,
      report: result.value,
    });
    return;
  }

  const textReport = await service.textReport(
    {
      ...buildQuery(input),
      limit: result.value.summary.limit,
      sortOrder: result.value.summary.sortOrder,
    },
    Number.isFinite(input.generatedAtEpochMs) ? input.generatedAtEpochMs : Date.now(),
  );

  if (!textReport.ok) {
    printJson({ ok: false, error: textReport.error });
    process.exitCode = 1;
    return;
  }

  process.stdout.write(textReport.value.text);
}

main().catch((error) => {
  printJson({
    ok: false,
    error: {
      code: 'PAPER_ENTRY_LEDGER_OPERATOR_CLI_REPORTER_ERROR',
      message: error instanceof Error ? error.message : String(error),
    },
  });
  process.exitCode = 1;
});
