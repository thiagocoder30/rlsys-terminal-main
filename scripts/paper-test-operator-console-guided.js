#!/usr/bin/env node
'use strict';

const readline = require('node:readline');
const path = require('node:path');

const {
  PaperTestOperatorConsole,
} = require('../dist/application/runtime/PaperTestOperatorConsole.js');

const {
  OperatorGuidedHud,
} = require('../dist/application/runtime/OperatorGuidedHud.js');

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

    if (!token.startsWith('--')) continue;

    const key = token.slice(2);
    const value = argv[index + 1];

    if (value === undefined || value.startsWith('--')) {
      input[key] = true;
      continue;
    }

    input[key] = key === 'plannedRounds' ? Number(value) : value;
    index += 1;
  }

  return input;
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

  const hud = new OperatorGuidedHud();

  process.stdout.write(hud.renderFromState(consoleEngine.snapshot()).texto);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'rlsys> ',
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const command = line.trim();
    const result = await consoleEngine.execute(command);

    if (!result.ok) {
      console.log('');
      console.log('=================================================');
      console.log('RL.SYS CORE — ERRO OPERACIONAL');
      console.log('=================================================');
      console.log(`Mensagem: ${result.error.message}`);
      console.log('Dinheiro real permanece BLOQUEADO.');
      console.log('Execução automática permanece BLOQUEADA.');
      console.log('=================================================');
      console.log('');
    } else {
      process.stdout.write(hud.renderAfterCommand(result).texto);
    }

    if (command.toLowerCase() === 'exit') {
      rl.close();
      return;
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log('HUD guiada encerrada.');
  });
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: {
      code: 'OPERATOR_GUIDED_HUD_CLI_ERROR',
      message: error instanceof Error ? error.message : String(error),
    },
  }, null, 2));
  process.exitCode = 1;
});
