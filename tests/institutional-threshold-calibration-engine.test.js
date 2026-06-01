import test from 'node:test';
import assert from 'node:assert/strict';
import { InstitutionalThresholdCalibrationEngine } from '../dist/domain/certification/threshold-calibration/index.js';

const createPolicy = () => ({
  minimumHistoricalEvaluations: 3,
  minimumObservedPaperCompatibleBatchRatio: 0.65,
  maximumObservedBlockedBatchRatio: 0.25,
  maximumObservedInvalidBatchRatio: 0.05,
  minimumObservedAggregateStabilityScore: 0.7,
  safetyMarginRatio: 0.1,
  bounds: {
    minimumAllowedPaperCompatibleBatchRatio: 0.5,
    maximumAllowedPaperCompatibleBatchRatio: 0.95,
    minimumAllowedBlockedBatchRatio: 0,
    maximumAllowedBlockedBatchRatio: 0.3,
    minimumAllowedInvalidBatchRatio: 0,
    maximumAllowedInvalidBatchRatio: 0.05,
    minimumAllowedAggregateStabilityScore: 0.6,
    maximumAllowedAggregateStabilityScore: 0.95,
  },
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
    paperCompatibleBatchRatio: 0.85,
    waitBatchRatio: 0,
    blockedBatchRatio: 0.08,
    invalidBatchRatio: 0,
    aggregateStabilityScore: 0.86,
  },
  batchEvaluations: [],
  productionMoneyAllowed: false,
  explanation: 'mock stable evaluation',
  ...overrides,
});

const createSample = (calibrationId, overrides = {}) => ({
  calibrationId,
  label: `sample-${calibrationId}`,
  evaluation: createEvaluation(),
  ...overrides,
});

test('InstitutionalThresholdCalibrationEngine calibrates thresholds with stable PAPER history', () => {
  const engine = new InstitutionalThresholdCalibrationEngine();

  const result = engine.evaluate({
    samples: [createSample('c1'), createSample('c2'), createSample('c3')],
    policy: createPolicy(),
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'PAPER_COMPATIVEL');
    assert.equal(result.value.reason, 'THRESHOLDS_CALIBRATED');
    assert.equal(result.value.productionMoneyAllowed, false);
    assert.equal(result.value.activeSessionMutationAllowed, false);
    assert.equal(result.value.metrics.totalSamples, 3);
    assert.equal(result.value.recommendation.minimumPaperCompatibleBatchRatio, 0.765);
  }
});

test('InstitutionalThresholdCalibrationEngine returns AGUARDAR with insufficient historical evidence', () => {
  const engine = new InstitutionalThresholdCalibrationEngine();

  const result = engine.evaluate({
    samples: [createSample('c1')],
    policy: createPolicy(),
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'AGUARDAR');
    assert.equal(result.value.reason, 'THRESHOLD_CALIBRATION_NEEDS_MORE_EVIDENCE');
    assert.equal(result.value.productionMoneyAllowed, false);
    assert.equal(result.value.activeSessionMutationAllowed, false);
  }
});

test('InstitutionalThresholdCalibrationEngine returns NAO_UTILIZAR when observed stability is unsafe', () => {
  const engine = new InstitutionalThresholdCalibrationEngine();

  const riskyEvaluation = createEvaluation({
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
      aggregateStabilityScore: 0.45,
    },
  });

  const result = engine.evaluate({
    samples: [
      createSample('c1', { evaluation: riskyEvaluation }),
      createSample('c2', { evaluation: riskyEvaluation }),
      createSample('c3', { evaluation: riskyEvaluation }),
    ],
    policy: createPolicy(),
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'NAO_UTILIZAR');
    assert.equal(result.value.reason, 'THRESHOLD_CALIBRATION_STABILITY_RISK');
    assert.equal(result.value.productionMoneyAllowed, false);
    assert.equal(result.value.activeSessionMutationAllowed, false);
  }
});

test('InstitutionalThresholdCalibrationEngine returns Result/Either error for invalid sample identity', () => {
  const engine = new InstitutionalThresholdCalibrationEngine();

  const result = engine.evaluate({
    samples: [
      createSample('', {
        label: '',
      }),
    ],
    policy: createPolicy(),
  });

  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.equal(result.error.decision, 'NAO_UTILIZAR');
    assert.equal(result.error.reason, 'INVALID_THRESHOLD_CALIBRATION_INPUT');
    assert.equal(result.error.productionMoneyAllowed, false);
    assert.equal(result.error.activeSessionMutationAllowed, false);
  }
});

test('InstitutionalThresholdCalibrationEngine clamps recommendations inside institutional bounds', () => {
  const engine = new InstitutionalThresholdCalibrationEngine();

  const highEvaluation = createEvaluation({
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
      aggregateStabilityScore: 1,
    },
  });

  const result = engine.evaluate({
    samples: [
      createSample('c1', { evaluation: highEvaluation }),
      createSample('c2', { evaluation: highEvaluation }),
      createSample('c3', { evaluation: highEvaluation }),
    ],
    policy: createPolicy(),
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.recommendation.minimumPaperCompatibleBatchRatio, 0.9);
    assert.equal(result.value.recommendation.minimumAggregateStabilityScore, 0.9);
    assert.equal(result.value.recommendation.maximumBlockedBatchRatio, 0);
    assert.equal(result.value.recommendation.maximumInvalidBatchRatio, 0);
  }
});

test('InstitutionalThresholdCalibrationEngine processes large history arrays with O(n) behavior', () => {
  const engine = new InstitutionalThresholdCalibrationEngine();

  const samples = Array.from({ length: 100 }, (_, index) =>
    createSample(`calibration-${index + 1}`),
  );

  const result = engine.evaluate({
    samples,
    policy: {
      ...createPolicy(),
      minimumHistoricalEvaluations: 100,
    },
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.metrics.totalSamples, 100);
    assert.equal(result.value.metrics.paperCompatibleSamples, 100);
    assert.equal(result.value.productionMoneyAllowed, false);
    assert.equal(result.value.activeSessionMutationAllowed, false);
  }
});
