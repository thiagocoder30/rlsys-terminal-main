const test = require('node:test');
const assert = require('node:assert/strict');
const { PaperLedgerRuntimeService } = require('../dist/application/ledger');

test('PaperLedgerRuntimeService starts with bounded initial state', () => {
  const service = new PaperLedgerRuntimeService(200);
  const state = service.snapshot();

  assert.equal(state.initialBalance, 200);
  assert.equal(state.currentBalance, 200);
  assert.equal(state.sessionPnl, 0);
  assert.equal(state.highWaterMark, 200);
  assert.equal(state.drawdown, 0);
});

test('PaperLedgerRuntimeService applies win and updates high water mark', () => {
  const service = new PaperLedgerRuntimeService(200);

  const result = service.apply({ type: 'WIN', amount: 12 });

  assert.equal(result.accepted, true);
  assert.equal(result.state.currentBalance, 212);
  assert.equal(result.state.sessionPnl, 12);
  assert.equal(result.state.highWaterMark, 212);
  assert.equal(result.state.drawdown, 0);
  assert.equal(result.state.wins, 1);
});

test('PaperLedgerRuntimeService applies loss and updates drawdown', () => {
  const service = new PaperLedgerRuntimeService(200);

  service.apply({ type: 'WIN', amount: 12 });
  const result = service.apply({ type: 'LOSS', amount: 5 });

  assert.equal(result.state.currentBalance, 207);
  assert.equal(result.state.sessionPnl, 7);
  assert.equal(result.state.highWaterMark, 212);
  assert.equal(result.state.drawdown, 5);
  assert.equal(result.state.losses, 1);
});

test('PaperLedgerRuntimeService tracks negative pnl after loss', () => {
  const service = new PaperLedgerRuntimeService(200);

  const result = service.apply({ type: 'LOSS', amount: 10 });

  assert.equal(result.state.currentBalance, 190);
  assert.equal(result.state.sessionPnl, -10);
  assert.equal(result.state.highWaterMark, 200);
  assert.equal(result.state.drawdown, 10);
});

test('PaperLedgerRuntimeService rejects invalid initial balance', () => {
  assert.throws(() => new PaperLedgerRuntimeService(0), /initialBalance/);
});

test('PaperLedgerRuntimeService rejects invalid event amount', () => {
  const service = new PaperLedgerRuntimeService(200);

  assert.throws(() => service.apply({ type: 'WIN', amount: 0 }), /amount/);
});

test('PaperLedgerRuntimeService blocks loss above current balance', () => {
  const service = new PaperLedgerRuntimeService(200);

  assert.throws(() => service.apply({ type: 'LOSS', amount: 201 }), /current balance/);
});
