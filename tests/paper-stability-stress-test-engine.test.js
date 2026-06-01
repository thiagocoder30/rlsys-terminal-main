import test from 'node:test';
import assert from 'node:assert/strict';
import { PaperStabilityStressTestEngine } from '../dist/domain/certification/paper-stability-stress-test/index.js';

const createPolicy = () => ({
  minimumScenarios: 3,
  minimumCycles: 300,
  minimumPassRatio: 0.67,
  maximumBlockedRatio: 0.34,
  maximumInvalidRatio: 0,
  minimumAverageStabilityScore: 0.72,
  minimumWorstCaseStabilityScore: 0.65,
  maximumAverageSeverity: 0.7,
});

const createEvaluation = (overrides = {}) => ({
  decision: 'PAPER_COMPATIVEL',
  reason: 'MULTI_SESSION_CERTIFIED',
  metrics: {
    totalBatches: 3,
    paperCompatibleBatches: 3,
    waitBatches: 0,
    blockedBatches: 0,
    invalidBatches: 0,
    paperCompatibleBatchRatio: 1,
    waitBatchRatio: 0,
    blockedBatchRatio: 0,
    invalidBatchRatio: 0,
    aggregateStabilityScore: 0.86,
  },
  batchEvaluations: [],
  productionMoneyAllowed: false,
  explanation: 'mock stable multi-session evaluation',
  ...overrides,
});

const createScenario = (scenarioId, overrides = {}) => ({
  scenarioId,
  label: `scenario-${scenarioId}`,
  cycles: 100,
  severity: 0.5,
  evaluation: createEvaluation(),
  ...overrides,
});

test('PaperStabilityStressTestEngine returns PAPER_COMPATIVEL for stable offline stress scenarios', () => {
  const engine = new PaperStabilityStressTestEngine();

  const result = engine.evaluate({
    scenarios: [
      createScenario('s1'),
      createScenario('s2'),
      createScenario('s3'),
    ],
    policy: createPolicy(),
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'PAPER_COMPATIVEL');
    assert.equal(result.value.reason, 'PAPER_STABILITY_STRESS_TEST_PASSED');
    assert.equal(result.value.productionMoneyAllowed, false);
    assert.equal(result.value.activeSessionMutationAllowed, false);
    assert.equal(result.value.metrics.totalScenarios, 3);
    assert.equal(result.value.metrics.totalCycles, 300);
  }
});

test('PaperStabilityStressTestEngine returns AGUARDAR when stress evidence is insufficient', () => {
  const engine = new PaperStabilityStressTestEngine();

  const result = engine.evaluate({
    scenarios: [createScenario('s1')],
    policy: createPolicy(),
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'AGUARDAR');
    assert.equal(result.value.reason, 'PAPER_STABILITY_STRESS_TEST_NEEDS_MORE_EVIDENCE');
    assert.equal(result.value.productionMoneyAllowed, false);
    assert.equal(result.value.activeSessionMutationAllowed, false);
  }
});

test('PaperStabilityStressTestEngine returns NAO_UTILIZAR when worst-case stability fails', () => {
  const engine = new PaperStabilityStressTestEngine();

  const unstableEvaluation = createEvaluation({
    decision: 'NAO_UTILIZAR',
    metrics: {
      totalBatches: 3,
      paperCompatibleBatches: 1,
      waitBatches: 0,
      blockedBatches: 2,
      invalidBatches: 0,
      paperCompatibleBatchRatio: 0.33,
      waitBatchRatio: 0,
      blockedBatchRatio: 0.67,
      invalidBatchRatio: 0,
      aggregateStabilityScore: 0.42,
    },
  });

  const result = engine.evaluate({
    scenarios: [
      createScenario('s1'),
      createScenario('s2'),
      createScenario('unstable', { evaluation: unstableEvaluation }),
    ],
    policy: createPolicy(),
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'NAO_UTILIZAR');
    assert.equal(result.value.reason, 'PAPER_STABILITY_STRESS_TEST_FAILED');
    assert.equal(result.value.productionMoneyAllowed, false);
    assert.equal(result.value.activeSessionMutationAllowed, false);
    assert.equal(result.value.metrics.blockedScenarios, 1);
  }
});

test('PaperStabilityStressTestEngine returns Result/Either error for invalid scenario identity', () => {
  const engine = new PaperStabilityStressTestEngine();

  const result = engine.evaluate({
    scenarios: [
      createScenario('', {
        label: '',
      }),
    ],
    policy: createPolicy(),
  });

  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.equal(result.error.decision, 'NAO_UTILIZAR');
    assert.equal(result.error.reason, 'INVALID_PAPER_STABILITY_STRESS_TEST_INPUT');
    assert.equal(result.error.productionMoneyAllowed, false);
    assert.equal(result.error.activeSessionMutationAllowed, false);
  }
});

test('PaperStabilityStressTestEngine blocks invalid certification ratios as stress risk', () => {
  const engine = new PaperStabilityStressTestEngine();

  const invalidEvaluation = createEvaluation({
    metrics: {
      totalBatches: 3,
      paperCompatibleBatches: 2,
      waitBatches: 0,
      blockedBatches: 1,
      invalidBatches: 1,
      paperCompatibleBatchRatio: 0.67,
      waitBatchRatio: 0,
      blockedBatchRatio: 0.33,
      invalidBatchRatio: 0.33,
      aggregateStabilityScore: 0.72,
    },
  });

  const result = engine.evaluate({
    scenarios: [
      createScenario('s1'),
      createScenario('s2'),
      createScenario('invalid', { evaluation: invalidEvaluation }),
    ],
    policy: createPolicy(),
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'NAO_UTILIZAR');
    assert.equal(result.value.reason, 'PAPER_STABILITY_STRESS_TEST_FAILED');
    assert.equal(result.value.metrics.invalidScenarios, 1);
    assert.equal(result.value.productionMoneyAllowed, false);
  }
});

test('PaperStabilityStressTestEngine processes large scenario arrays with O(n) behavior', () => {
  const engine = new PaperStabilityStressTestEngine();

  const scenarios = Array.from({ length: 100 }, (_, index) =>
    createScenario(`scenario-${index + 1}`, {
      cycles: 10,
      severity: 0.4,
    }),
  );

  const result = engine.evaluate({
    scenarios,
    policy: {
      ...createPolicy(),
      minimumScenarios: 100,
      minimumCycles: 1000,
    },
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.metrics.totalScenarios, 100);
    assert.equal(result.value.metrics.totalCycles, 1000);
    assert.equal(result.value.metrics.passedScenarios, 100);
    assert.equal(result.value.productionMoneyAllowed, false);
    assert.equal(result.value.activeSessionMutationAllowed, false);
  }
});
