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

function createAccount(overrides = {}) {
  const result = new PaperBankrollAccountEngine().createAccount({
    accountId: overrides.accountId ?? 'paper-risk-account',
    initialBalance: overrides.initialBalance ?? 100,
    currency: 'PAPER_BRL',
    createdAtEpochMs: 1717200000000,
  });

  assert.equal(result.ok, true);

  return {
    ...result.value.account,
    ...(overrides.accountPatch ?? {}),
  };
}

function createStake(account, overrides = {}) {
  const result = new PaperStakePolicyEngine().evaluate({
    account,
    policy: {
      minStake: 1,
      defaultStake: 3,
      maxStake: 5,
      maxStakePercentOfAvailableBalance: 0.05,
      maxSessionExposure: 12,
    },
    requestedStake: overrides.requestedStake ?? 5,
    currentSessionExposure: 0,
  });

  assert.equal(result.ok, true);

  return {
    ...result.value,
    ...(overrides.stakePatch ?? {}),
  };
}

function baseInput(overrides = {}) {
  const account = overrides.account ?? createAccount();
  const stake = overrides.stake ?? createStake(account);

  return {
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
  };
}

test('PaperRiskGuardAggregator approves compatible paper context', () => {
  const result = new PaperRiskGuardAggregator().evaluate(baseInput());

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'PAPER_COMPATIVEL');
  assert.equal(result.value.reason, 'PAPER_RISK_GUARDS_APPROVED');
  assert.equal(result.value.approvedStake, 5);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
});

test('PaperRiskGuardAggregator blocks when operator is not ready', () => {
  const result = new PaperRiskGuardAggregator().evaluate(baseInput({
    operatorReady: false,
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'NAO_UTILIZAR');
  assert.equal(result.value.reason, 'OPERATOR_NOT_READY');
  assert.deepEqual(result.value.blockingFactors, ['OPERATOR_NOT_READY']);
});

test('PaperRiskGuardAggregator waits when cooldown is active', () => {
  const result = new PaperRiskGuardAggregator().evaluate(baseInput({
    cooldownActive: true,
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'AGUARDAR');
  assert.equal(result.value.reason, 'COOLDOWN_ACTIVE');
  assert.equal(result.value.approvedStake, 0);
});

test('PaperRiskGuardAggregator blocks incompatible stake', () => {
  const account = createAccount();
  const stake = createStake(account, {
    stakePatch: {
      decision: 'AGUARDAR',
      approvedStake: 0,
    },
  });

  const result = new PaperRiskGuardAggregator().evaluate(baseInput({
    account,
    stake,
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'NAO_UTILIZAR');
  assert.equal(result.value.reason, 'PAPER_STAKE_NOT_COMPATIBLE');
});

test('PaperRiskGuardAggregator blocks reached exposure and loss limits', () => {
  const result = new PaperRiskGuardAggregator().evaluate(baseInput({
    currentSessionExposure: 12,
    currentDailyLoss: 5,
  }));

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'NAO_UTILIZAR');
  assert.equal(result.value.blockingFactors.includes('SESSION_EXPOSURE_LIMIT_REACHED'), true);
  assert.equal(result.value.blockingFactors.includes('DAILY_LOSS_LIMIT_REACHED'), true);
});

test('PaperRiskGuardAggregator rejects live money flags', () => {
  const result = new PaperRiskGuardAggregator().evaluate(baseInput({
    productionMoneyAllowed: true,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('PaperRiskGuardAggregator rejects malformed limits', () => {
  const result = new PaperRiskGuardAggregator().evaluate(baseInput({
    maxDailyLoss: 0,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_PAPER_RISK_GUARD_INPUT');
});
