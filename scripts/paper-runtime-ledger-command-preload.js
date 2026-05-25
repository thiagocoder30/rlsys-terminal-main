'use strict';

const readline = require('node:readline');
const {
  resolveLedgerPath,
  readLedger,
  parseAmount,
  appendLedgerEntry,
  formatLedgerSummary
} = require('./paper-runtime-ledger-service');

function handlePaperRuntimeLedgerCommand(rawLine) {
  const line = String(rawLine || '').trim();

  if (line.length === 0) {
    return false;
  }

  const [command, amountToken] = line.split(/\s+/);
  const normalized = command.toLowerCase();

  if (normalized === 'win' || normalized === 'loss') {
    const amount = parseAmount(amountToken);

    if (amount === null) {
      console.log('Ledger rejected: invalid amount');
      return true;
    }

    const result = appendLedgerEntry(normalized === 'win' ? 'WIN' : 'LOSS', amount);

    if (!result.ok) {
      console.log(`Ledger rejected: ${result.reason}`);
      return true;
    }

    console.log(`Ledger recorded: ${normalized.toUpperCase()} ${amount}`);
    console.log(formatLedgerSummary(result.ledger));
    return true;
  }

  if (normalized === 'ledger' || normalized === 'bankroll') {
    const ledger = readLedger(resolveLedgerPath());
    console.log(formatLedgerSummary(ledger));
    return true;
  }

  return false;
}

function installPaperRuntimeLedgerCommandPreload() {
  if (globalThis.__rlsysPaperRuntimeLedgerPreloadInstalled === true) {
    return;
  }

  globalThis.__rlsysPaperRuntimeLedgerPreloadInstalled = true;

  const originalCreateInterface = readline.createInterface.bind(readline);

  readline.createInterface = function patchedCreateInterface(...args) {
    const rl = originalCreateInterface(...args);
    const originalOn = rl.on.bind(rl);

    rl.on = function patchedOn(eventName, listener) {
      if (eventName !== 'line') {
        return originalOn(eventName, listener);
      }

      return originalOn('line', function wrappedLineListener(line) {
        if (handlePaperRuntimeLedgerCommand(line)) {
          return undefined;
        }

        return listener.call(this, line);
      });
    };

    return rl;
  };
}

installPaperRuntimeLedgerCommandPreload();

module.exports = {
  handlePaperRuntimeLedgerCommand,
  installPaperRuntimeLedgerCommandPreload
};
