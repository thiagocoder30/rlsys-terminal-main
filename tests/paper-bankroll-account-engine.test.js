const assert = require('node:assert/strict');
const test = require('node:test');

const {
  PaperBankrollAccountEngine,
} = require('../dist/domain/bankroll/paper-bankroll-account-engine');

test('PaperBankrollAccountEngine creates a fictitious bankroll account with live money blocked', () => {
  const engine = new PaperBankrollAccountEngine();

  const result = engine.createAccount({
    accountId: 'paper-session-178',
    initialBalance: 100,
    currency: 'PAPER_BRL',
    createdAtEpochMs: 1717200000000,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.reason, 'PAPER_BANKROLL_ACCOUNT_CREATED');
  assert.equal(result.value.account.initialBalance, 100);
  assert.equal(result.value.account.currentBalance, 100);
  assert.equal(result.value.account.availableBalance, 100);
  assert.equal(result.value.account.reservedBalance, 0);
  assert.equal(result.value.account.realizedPnL, 0);
  assert.equal(result.value.account.status, 'ACTIVE');
  assert.equal(result.value.account.productionMoneyAllowed, false);
  assert.equal(result.value.account.liveMoneyAuthorization, false);
});

test('PaperBankrollAccountEngine replays identical creation idempotently', () => {
  const engine = new PaperBankrollAccountEngine();
  const input = {
    accountId: 'paper-session-178-idempotent',
    initialBalance: 70.555,
    currency: 'PAPER_BRL',
    createdAtEpochMs: 1717200000001,
    productionMoneyAllowed: false,
    liveMoneyAuthorization: false,
  };

  const first = engine.createAccount(input);
  assert.equal(first.ok, true);

  const replay = engine.createAccount(input, first.value.account);

  assert.equal(replay.ok, true);
  assert.equal(replay.value.reason, 'PAPER_BANKROLL_ACCOUNT_REPLAYED_IDEMPOTENTLY');
  assert.deepEqual(replay.value.account, first.value.account);
});

test('PaperBankrollAccountEngine rejects non-idempotent account replay', () => {
  const engine = new PaperBankrollAccountEngine();
  const first = engine.createAccount({
    accountId: 'paper-session-178-replay',
    initialBalance: 100,
    currency: 'PAPER_BRL',
    createdAtEpochMs: 1717200000002,
  });

  assert.equal(first.ok, true);

  const replay = engine.createAccount(
    {
      accountId: 'paper-session-178-replay',
      initialBalance: 200,
      currency: 'PAPER_BRL',
      createdAtEpochMs: 1717200000002,
    },
    first.value.account,
  );

  assert.equal(replay.ok, false);
  assert.equal(replay.error.reason, 'NON_IDEMPOTENT_ACCOUNT_REPLAY_REJECTED');
  assert.equal(replay.error.productionMoneyAllowed, false);
  assert.equal(replay.error.liveMoneyAuthorization, false);
});

test('PaperBankrollAccountEngine rejects live money flags', () => {
  const engine = new PaperBankrollAccountEngine();

  const result = engine.createAccount({
    accountId: 'paper-session-178-live-money',
    initialBalance: 100,
    currency: 'PAPER_BRL',
    createdAtEpochMs: 1717200000003,
    productionMoneyAllowed: true,
    liveMoneyAuthorization: false,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('PaperBankrollAccountEngine rejects invalid initial balance', () => {
  const engine = new PaperBankrollAccountEngine();

  const result = engine.createAccount({
    accountId: 'paper-session-178-invalid',
    initialBalance: 0,
    currency: 'PAPER_BRL',
    createdAtEpochMs: 1717200000004,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_PAPER_BANKROLL_INPUT');
});
