const assert = require('node:assert/strict');
const test = require('node:test');

const {
  PaperBankrollAccountEngine,
} = require('../dist/domain/bankroll/paper-bankroll-account-engine');
const {
  PaperStakePolicyEngine,
} = require('../dist/domain/bankroll/paper-stake-policy-engine');
const {
  PaperRiskGuardAggregator,
} = require('../dist/domain/bankroll/paper-risk-guard-aggregator');
const {
  PaperSessionCoordinator,
} = require('../dist/domain/bankroll/paper-session-coordinator');

function createAccount() {
  const result = new PaperBankrollAccountEngine().createAccount({
    accountId: 'paper-session-coordinator-account',
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
  return result.value;
}

function createRiskGuard(account, stake, overrides = {}) {
  const result = new PaperRiskGuardAggregator().evaluate({
    account,
    stake,
    operatorReady: true,
    cooldownActive: false,
    currentSessionExposure: 0,
    maxSessionExposure: 12,
    currentDailyLoss: 0,
    maxDailyLoss: 5,
    currentDrawdown: 0,
    maxDrawdown: 10,
    ...overrides,
  });

  assert.equal(result.ok, true);
  return result.value;
}

function openCoordinatedTrade() {
  const account = createAccount();
  const stake = createStake(account);
  const riskGuard = createRiskGuard(account, stake);
  const coordinator = new PaperSessionCoordinator();

  const opened = coordinator.openPaperEntry({
    tradeId: 'paper-session-trade-183',
    suggestionId: 'suggestion-183',
    strategyId: 'triplicacao',
    account,
    stake,
    riskGuard,
    openedAtEpochMs: 1717200000001,
    manualConfirmation: true,
  });

  assert.equal(opened.ok, true);

  return {
    account,
    stake,
    riskGuard,
    coordinator,
    entry: opened.value.entry,
  };
}

test('PaperSessionCoordinator opens PAPER entry when risk guard is compatible', () => {
  const account = createAccount();
  const stake = createStake(account);
  const riskGuard = createRiskGuard(account, stake);

  const result = new PaperSessionCoordinator().openPaperEntry({
    tradeId: 'paper-session-open-183',
    suggestionId: 'suggestion-open-183',
    strategyId: 'fusion-reduzida',
    account,
    stake,
    riskGuard,
    openedAtEpochMs: 1717200000001,
    manualConfirmation: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'PAPER_ENTRY_OPENED');
  assert.equal(result.value.reason, 'PAPER_SESSION_ENTRY_COORDINATED');
  assert.equal(result.value.entry.stakeAmount, 5);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
});

test('PaperSessionCoordinator waits or blocks when risk guard is not compatible', () => {
  const account = createAccount();
  const stake = createStake(account);
  const riskGuard = createRiskGuard(account, stake, {
    cooldownActive: true,
  });

  const result = new PaperSessionCoordinator().openPaperEntry({
    tradeId: 'paper-session-wait-183',
    suggestionId: 'suggestion-wait-183',
    strategyId: 'triplicacao',
    account,
    stake,
    riskGuard,
    openedAtEpochMs: 1717200000002,
    manualConfirmation: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'AGUARDAR');
  assert.equal(result.value.reason, 'PAPER_RISK_GUARD_NOT_COMPATIBLE');
  assert.equal(result.value.entry, undefined);
});

test('PaperSessionCoordinator replays entry opening idempotently', () => {
  const account = createAccount();
  const stake = createStake(account);
  const riskGuard = createRiskGuard(account, stake);
  const coordinator = new PaperSessionCoordinator();

  const input = {
    tradeId: 'paper-session-replay-183',
    suggestionId: 'suggestion-replay-183',
    strategyId: 'triplicacao',
    account,
    stake,
    riskGuard,
    openedAtEpochMs: 1717200000003,
    manualConfirmation: true,
  };

  const first = coordinator.openPaperEntry(input);
  assert.equal(first.ok, true);

  const replay = coordinator.openPaperEntry(input, first.value.entry);

  assert.equal(replay.ok, true);
  assert.equal(replay.value.decision, 'PAPER_REPLAYED_IDEMPOTENTLY');
  assert.equal(replay.value.reason, 'PAPER_SESSION_ENTRY_REPLAYED_IDEMPOTENTLY');
  assert.deepEqual(replay.value.entry, first.value.entry);
});

test('PaperSessionCoordinator coordinates full PAPER settlement', () => {
  const { account, stake, coordinator, entry } = openCoordinatedTrade();

  const result = coordinator.settlePaperTrade({
    entry,
    account,
    stake,
    settlementId: 'paper-session-settlement-183',
    outcome: 'WIN',
    settledAtEpochMs: 1717200000004,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'PAPER_TRADE_SETTLED');
  assert.equal(result.value.reason, 'PAPER_SESSION_TRADE_SETTLED');
  assert.equal(result.value.final.outcome, 'WIN');
  assert.equal(result.value.final.pnl, 5);
  assert.equal(result.value.account.currentBalance, 105);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
});

test('PaperSessionCoordinator replays settlement idempotently', () => {
  const { account, stake, coordinator, entry } = openCoordinatedTrade();

  const first = coordinator.settlePaperTrade({
    entry,
    account,
    stake,
    settlementId: 'paper-session-settlement-replay-183',
    outcome: 'LOSS',
    settledAtEpochMs: 1717200000005,
  });

  assert.equal(first.ok, true);

  const replay = coordinator.settlePaperTrade({
    entry,
    account,
    stake,
    settlementId: 'paper-session-settlement-replay-183',
    outcome: 'LOSS',
    settledAtEpochMs: 1717200000005,
    previousSettlementRecord: first.value.settlement,
    previousFinalRecord: first.value.final,
  });

  assert.equal(replay.ok, true);
  assert.equal(replay.value.decision, 'PAPER_REPLAYED_IDEMPOTENTLY');
  assert.equal(replay.value.reason, 'PAPER_SESSION_SETTLEMENT_REPLAYED_IDEMPOTENTLY');
  assert.deepEqual(replay.value.final, first.value.final);
});

test('PaperSessionCoordinator rejects live money flags', () => {
  const account = createAccount();
  const stake = createStake(account);
  const riskGuard = createRiskGuard(account, stake);

  const result = new PaperSessionCoordinator().openPaperEntry({
    tradeId: 'paper-session-live-money-183',
    suggestionId: 'suggestion-live-money-183',
    strategyId: 'triplicacao',
    account,
    stake,
    riskGuard,
    openedAtEpochMs: 1717200000006,
    manualConfirmation: true,
    productionMoneyAllowed: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});
