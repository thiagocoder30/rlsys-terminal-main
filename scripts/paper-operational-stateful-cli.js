#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { PaperOperationalStatefulCliEngine } = require('../dist/infrastructure/paper-operational/paper-operational-stateful-cli-engine');
const { PaperOperationalStateStore } = require('../dist/infrastructure/paper-operational/paper-operational-state-store');

function parseArgs(argv) {
  const command = argv[2] || 'status';
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

const statePath = process.env.RLSYS_PAPER_OPERATIONAL_STATE_PATH
  || path.join(process.cwd(), 'data', 'paper-operational', 'session.json');

const store = new PaperOperationalStateStore({
  filePath: statePath,
  maxBytes: 250000,
});

const engine = new PaperOperationalStatefulCliEngine(store);
const result = engine.execute(parseArgs(process.argv));

if (!result.ok) {
  console.error(JSON.stringify({ ok: false, error: result.error }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result.value, null, 2));
}
