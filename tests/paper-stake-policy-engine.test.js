const assert = require('node:assert/strict');
const test = require('node:test');

const {
  PaperBankrollAccountEngine,
} = require('../dist/domain/bankroll/paper-bankroll-account-engine');
const {
  PaperStakePolicyEngine,
} = require('../dist/domain/bankroll/paper-stake-policy-engine');

function createAccount(overrides = {}) {
  const accountResult = new PaperBankrollAccountEngine().createAccount({
    accountId: overrides.accountId ?? 'paper-stake-policy-account',
    initialBalance: overrides.initialBalance ?? 100,
    currency: 'PAPER_BRL',
    createdAtEpochMs: 1717200000000,
  });

  assert.equal(accountResult.ok, true);

  return {
    ...accountResult.value.account,
    ...overrides.accountPatch,
  };
}

const basePolicy = Object.freeze({
  minStake: 1,
  defaultStake: 3,
  maxStake: 5,
  maxStakePercentOfAvailableBalance: 0.05,
  maxSessionExposure: 12,
});

test('PaperStakePolicyEngine approves default stake within institutional limits', () => {
  const result = new PaperStakePolicyEngine().evaluate({
    account: createAccount(),
    policy: basePolicy,
    currentSessionExposure: 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'PAPER_COMPATIVEL');
  assert.equal(result.value.reason, 'PAPER_STAKE_APPROVED_BY_INSTITUTIONAL_POLICY');
  assert.equal(result.value.approvedStake, 3);
  assert.equal(result.value.productionMoneyAllowed, false);
  assert.equal(result.value.liveMoneyAuthorization, false);
});

test('PaperStakePolicyEngine permits user reduction below default stake', () => {
  const result = new PaperStakePolicyEngine().evaluate({
    account: createAccount(),
    policy: basePolicy,
    requestedStake: 2,
    currentSessionExposure: 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'PAPER_COMPATIVEL');
  assert.equal(result.value.reason, 'USER_STAKE_REDUCED_BELOW_DEFAULT');
  assert.equal(result.value.approvedStake, 2);
});

test('PaperStakePolicyEngine caps user stake above institutional maximum', () => {
  const result = new PaperStakePolicyEngine().evaluate({
    account: createAccount(),
    policy: basePolicy,
    requestedStake: 10,
    currentSessionExposure: 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'PAPER_COMPATIVEL');
  assert.equal(result.value.reason, 'USER_STAKE_CAPPED_BY_INSTITUTIONAL_LIMIT');
  assert.equal(result.value.approvedStake, 5);
  assert.equal(result.value.institutionalMaximumStake, 5);
});

test('PaperStakePolicyEngine waits when remaining session exposure is insufficient', () => {
  const result = new PaperStakePolicyEngine().evaluate({
    account: createAccount(),
    policy: basePolicy,
    requestedStake: 3,
    currentSessionExposure: 11.5,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'AGUARDAR');
  assert.equal(result.value.reason, 'INSUFFICIENT_AVAILABLE_PAPER_BALANCE');
  assert.equal(result.value.approvedStake, 0);
});

test('PaperStakePolicyEngine rejects blocked paper bankroll account', () => {
  const result = new PaperStakePolicyEngine().evaluate({
    account: createAccount({ accountPatch: { status: 'BLOCKED' } }),
    policy: basePolicy,
    requestedStake: 1,
    currentSessionExposure: 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.decision, 'NAO_UTILIZAR');
  assert.equal(result.value.reason, 'PAPER_BANKROLL_ACCOUNT_BLOCKED');
  assert.equal(result.value.approvedStake, 0);
});

test('PaperStakePolicyEngine rejects live money flags without silent failure', () => {
  const result = new PaperStakePolicyEngine().evaluate({
    account: createAccount(),
    policy: basePolicy,
    requestedStake: 1,
    currentSessionExposure: 0,
    productionMoneyAllowed: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'LIVE_MONEY_FORBIDDEN');
  assert.equal(result.error.productionMoneyAllowed, false);
  assert.equal(result.error.liveMoneyAuthorization, false);
});

test('PaperStakePolicyEngine rejects malformed policy', () => {
  const result = new PaperStakePolicyEngine().evaluate({
    account: createAccount(),
    policy: {
      minStake: 5,
      defaultStake: 3,
      maxStake: 10,
      maxStakePercentOfAvailableBalance: 0.05,
      maxSessionExposure: 12,
    },
    requestedStake: 1,
    currentSessionExposure: 0,
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reason, 'INVALID_PAPER_STAKE_POLICY_INPUT');
});
