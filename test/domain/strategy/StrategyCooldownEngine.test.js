'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { StrategyResultLedgerEngine } = require('../../../src/domain/strategy/StrategyResultLedgerEngine');
const { StrategyCooldownEngine } = require('../../../src/domain/strategy/StrategyCooldownEngine');

function createLedgerWithOutcomes(outcomes) {
  const ledgerEngine = new StrategyResultLedgerEngine();
  const created = ledgerEngine.createEmptyLedger('fusion-reduzida', 'paper-session-strategy');

  assert.equal(created.ok, true);

  let ledger = created.value;

  for (let index = 0; index < outcomes.length; index += 1) {
    const result = ledgerEngine.appendResult({
      ledger,
      outcome: outcomes[index],
      roundIndex: index + 1
    });

    assert.equal(result.status, 'STRATEGY_RESULT_RECORDED');
    ledger = result.ledger;
  }

  return ledger;
}

test('keeps strategy available when there is no loss pressure', () => {
  const ledger = createLedgerWithOutcomes(['WIN']);
  const cooldown = new StrategyCooldownEngine().evaluate({
    ledger,
    currentRoundIndex: 2
  });

  assert.equal(cooldown.status, 'STRATEGY_AVAILABLE');
  assert.equal(cooldown.strategyAvailable, true);
  assert.equal(cooldown.action, 'ALLOW_STRATEGY_EVALUATION');
  assert.equal(cooldown.strategyGate, 'AVAILABLE');
  assert.equal(cooldown.paperGate, 'PAPER_AUTHORIZED');
  assert.equal(cooldown.liveGate, 'BLOCKED');
  assert.equal(cooldown.productionMoneyAllowed, false);
  assert.equal(cooldown.liveMoneyAuthorized, false);
});

test('puts strategy in cooldown after one loss', () => {
  const ledger = createLedgerWithOutcomes(['LOSS']);
  const cooldown = new StrategyCooldownEngine({
    baseCooldownRounds: 3,
    maxCooldownRounds: 20
  }).evaluate({
    ledger,
    currentRoundIndex: 1
  });

  assert.equal(cooldown.status, 'STRATEGY_COOLDOWN');
  assert.equal(cooldown.strategyAvailable, false);
  assert.equal(cooldown.action, 'WAIT');
  assert.equal(cooldown.cooldownRounds, 3);
  assert.equal(cooldown.remainingRounds, 3);
  assert.ok(cooldown.reasons.includes('strategy_loss_cooldown_active'));
});

test('decreases remaining cooldown as rounds advance', () => {
  const ledger = createLedgerWithOutcomes(['LOSS']);
  const cooldown = new StrategyCooldownEngine({
    baseCooldownRounds: 3
  }).evaluate({
    ledger,
    currentRoundIndex: 3
  });

  assert.equal(cooldown.status, 'STRATEGY_COOLDOWN');
  assert.equal(cooldown.remainingRounds, 1);
});

test('moves to review when cooldown has elapsed after loss', () => {
  const ledger = createLedgerWithOutcomes(['LOSS']);
  const cooldown = new StrategyCooldownEngine({
    baseCooldownRounds: 3
  }).evaluate({
    ledger,
    currentRoundIndex: 4
  });

  assert.equal(cooldown.status, 'STRATEGY_REVIEW_REQUIRED');
  assert.equal(cooldown.strategyAvailable, false);
  assert.equal(cooldown.action, 'WAIT_FOR_RECOVERY');
  assert.ok(cooldown.reasons.includes('strategy_cooldown_elapsed'));
});

test('hard blocks strategy after configured loss streak', () => {
  const ledger = createLedgerWithOutcomes(['LOSS', 'LOSS', 'LOSS']);
  const cooldown = new StrategyCooldownEngine({
    hardBlockLossStreak: 3
  }).evaluate({
    ledger,
    currentRoundIndex: 3
  });

  assert.equal(cooldown.status, 'STRATEGY_BLOCKED');
  assert.equal(cooldown.strategyAvailable, false);
  assert.equal(cooldown.action, 'DO_NOT_USE');
  assert.equal(cooldown.strategyGate, 'BLOCKED');
  assert.ok(cooldown.reasons.includes('strategy_loss_streak_hard_block'));
});

test('hard blocks strategy after drawdown limit', () => {
  const ledger = createLedgerWithOutcomes(['LOSS', 'WIN', 'LOSS', 'LOSS', 'LOSS']);
  const cooldown = new StrategyCooldownEngine({
    hardBlockLossStreak: 99,
    hardBlockNetUnits: -2
  }).evaluate({
    ledger,
    currentRoundIndex: 5
  });

  assert.equal(cooldown.status, 'STRATEGY_BLOCKED');
  assert.ok(cooldown.reasons.includes('strategy_drawdown_hard_block'));
});

test('blocks invalid ledger defensively', () => {
  const ledger = createLedgerWithOutcomes(['WIN']);
  const cooldown = new StrategyCooldownEngine().evaluate({
    ledger: {
      ...ledger,
      liveGate: 'OPEN',
      productionMoneyAllowed: true,
      liveMoneyAuthorized: true
    },
    currentRoundIndex: 2
  });

  assert.equal(cooldown.status, 'STRATEGY_BLOCKED');
  assert.equal(cooldown.paperGate, 'BLOCKED');
  assert.equal(cooldown.liveGate, 'BLOCKED');
  assert.equal(cooldown.productionMoneyAllowed, false);
  assert.equal(cooldown.liveMoneyAuthorized, false);
  assert.ok(cooldown.reasons.includes('live_gate_must_remain_blocked'));
  assert.ok(cooldown.reasons.includes('production_money_must_remain_disabled'));
  assert.ok(cooldown.reasons.includes('live_money_must_remain_disabled'));
});

test('is deterministic and idempotent', () => {
  const ledger = createLedgerWithOutcomes(['LOSS']);
  const engine = new StrategyCooldownEngine();
  const input = {
    ledger,
    currentRoundIndex: 1
  };

  const first = engine.evaluate(input);
  const second = engine.evaluate(input);

  assert.deepEqual(first, second);
});

test('validates configuration defensively', () => {
  assert.throws(
    () => new StrategyCooldownEngine({ baseCooldownRounds: 0 }),
    /baseCooldownRounds/
  );

  assert.throws(
    () => new StrategyCooldownEngine({
      baseCooldownRounds: 5,
      maxCooldownRounds: 3
    }),
    /maxCooldownRounds/
  );

  assert.throws(
    () => new StrategyCooldownEngine({ hardBlockLossStreak: 0 }),
    /hardBlockLossStreak/
  );
});
