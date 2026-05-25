'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { handlePaperRuntimeLedgerCommand } = require('../scripts/paper-runtime-ledger-command-preload');

test('handlePaperRuntimeLedgerCommand handles win loss ledger and bankroll commands', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-ledger-command-'));
  const ledgerPath = path.join(dir, 'paper-ledger.json');

  process.env.RLSYS_PAPER_RUNTIME_LEDGER_PATH = ledgerPath;

  assert.equal(handlePaperRuntimeLedgerCommand('win 5'), true);
  assert.equal(handlePaperRuntimeLedgerCommand('loss 2'), true);
  assert.equal(handlePaperRuntimeLedgerCommand('ledger'), true);
  assert.equal(handlePaperRuntimeLedgerCommand('bankroll'), true);
  assert.equal(handlePaperRuntimeLedgerCommand('status'), false);

  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));

  delete process.env.RLSYS_PAPER_RUNTIME_LEDGER_PATH;

  assert.equal(ledger.summary.wins, 1);
  assert.equal(ledger.summary.losses, 1);
  assert.equal(ledger.summary.balance, 3);
});
