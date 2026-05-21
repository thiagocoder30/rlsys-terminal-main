const test = require('node:test');
const assert = require('node:assert/strict');
const {
  OperatorRiskProfileCalculator,
} = require('../dist/domain/risk');

test('OperatorRiskProfileCalculator creates conservative profile by default policy', () => {
  const calculator = new OperatorRiskProfileCalculator();

  const profile = calculator.calculate({
    bankroll: 200,
    riskMode: 'CONSERVATIVE',
    allowMartingale: true,
  });

  assert.equal(profile.bankroll, 200);
  assert.equal(profile.baseStake, 2);
  assert.equal(profile.dailyStopWin, 16);
  assert.equal(profile.dailyStopLoss, 10);
  assert.equal(profile.maxSingleExposure, 6);
  assert.equal(profile.maxMartingaleSteps, 1);
  assert.match(profile.recommendedSessionGoal, /Preservar banca/);
});

test('OperatorRiskProfileCalculator disables martingale when operator does not allow it', () => {
  const calculator = new OperatorRiskProfileCalculator();

  const profile = calculator.calculate({
    bankroll: 150,
    riskMode: 'MODERATE',
    allowMartingale: false,
  });

  assert.equal(profile.baseStake, 3);
  assert.equal(profile.dailyStopWin, 18);
  assert.equal(profile.dailyStopLoss, 12);
  assert.equal(profile.maxSingleExposure, 9);
  assert.equal(profile.maxMartingaleSteps, 0);
});

test('OperatorRiskProfileCalculator supports aggressive mode but keeps bounded exposure', () => {
  const calculator = new OperatorRiskProfileCalculator();

  const profile = calculator.calculate({
    bankroll: 100,
    riskMode: 'AGGRESSIVE',
    allowMartingale: true,
  });

  assert.equal(profile.baseStake, 3);
  assert.equal(profile.dailyStopWin, 18);
  assert.equal(profile.dailyStopLoss, 12);
  assert.equal(profile.maxSingleExposure, 9);
  assert.equal(profile.maxMartingaleSteps, 2);
});

test('OperatorRiskProfileCalculator rejects invalid bankroll', () => {
  const calculator = new OperatorRiskProfileCalculator();

  assert.throws(() => calculator.calculate({
    bankroll: 0,
    riskMode: 'CONSERVATIVE',
    allowMartingale: true,
  }), /bankroll/);
});
