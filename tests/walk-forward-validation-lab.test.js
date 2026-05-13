const test = require('node:test');
const assert = require('node:assert/strict');
const { WalkForwardValidationLab } = require('../dist/domain/validation/WalkForwardValidationLab');

function outcome(index, netProfit, overrides = {}) {
  return {
    signalId: `sig-${index}`,
    frameIndex: index,
    stake: 1,
    netProfit,
    strategyId: 'dealer-signature',
    regime: 'stable',
    confidence: 0.72,
    ...overrides
  };
}

function sequence(length, profitPattern) {
  return Array.from({ length }, (_, index) => outcome(index, profitPattern(index)));
}

const policy = {
  trainWindowSize: 20,
  validationWindowSize: 10,
  stepSize: 10,
  minValidationWindows: 3,
  minValidationSamples: 10,
  minValidationEvPerUnitStake: 0.05,
  maxTrainValidationEvGap: 0.4,
  minPassedValidationRate: 0.6,
  maxValidationDrawdownRate: 0.4,
  maxRiskOfRuinEstimate: 0.35
};

test('WalkForwardValidationLab accepts robust out-of-sample alpha candidate', () => {
  const lab = new WalkForwardValidationLab();
  const result = lab.validate({
    experimentId: 'wf-robust-alpha',
    outcomes: sequence(70, (index) => (index % 5 === 0 ? -0.4 : 0.45)),
    startingBankroll: 100,
    policy
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'ROBUST_ALPHA_CANDIDATE');
  assert.ok(result.value.aggregate.windowCount >= 4);
  assert.ok(result.value.aggregate.averageValidationEvPerUnitStake >= policy.minValidationEvPerUnitStake);
  assert.equal(result.value.blockers.length, 0);
});

test('WalkForwardValidationLab flags train-positive validation-negative overfit', () => {
  const lab = new WalkForwardValidationLab();
  const outcomes = sequence(70, (index) => (index < 25 ? 0.5 : -0.25));
  const result = lab.validate({ experimentId: 'wf-overfit', outcomes, startingBankroll: 100, policy });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'OVERFIT');
  assert.ok(result.value.blockers.some((blocker) => blocker.includes('average validation EV')));
});

test('WalkForwardValidationLab returns inconclusive when validation pass rate is weak but not pure overfit', () => {
  const lab = new WalkForwardValidationLab();
  const outcomes = sequence(70, (index) => (index % 3 === 0 ? -0.35 : 0.12));
  const result = lab.validate({
    experimentId: 'wf-inconclusive',
    outcomes,
    startingBankroll: 100,
    policy: { ...policy, minValidationEvPerUnitStake: 0.02, minPassedValidationRate: 0.9 }
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'INCONCLUSIVE');
  assert.ok(result.value.warnings.length > 0);
});

test('WalkForwardValidationLab is deterministic across repeated runs', () => {
  const lab = new WalkForwardValidationLab();
  const request = {
    experimentId: 'wf-deterministic',
    outcomes: sequence(70, (index) => (index % 4 === 0 ? -0.2 : 0.3)),
    startingBankroll: 100,
    policy
  };

  const first = lab.validate(request);
  const second = lab.validate(request);

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(first.value.checksum, second.value.checksum);
});

test('WalkForwardValidationLab rejects malformed outcomes without silent failure', () => {
  const lab = new WalkForwardValidationLab();
  const result = lab.validate({
    experimentId: 'wf-malformed',
    outcomes: [outcome(1, 0.2), outcome(1, Number.NaN)],
    policy
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'WALK_FORWARD_INVALID_REQUEST');
});

test('WalkForwardValidationLab blocks oversized research batches', () => {
  const lab = new WalkForwardValidationLab();
  const result = lab.validate({
    experimentId: 'wf-too-large',
    outcomes: sequence(3, () => 0.1),
    policy: { ...policy, maxOutcomes: 2 }
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'WALK_FORWARD_TOO_LARGE');
});
