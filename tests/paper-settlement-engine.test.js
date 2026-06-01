const assert = require('node:assert/strict');
const test = require('node:test');

const {
  PaperBankrollAccountEngine,
} = require('../dist/domain/bankroll/paper-bankroll-account-engine');
const {
  PaperSettlementEngine,
} = require('../dist/domain/bankroll/paper-settlement-engine');

function createAccount(initialBalance = 100) {
  const result = new PaperBankrollAccountEngine().createAccount({
    accountId: 'paper-settlement-account',
    initialBalance,
    currency: 'PAPER_BRL',
    createdAtEpochMs: 1717200000000,
  });

  assert.equal(result.ok, true);
  return result.value.account;
}

function createStake(overrides = {}) {
  return {
    decision: 'PAPER_COMPATIVEL',
    reason: 'PAPER_STAKE_APPROVED_BY_INSTITUTIONAL_POLICY',
    approvedStake: 5,
    requestedStake: 5,
    institutionalMaximumStake: 5,
    remainingSessionExposure: 10,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
    explanation: 'Stake PAPER compatível.',
    ...overrides,
  };
}

test('PaperSettlementEngine settles a PAPER win and updates fictitious bankroll', () => {
  const result = new PaperSettlementEngine().settle({
    settlementId: 'settlement-win-180',
    account: createAccount(100),
    stake: createStake({ approvedStake: 5 }),
    outcome: 'WIN',
    settledAtEpochMs: 1717200000001,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'SETTLED');
  assert.equal(result.value.reason, 'PAPER_WIN_SETTLED');
  assert.equal(result.value.record.pnl, 5);
  assert.equal(result.value.account.currentBalance, 105);
  assert.equal(result.value.account.availableBalance, 105);
  assert.equal(result.value.account.realizedPnL, 5);
  assert.equal(result.value.account.productionMoneyAllowed, false);
  assert.equal(result.value.account.liveMoneyAuthorization, false);
});

test('PaperSettlementEngine settles a PAPER loss and blocks live money', () => {
  const result = new PaperSettlementEngine().settle({
    settlementId: 'settlement-loss-180',
    account: createAccount(100),
    stake: createStake({ approvedStake: 7 }),
    outcome: 'LOSS',
    settledAtEpochMs: 1717200000002,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.reason, 'PAPER_LOSS_SETTLED');
  assert.equal(result.value.record.pnl, -7);
  assert.equal(result.value.account.currentBalance, 93);
  assert.equal(result.value.account.availableBalance, 93);
  assert.equal(result.value.account.realizedPnL, -7);
  assert.equal(result.value.record.productionMoneyAllowed, false);
  assert.equal(result.value.record.liveMoneyAuthorization, false);
});

test('PaperSettlementEngine settles a PUSH without changing balance', () => {
  const result = new PaperSettlementEngine().settle({
    settlementId: 'settlement-push-180',
    account: createAccount(100),
    stake: createStake({ approvedStake: 5 }),
    outcome: 'PUSH',
    settledAtEpochMs: 1717200000003,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.reason, 'PAPER_PUSH_SETTLED');
  assert.equal(result.value.record.pnl, 0);
  assert.equal(result.value.account.currentBalance, 100);
});

test('PaperSettlementEngine replays identical settlement idempotently', () => {
  const engine = new PaperSettlementEngine();
  const input = {
    settlementId: 'settlement-replay-180',
    account: createAccount(100),
    stake: createStake({ approvedStake: 4 }),
    outcome: 'WIN',
    settledAtEpochMs: 1717200000004,
  };

  const first = engine.settle(input);
  assert.equal(first.ok, true);

  const replay = engine.settle(input, first.value.record);
  assert.equal(replay.ok, true);
  assert.equal(replay.value.decision, 'REPLAYED_IDEMPOTENTLY');
  assert.equal(replay.value.reason, 'PAPER_SETTLEMENT_REPLAYED_IDEMPOTENTLY');
  assert.deepEqual(replay.value.record, first.value.record);
});

test('PaperSettlementEngine rejects duplicate settlement id conflict', () => {
  const engine = new PaperSettlementEngine();
  const account = createAccount(100);

  const first = engine.settle({
    settlementId: 'settlement-conflict-180',
    account,
    stake: createStake({ approvedStake: 4 }),
    outcome: 'WIN',
    settledAtEpochMs: 1717200000005,
  });
  assert.equal(first.ok, true);

  const conflict = engine.settle(
    {
      settlementId: 'settlement-conflict-180',
      account,
      stake: createStake({ approvedStake: 4 }),
      outcome: 'LOSS',
      settledAtEpochMs: 1717200000005,
    },
    first.value.record,
  );

  assert.equal(conflict.ok, false);
  assert.equal(conflict.error.reason, 'DUPLICATE_SETTLEMENT_ID_CONFLICT');
});

test('PaperSettlementEngine rejects non-compatible stake', () => {
  const result = new PaperSettlementEngine().settle({
    settlementId: 'settlement-wait-180',
    account: createAccount(100),
    stake: createStake({ decision: 'AGUARDAR', approvedStake: 0 }),
    outcome: 'WIN',
    settledAtEpochMs: 1717200000006,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'PAPER_STAKE_NOT_COMPATIBLE');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('PaperSettlementEngine rejects live money flags', () => {
  const result = new PaperSettlementEngine().settle({
    settlementId: 'settlement-live-money-180',
    account: createAccount(100),
    stake: createStake({ approvedStake: 5 }),
    outcome: 'WIN',
    settledAtEpochMs: 1717200000007,
    productionMoneyAllowed: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
});
