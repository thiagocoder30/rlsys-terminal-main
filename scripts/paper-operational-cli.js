#!/usr/bin/env node
'use strict';

const { PaperOperationalCliModeEngine } = require('../dist/domain/bankroll/paper-operational-cli-mode-engine');

function parseArgs(argv) {
  const command = argv[2] || 'help';
  const input = { command };

  for (let index = 3; index < argv.length; index += 1) {
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

    if (key === 'balance' || key === 'stake' || key === 'timestamp') {
      input[key] = Number(value);
    } else if (key === 'productionMoneyAllowed' || key === 'liveMoneyAuthorization') {
      input[key] = value === 'true';
    } else {
      input[key] = value;
    }

    index += 1;
  }

  return input;
}

const engine = new PaperOperationalCliModeEngine();
const result = engine.execute(parseArgs(process.argv));

if (!result.ok) {
  console.error(JSON.stringify({
    ok: false,
    error: result.error,
  }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result.value, null, 2));
}
