import test from 'node:test';
import assert from 'node:assert/strict';
import { FinalPaperCertificationReportEngine } from '../dist/domain/certification/final-paper-certification-report/index.js';

const createPolicy = () => ({
  minimumConfidenceScore: 0.7,
  minimumRequiredEvidenceItems: 3,
  minimumAggregateStabilityScore: 0.72,
  minimumStressPassRatio: 0.67,
  maximumBlockedRatio: 0.25,
  maximumInvalidRatio: 0.05,
});

const createMultiSessionEvaluation = (overrides = {}) => ({
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
    blockedBatchRatio: 0.05,
    invalidBatchRatio: 0,
    aggregateStabilityScore: 0.86,
  },
  batchEvaluations: [],
  productionMoneyAllowed: false,
  explanation: 'mock stable multi-session evaluation',
  ...overrides,
});

const createThresholdCalibrationEvaluation = (overrides = {}) => ({
  decision: 'PAPER_COMPATIVEL',
  reason: 'THRESHOLDS_CALIBRATED',
  metrics: {
    totalSamples: 3,
    paperCompatibleSamples: 3,
    waitSamples: 0,
    blockedSamples: 0,
    averagePaperCompatibleBatchRatio: 0.85,
    averageBlockedBatchRatio: 0.05,
    averageInvalidBatchRatio: 0,
    averageAggregateStabilityScore: 0.84,
  },
  recommendation: {
    minimumPaperCompatibleBatchRatio: 0.76,
    maximumBlockedBatchRatio: 0.1,
    maximumInvalidBatchRatio: 0,
    minimumAggregateStabilityScore: 0.75,
  },
  productionMoneyAllowed: false,
  activeSessionMutationAllowed: false,
  explanation: 'mock stable threshold calibration',
  ...overrides,
});

const createStressTestEvaluation = (overrides = {}) => ({
  decision: 'PAPER_COMPATIVEL',
  reason: 'PAPER_STABILITY_STRESS_TEST_PASSED',
  metrics: {
    totalScenarios: 3,
    totalCycles: 300,
    passedScenarios: 3,
    waitScenarios: 0,
    blockedScenarios: 0,
    invalidScenarios: 0,
    passRatio: 1,
    waitRatio: 0,
    blockedRatio: 0,
    invalidRatio: 0,
    averageStabilityScore: 0.83,
    worstCaseStabilityScore: 0.78,
    averageSeverity: 0.5,
  },
  productionMoneyAllowed: false,
  activeSessionMutationAllowed: false,
  explanation: 'mock stable stress test',
  ...overrides,
});

const createInput = (overrides = {}) => ({
  reportId: 'final-paper-report-1',
  generatedAtIso: '2026-06-01T00:00:00.000Z',
  multiSession: createMultiSessionEvaluation(),
  thresholdCalibration: createThresholdCalibrationEvaluation(),
  stressTest: createStressTestEvaluation(),
  policy: createPolicy(),
  ...overrides,
});

test('FinalPaperCertificationReportEngine approves stable final PAPER certification', () => {
  const engine = new FinalPaperCertificationReportEngine();

  const result = engine.evaluate(createInput());

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'PAPER_COMPATIVEL');
    assert.equal(result.value.reason, 'FINAL_PAPER_CERTIFICATION_APPROVED');
    assert.equal(result.value.productionMoneyAllowed, false);
    assert.equal(result.value.activeSessionMutationAllowed, false);
    assert.equal(result.value.metrics.evidenceItems, 3);
    assert.equal(result.value.evidence.multiSessionDecision, 'PAPER_COMPATIVEL');
  }
});

test('FinalPaperCertificationReportEngine returns AGUARDAR when one evidence source is waiting', () => {
  const engine = new FinalPaperCertificationReportEngine();

  const result = engine.evaluate(
    createInput({
      stressTest: createStressTestEvaluation({
        decision: 'AGUARDAR',
      }),
    }),
  );

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'AGUARDAR');
    assert.equal(result.value.reason, 'FINAL_PAPER_CERTIFICATION_NEEDS_MORE_EVIDENCE');
    assert.equal(result.value.productionMoneyAllowed, false);
    assert.equal(result.value.activeSessionMutationAllowed, false);
  }
});

test('FinalPaperCertificationReportEngine returns NAO_UTILIZAR when institutional risk is detected', () => {
  const engine = new FinalPaperCertificationReportEngine();

  const result = engine.evaluate(
    createInput({
      multiSession: createMultiSessionEvaluation({
        decision: 'NAO_UTILIZAR',
        metrics: {
          ...createMultiSessionEvaluation().metrics,
          blockedBatchRatio: 0.5,
        },
      }),
    }),
  );

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'NAO_UTILIZAR');
    assert.equal(result.value.reason, 'FINAL_PAPER_CERTIFICATION_BLOCKED');
    assert.equal(result.value.productionMoneyAllowed, false);
  }
});

test('FinalPaperCertificationReportEngine returns Result/Either error on invalid report identity', () => {
  const engine = new FinalPaperCertificationReportEngine();

  const result = engine.evaluate(
    createInput({
      reportId: '',
    }),
  );

  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.equal(result.error.decision, 'NAO_UTILIZAR');
    assert.equal(result.error.reason, 'INVALID_FINAL_PAPER_CERTIFICATION_INPUT');
    assert.equal(result.error.productionMoneyAllowed, false);
    assert.equal(result.error.activeSessionMutationAllowed, false);
  }
});

test('FinalPaperCertificationReportEngine blocks invalid safety flags', () => {
  const engine = new FinalPaperCertificationReportEngine();

  const result = engine.evaluate(
    createInput({
      thresholdCalibration: createThresholdCalibrationEvaluation({
        productionMoneyAllowed: true,
      }),
    }),
  );

  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.equal(result.error.reason, 'INVALID_FINAL_PAPER_CERTIFICATION_INPUT');
    assert.equal(result.error.productionMoneyAllowed, false);
    assert.equal(result.error.activeSessionMutationAllowed, false);
  }
});

test('FinalPaperCertificationReportEngine remains deterministic over repeated report generations', () => {
  const engine = new FinalPaperCertificationReportEngine();

  for (let index = 0; index < 100; index += 1) {
    const result = engine.evaluate(
      createInput({
        reportId: `final-paper-report-${index + 1}`,
      }),
    );

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.productionMoneyAllowed, false);
      assert.equal(result.value.activeSessionMutationAllowed, false);
      assert.equal(result.value.metrics.evidenceItems, 3);
    }
  }
});
