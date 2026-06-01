const assert = require('node:assert/strict');
const test = require('node:test');

const {
  PaperBankrollAccountEngine,
} = require('../dist/domain/bankroll/paper-bankroll-account-engine');
const {
  PaperStakePolicyEngine,
} = require('../dist/domain/bankroll/paper-stake-policy-engine');
const {
  PaperSettlementEngine,
} = require('../dist/domain/bankroll/paper-settlement-engine');
const {
  PaperTradeLifecycleEngine,
} = require('../dist/domain/bankroll/paper-trade-lifecycle-engine');

function createAccount() {
  const result = new PaperBankrollAccountEngine().createAccount({
    accountId: 'paper-lifecycle-account',
    initialBalance: 100,
    currency: 'PAPER_BRL',
    createdAtEpochMs: 1717200000000,
  });

  assert.equal(result.ok, true);
  return result.value.account;
}

function createStake(account) {
  const result = new PaperStakePolicyEngine().evaluate({
    account,
    policy: {
      minStake: 1,
      defaultStake: 3,
      maxStake: 5,
      maxStakePercentOfAvailableBalance: 0.05,
      maxSessionExposure: 12,
    },
    requestedStake: 5,
    currentSessionExposure: 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'PAPER_COMPATIVEL');
  return result.value;
}

function openTrade() {
  const account = createAccount();
  const stake = createStake(account);
  const lifecycle = new PaperTradeLifecycleEngine();

  const opened = lifecycle.openTrade({
    tradeId: 'paper-trade-181',
    suggestionId: 'suggestion-181',
    strategyId: 'triplicacao',
    account,
    stake,
    openedAtEpochMs: 1717200000001,
    manualConfirmation: true,
  });

  assert.equal(opened.ok, true);

  return {
    account,
    stake,
    entry: opened.value.entry,
    lifecycle,
  };
}

test('PaperTradeLifecycleEngine opens a PAPER entry only after manual confirmation', () => {
  const account = createAccount();
  const stake = createStake(account);

  const result = new PaperTradeLifecycleEngine().openTrade({
    tradeId: 'paper-trade-open-181',
    suggestionId: 'suggestion-open-181',
    strategyId: 'fusion-reduzida',
    account,
    stake,
    openedAtEpochMs: 1717200000001,
    manualConfirmation: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.state, 'PAPER_ENTRY_OPENED');
  assert.equal(result.value.reason, 'PAPER_ENTRY_OPENED_WITH_MANUAL_CONFIRMATION');
  assert.equal(result.value.entry.stakeAmount, 5);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
});

test('PaperTradeLifecycleEngine rejects automatic PAPER entry without manual confirmation', () => {
  const account = createAccount();
  const stake = createStake(account);

  const result = new PaperTradeLifecycleEngine().openTrade({
    tradeId: 'paper-trade-auto-181',
    suggestionId: 'suggestion-auto-181',
    strategyId: 'triplicacao',
    account,
    stake,
    openedAtEpochMs: 1717200000002,
    manualConfirmation: false,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'MANUAL_CONFIRMATION_REQUIRED');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('PaperTradeLifecycleEngine replays trade opening idempotently', () => {
  const account = createAccount();
  const stake = createStake(account);
  const lifecycle = new PaperTradeLifecycleEngine();

  const input = {
    tradeId: 'paper-trade-replay-181',
    suggestionId: 'suggestion-replay-181',
    strategyId: 'triplicacao',
    account,
    stake,
    openedAtEpochMs: 1717200000003,
    manualConfirmation: true,
  };

  const first = lifecycle.openTrade(input);
  assert.equal(first.ok, true);

  const replay = lifecycle.openTrade(input, first.value.entry);
  assert.equal(replay.ok, true);
  assert.equal(replay.value.reason, 'PAPER_ENTRY_REPLAYED_IDEMPOTENTLY');
  assert.deepEqual(replay.value.entry, first.value.entry);
});

test('PaperTradeLifecycleEngine settles a complete PAPER trade lifecycle', () => {
  const { account, stake, entry, lifecycle } = openTrade();

  const settlement = new PaperSettlementEngine().settle({
    settlementId: 'settlement-lifecycle-181',
    account,
    stake,
    outcome: 'WIN',
    settledAtEpochMs: 1717200000004,
  });

  assert.equal(settlement.ok, true);

  const result = lifecycle.settleTrade({
    entry,
    settlement: settlement.value,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.state, 'SETTLED');
  assert.equal(result.value.reason, 'PAPER_TRADE_SETTLED');
  assert.equal(result.value.final.outcome, 'WIN');
  assert.equal(result.value.final.pnl, 5);
  assert.equal(result.value.final.balanceAfter, 105);
  assert.equal(result.value.final.productionMoneyAllowed, false);
  assert.equal(result.value.final.liveMoneyAuthorization, false);
});

test('PaperTradeLifecycleEngine replays settlement idempotently', () => {
  const { account, stake, entry, lifecycle } = openTrade();

  const settlement = new PaperSettlementEngine().settle({
    settlementId: 'settlement-replay-lifecycle-181',
    account,
    stake,
    outcome: 'LOSS',
    settledAtEpochMs: 1717200000005,
  });

  assert.equal(settlement.ok, true);

  const first = lifecycle.settleTrade({
    entry,
    settlement: settlement.value,
  });

  assert.equal(first.ok, true);

  const replay = lifecycle.settleTrade(
    {
      entry,
      settlement: settlement.value,
    },
    first.value.final,
  );

  assert.equal(replay.ok, true);
  assert.equal(replay.value.reason, 'PAPER_TRADE_SETTLEMENT_REPLAYED_IDEMPOTENTLY');
  assert.deepEqual(replay.value.final, first.value.final);
});

test('PaperTradeLifecycleEngine rejects settlement account mismatch', () => {
  const { stake, entry, lifecycle } = openTrade();
  const otherAccount = new PaperBankrollAccountEngine().createAccount({
    accountId: 'other-paper-account',
    initialBalance: 100,
    currency: 'PAPER_BRL',
    createdAtEpochMs: 1717200000100,
  });

  assert.equal(otherAccount.ok, true);

  const settlement = new PaperSettlementEngine().settle({
    settlementId: 'settlement-mismatch-181',
    account: otherAccount.value.account,
    stake,
    outcome: 'WIN',
    settledAtEpochMs: 1717200000006,
  });

  assert.equal(settlement.ok, true);

  const result = lifecycle.settleTrade({
    entry,
    settlement: settlement.value,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'SETTLEMENT_ACCOUNT_MISMATCH');
});
