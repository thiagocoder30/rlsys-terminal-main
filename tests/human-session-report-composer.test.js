const test = require('node:test');
const assert = require('node:assert/strict');
const { HumanSessionReportComposer } = require('../dist/application/reporting');
const { PaperLedgerRuntimeService } = require('../dist/application/ledger');
const { OperatorRiskProfileCalculator } = require('../dist/domain/risk');

function profile() {
  return new OperatorRiskProfileCalculator().calculate({
    bankroll: 200,
    riskMode: 'CONSERVATIVE',
    allowMartingale: true,
  });
}

test('HumanSessionReportComposer reports healthy session', () => {
  const ledger = new PaperLedgerRuntimeService(200);
  ledger.apply({ type: 'WIN', amount: 4 });

  const report = new HumanSessionReportComposer().compose({
    profile: profile(),
    ledger: ledger.snapshot(),
    blockedEntries: 0,
    reviewEntries: 0,
    cooldownBlocks: 0,
  });

  assert.equal(report.verdict, 'SESSION_HEALTHY');
  assert.match(report.markdown, /Relatório Humano/);
  assert.match(report.markdown, /Saldo final/);
});

test('HumanSessionReportComposer protects profit at stop win', () => {
  const ledger = new PaperLedgerRuntimeService(200);
  ledger.apply({ type: 'WIN', amount: 16 });

  const report = new HumanSessionReportComposer().compose({
    profile: profile(),
    ledger: ledger.snapshot(),
    blockedEntries: 0,
    reviewEntries: 0,
    cooldownBlocks: 0,
  });

  assert.equal(report.verdict, 'SESSION_PROFIT_PROTECTED');
  assert.match(report.recommendedAction, /Encerrar/);
});

test('HumanSessionReportComposer reports stop loss', () => {
  const ledger = new PaperLedgerRuntimeService(200);
  ledger.apply({ type: 'LOSS', amount: 10 });

  const report = new HumanSessionReportComposer().compose({
    profile: profile(),
    ledger: ledger.snapshot(),
    blockedEntries: 0,
    reviewEntries: 0,
    cooldownBlocks: 0,
  });

  assert.equal(report.verdict, 'SESSION_STOP_LOSS');
  assert.match(report.summary, /limite de perda/);
});

test('HumanSessionReportComposer reports risk review for blocks', () => {
  const ledger = new PaperLedgerRuntimeService(200);

  const report = new HumanSessionReportComposer().compose({
    profile: profile(),
    ledger: ledger.snapshot(),
    blockedEntries: 1,
    reviewEntries: 0,
    cooldownBlocks: 0,
  });

  assert.equal(report.verdict, 'SESSION_RISK_REVIEW');
  assert.match(report.recommendedAction, /Pausar/);
});

test('HumanSessionReportComposer rejects invalid counters', () => {
  const ledger = new PaperLedgerRuntimeService(200);

  assert.throws(() => new HumanSessionReportComposer().compose({
    profile: profile(),
    ledger: ledger.snapshot(),
    blockedEntries: -1,
    reviewEntries: 0,
    cooldownBlocks: 0,
  }), /blockedEntries/);
});
