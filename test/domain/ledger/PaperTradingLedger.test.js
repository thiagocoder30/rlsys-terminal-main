const assert = require('node:assert/strict');
const test = require('node:test');
const { join } = require('path');
const { tmpdir } = require('os');
const { rmSync } = require('fs');

const { PaperTradingLedger } = require('../../../dist/domain/ledger/PaperTradingLedger.js');

test('PaperTradingLedger calcula drawdown consecutivo corretamente', () => {
  const file = join(tmpdir(), `ledger-test-${Date.now()}.jsonl`);
  const ledger = new PaperTradingLedger(file);

  ledger.registerTrade({ timestamp: new Date().toISOString(), recommendation: 'PAPER_SINAL_FORTE', outcome: 'WIN', virtualStake: 10, virtualPnL: 10 });
  assert.equal(ledger.calculateCurrentDrawdown(), 0);

  ledger.registerTrade({ timestamp: new Date().toISOString(), recommendation: 'PAPER_SINAL_FRACO', outcome: 'LOSS', virtualStake: 10, virtualPnL: -10 });
  ledger.registerTrade({ timestamp: new Date().toISOString(), recommendation: 'PAPER_SINAL_FORTE', outcome: 'LOSS', virtualStake: 10, virtualPnL: -10 });
  assert.equal(ledger.calculateCurrentDrawdown(), 2);

  rmSync(file, { force: true });
});
