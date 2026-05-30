'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { StrategyResultLedgerEngine } = require('../../../src/domain/strategy/StrategyResultLedgerEngine');

test('creates empty strategy result ledger with live money blocked', () => {
  const engine = new StrategyResultLedgerEngine();
  const result = engine.createEmptyLedger('fusion-reduzida', 'paper-session-1');

  assert.equal(result.ok, true);
  assert.equal(result.value.strategyId, 'fusion-reduzida');
  assert.equal(result.value.sessionId, 'paper-session-1');
  assert.equal(result.value.totalEntries, 0);
  assert.equal(result.value.strategyGate, 'NEUTRAL');
  assert.equal(result.value.paperGate, 'PAPER_AUTHORIZED');
  assert.equal(result.value.liveGate, 'BLOCKED');
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorized, false);
});

test('records WIN and LOSS outcomes deterministically', () => {
  const engine = new StrategyResultLedgerEngine();
  const created = engine.createEmptyLedger('fusion-reduzida', 'paper-session-1');

  assert.equal(created.ok, true);

  const win = engine.appendResult({
    ledger: created.value,
    outcome: 'WIN',
    roundIndex: 10
  });

  assert.equal(win.status, 'STRATEGY_RESULT_RECORDED');
  assert.equal(win.recorded, true);
  assert.equal(win.ledger.wins, 1);
  assert.equal(win.ledger.netUnits, 1);
  assert.equal(win.ledger.currentWinStreak, 1);

  const loss = engine.appendResult({
    ledger: win.ledger,
    outcome: 'LOSS',
    roundIndex: 11
  });

  assert.equal(loss.status, 'STRATEGY_RESULT_RECORDED');
  assert.equal(loss.ledger.losses, 1);
  assert.equal(loss.ledger.netUnits, 0);
  assert.equal(loss.ledger.currentLossStreak, 1);
  assert.equal(loss.ledger.strategyGate, 'REVIEW_REQUIRED');
});

test('tracks consecutive loss streak for future strategy cooldown', () => {
  const engine = new StrategyResultLedgerEngine();
  const created = engine.createEmptyLedger('fusion-reduzida', 'paper-session-1');

  let ledger = created.value;

  ledger = engine.appendResult({ ledger, outcome: 'LOSS', roundIndex: 1 }).ledger;
  ledger = engine.appendResult({ ledger, outcome: 'LOSS', roundIndex: 2 }).ledger;
  ledger = engine.appendResult({ ledger, outcome: 'LOSS', roundIndex: 3 }).ledger;

  assert.equal(ledger.losses, 3);
  assert.equal(ledger.currentLossStreak, 3);
  assert.equal(ledger.maxLossStreak, 3);
  assert.equal(ledger.strategyGate, 'REVIEW_REQUIRED');
});

test('summarizes strategy ledger metrics', () => {
  const engine = new StrategyResultLedgerEngine({ maxRecentWindow: 5 });
  const created = engine.createEmptyLedger('fusion-reduzida', 'paper-session-1');

  let ledger = created.value;

  ledger = engine.appendResult({ ledger, outcome: 'WIN', roundIndex: 1 }).ledger;
  ledger = engine.appendResult({ ledger, outcome: 'LOSS', roundIndex: 2 }).ledger;
  ledger = engine.appendResult({ ledger, outcome: 'PUSH', roundIndex: 3 }).ledger;
  ledger = engine.appendResult({ ledger, outcome: 'SKIPPED', roundIndex: 4 }).ledger;

  const summary = engine.summarize(ledger);

  assert.equal(summary.ok, true);
  assert.equal(summary.value.totalEntries, 4);
  assert.equal(summary.value.wins, 1);
  assert.equal(summary.value.losses, 1);
  assert.equal(summary.value.pushes, 1);
  assert.equal(summary.value.skipped, 1);
  assert.equal(summary.value.winRate, 0.5);
  assert.equal(summary.value.lossRate, 0.5);
  assert.equal(summary.value.liveGate, 'BLOCKED');
});

test('rejects duplicate or non-increasing round index', () => {
  const engine = new StrategyResultLedgerEngine();
  const created = engine.createEmptyLedger('fusion-reduzida', 'paper-session-1');

  const first = engine.appendResult({
    ledger: created.value,
    outcome: 'WIN',
    roundIndex: 10
  });

  const duplicate = engine.appendResult({
    ledger: first.ledger,
    outcome: 'LOSS',
    roundIndex: 10
  });

  assert.equal(duplicate.status, 'STRATEGY_RESULT_REJECTED');
  assert.ok(duplicate.reasons.includes('round_index_must_increase'));
  assert.equal(duplicate.paperGate, 'BLOCKED');
});

test('rejects live money result attempts', () => {
  const engine = new StrategyResultLedgerEngine();
  const created = engine.createEmptyLedger('fusion-reduzida', 'paper-session-1');

  const result = engine.appendResult({
    ledger: created.value,
    outcome: 'WIN',
    roundIndex: 1,
    productionMoneyAllowed: true,
    liveMoneyAuthorized: true
  });

  assert.equal(result.status, 'STRATEGY_RESULT_REJECTED');
  assert.ok(result.reasons.includes('live_money_result_rejected'));
  assert.equal(result.liveGate, 'BLOCKED');
  assert.equal(result.productionMoneyAllowed, false);
  assert.equal(result.liveMoneyAuthorized, false);
});

test('rejects ledger invariant violation', () => {
  const engine = new StrategyResultLedgerEngine();
  const created = engine.createEmptyLedger('fusion-reduzida', 'paper-session-1');

  const result = engine.appendResult({
    ledger: {
      ...created.value,
      liveGate: 'OPEN',
      productionMoneyAllowed: true,
      liveMoneyAuthorized: true
    },
    outcome: 'WIN',
    roundIndex: 1
  });

  assert.equal(result.status, 'STRATEGY_RESULT_REJECTED');
  assert.ok(result.reasons.includes('live_gate_must_remain_blocked'));
  assert.ok(result.reasons.includes('production_money_must_remain_disabled'));
  assert.ok(result.reasons.includes('live_money_must_remain_disabled'));
});

test('rejects max entry overflow', () => {
  const engine = new StrategyResultLedgerEngine({ maxEntries: 1 });
  const created = engine.createEmptyLedger('fusion-reduzida', 'paper-session-1');

  const first = engine.appendResult({
    ledger: created.value,
    outcome: 'WIN',
    roundIndex: 1
  });

  const second = engine.appendResult({
    ledger: first.ledger,
    outcome: 'WIN',
    roundIndex: 2
  });

  assert.equal(second.status, 'STRATEGY_RESULT_REJECTED');
  assert.ok(second.reasons.includes('strategy_ledger_max_entries_exceeded'));
});

test('is deterministic and idempotent for same input', () => {
  const engine = new StrategyResultLedgerEngine();
  const created = engine.createEmptyLedger('fusion-reduzida', 'paper-session-1');

  const input = {
    ledger: created.value,
    outcome: 'LOSS',
    roundIndex: 1,
    createdAtMs: 123
  };

  const first = engine.appendResult(input);
  const second = engine.appendResult(input);

  assert.deepEqual(first, second);
});

test('validates configuration defensively', () => {
  assert.throws(
    () => new StrategyResultLedgerEngine({ maxEntries: 0 }),
    /maxEntries/
  );

  assert.throws(
    () => new StrategyResultLedgerEngine({ maxRecentWindow: 0 }),
    /maxRecentWindow/
  );
});
