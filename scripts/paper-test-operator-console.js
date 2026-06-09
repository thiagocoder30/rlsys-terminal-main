#!/usr/bin/env node
'use strict';

const readline = require('node:readline');
const path = require('node:path');

const {
  PaperTestOperatorConsole,
} = require('../dist/application/runtime/PaperTestOperatorConsole.js');

const {
  JsonPaperEntryLedgerRepositoryAdapter,
} = require('../dist/infrastructure/runtime/JsonPaperEntryLedgerRepositoryAdapter.js');

function parseArgs(argv) {
  const input = {
    ledgerFile: path.join(process.cwd(), 'data', 'paper-runtime', 'paper-entry-ledger.jsonl'),
    sessionId: 'first-paper-session',
    repeatSessionId: 'PAPER_TEST_001',
    operatorId: 'Thiago',
    tableId: 'mesa-real-observada-001',
    strategyName: 'Triplicação',
    bankrollLabel: 'PAPER_BRL_70',
    plannedRounds: 200,
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

    if (key === 'plannedRounds') {
      input[key] = Number(value);
    } else {
      input[key] = value;
    }

    index += 1;
  }

  return input;
}

function printResult(result) {
  if (!result.ok) {
    console.log(`ERROR: ${result.error.message}`);
    return;
  }

  console.log('');
  console.log(result.message);
  console.log('');
  console.log(`Status: ${result.status}`);
  console.log(`Next: ${result.nextAction}`);
  console.log('');
}

async function main() {
  const input = parseArgs(process.argv);

  const repository = new JsonPaperEntryLedgerRepositoryAdapter({
    filePath: input.ledgerFile,
  });

  const consoleEngine = new PaperTestOperatorConsole({
    repository,
    sessionId: input.sessionId,
    repeatSessionId: input.repeatSessionId,
    operatorId: input.operatorId,
    tableId: input.tableId,
    strategyName: input.strategyName,
    bankrollLabel: input.bankrollLabel,
    plannedRounds: input.plannedRounds,
  });

  console.log('RL.SYS CORE — PAPER TEST OPERATOR CONSOLE');
  console.log('=========================================');
  console.log(`Session: ${input.repeatSessionId}`);
  console.log('Mode: PAPER ONLY');
  console.log('LiveMoneyAuthorization: false');
  console.log('AutomaticExecutionAllowed: false');
  console.log('AutomaticBetExecutionAllowed: false');
  console.log('');
  console.log('Type help for commands.');
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'rlsys> ',
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const command = line.trim();
    const result = await consoleEngine.execute(command);

    printResult(result);

    if (command.toLowerCase() === 'exit') {
      rl.close();
      return;
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('Paper Test Operator Console closed.');
  });
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: {
      code: 'PAPER_TEST_OPERATOR_CONSOLE_CLI_ERROR',
      message: error instanceof Error ? error.message : String(error),
    },
  }, null, 2));
  process.exitCode = 1;
});
