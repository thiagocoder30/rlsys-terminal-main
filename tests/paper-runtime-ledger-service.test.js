'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  appendLedgerEntry,
  readLedger,
  parseAmount,
  formatLedgerSummary
} = require('../scripts/paper-runtime-ledger-service');

function tempLedgerPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlsys-ledger-'));
  return path.join(dir, 'paper-ledger.json');
}

test('parseAmount accepts positive numeric values and defaults to one', () => {
  assert.equal(parseAmount(undefined), 1);
  assert.equal(parseAmount('10'), 10);
  assert.equal(parseAmount('2,5'), 2.5);
  assert.equal(parseAmount('-1'), null);
  assert.equal(parseAmount('abc'), null);
});

test('appendLedgerEntry records wins losses balance and drawdown', () => {
  const ledgerPath = tempLedgerPath();

  assert.equal(appendLedgerEntry('WIN', 10, ledgerPath).ok, true);
  assert.equal(appendLedgerEntry('LOSS', 4, ledgerPath).ok, true);
  assert.equal(appendLedgerEntry('LOSS', 9, ledgerPath).ok, true);

  const ledger = readLedger(ledgerPath);

  assert.equal(ledger.summary.wins, 1);
  assert.equal(ledger.summary.losses, 2);
  assert.equal(ledger.summary.balance, -3);
  assert.equal(ledger.summary.peakBalance, 10);
  assert.equal(ledger.summary.maxDrawdown, 13);
  assert.equal(ledger.summary.totalCommands, 3);

  assert.match(formatLedgerSummary(ledger), /RL\.SYS PAPER LEDGER/);
});
