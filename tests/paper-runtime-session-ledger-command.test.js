'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

test('paper runtime session wires win loss ledger and bankroll commands', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-session-ledger-'));
  const ledgerPath = path.join(dir, 'paper-ledger.json');

  const result = spawnSync(process.execPath, ['scripts/paper-runtime-session.js'], {
    cwd: path.join(__dirname, '..'),
    input: 'win 10\nloss 3\nledger\nbankroll\nexit\n',
    encoding: 'utf8',
    env: {
      ...process.env,
      RLSYS_PAPER_RUNTIME_LEDGER_PATH: ledgerPath
    }
  });

  const output = `${result.stdout || ''}${result.stderr || ''}`;

  assert.equal(result.status, 0, output);
  assert.match(output, /Ledger recorded: WIN 10/);
  assert.match(output, /Ledger recorded: LOSS 3/);
  assert.match(output, /RL\.SYS PAPER LEDGER/);
  assert.match(output, /balance: 7/);

  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));

  assert.equal(ledger.summary.wins, 1);
  assert.equal(ledger.summary.losses, 1);
  assert.equal(ledger.summary.balance, 7);
});
