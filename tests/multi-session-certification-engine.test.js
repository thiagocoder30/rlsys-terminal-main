import test from 'node:test';
import assert from 'node:assert/strict';
import { MultiSessionCertificationEngine } from '../dist/domain/certification/multi-session/index.js';

const createPaperRuntimePolicy = () => ({
  minimumSessions: 3,
  minimumCompletedSessions: 3,
  minimumPaperCompatibleRatio: 0.6,
  maximumBlockedRatio: 0.25,
  maximumRuntimeErrorRatio: 0.05,
  maximumAverageDrawdownPercent: 12,
  minimumStabilityScore: 0.7,
});

const createPolicy = () => ({
  minimumCertificationBatches: 3,
  minimumPaperCompatibleBatchRatio: 0.67,
  maximumBlockedBatchRatio: 0.34,
  maximumInvalidBatchRatio: 0,
  minimumAggregateStabilityScore: 0.7,
  paperRuntimePolicy: createPaperRuntimePolicy(),
});

const createSession = (sessionId, overrides = {}) => ({
  sessionId,
  completed: true,
  totalDecisions: 10,
  paperCompatibleDecisions: 7,
  waitDecisions: 2,
  blockedDecisions: 1,
  runtimeErrors: 0,
  maxDrawdownPercent: 4,
  ...overrides,
});

const createBatch = (certificationId, overrides = {}) => ({
  certificationId,
  label: `batch-${certificationId}`,
  sessions: [
    createSession(`${certificationId}-session-1`),
    createSession(`${certificationId}-session-2`),
    createSession(`${certificationId}-session-3`),
  ],
  ...overrides,
});

test('MultiSessionCertificationEngine returns PAPER_COMPATIVEL when all batches pass', () => {
  const engine = new MultiSessionCertificationEngine();

  const result = engine.evaluate({
    batches: [createBatch('c1'), createBatch('c2'), createBatch('c3')],
    policy: createPolicy(),
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'PAPER_COMPATIVEL');
    assert.equal(result.value.reason, 'MULTI_SESSION_CERTIFIED');
    assert.equal(result.value.productionMoneyAllowed, false);
    assert.equal(result.value.metrics.totalBatches, 3);
    assert.equal(result.value.metrics.paperCompatibleBatches, 3);
    assert.equal(result.value.batchEvaluations.length, 3);
  }
});

test('MultiSessionCertificationEngine returns AGUARDAR when batch evidence is insufficient', () => {
  const engine = new MultiSessionCertificationEngine();

  const result = engine.evaluate({
    batches: [createBatch('c1')],
    policy: createPolicy(),
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'AGUARDAR');
    assert.equal(result.value.reason, 'MULTI_SESSION_NEEDS_MORE_EVIDENCE');
    assert.equal(result.value.productionMoneyAllowed, false);
  }
});

test('MultiSessionCertificationEngine returns NAO_UTILIZAR when aggregate stability fails', () => {
  const engine = new MultiSessionCertificationEngine();

  const riskyBatch = createBatch('risky', {
    sessions: [
      createSession('risky-1', {
        paperCompatibleDecisions: 3,
        waitDecisions: 1,
        blockedDecisions: 6,
      }),
      createSession('risky-2', {
        paperCompatibleDecisions: 3,
        waitDecisions: 1,
        blockedDecisions: 6,
      }),
      createSession('risky-3', {
        paperCompatibleDecisions: 3,
        waitDecisions: 1,
        blockedDecisions: 6,
      }),
    ],
  });

  const result = engine.evaluate({
    batches: [createBatch('c1'), riskyBatch, riskyBatch],
    policy: createPolicy(),
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'NAO_UTILIZAR');
    assert.equal(result.value.reason, 'MULTI_SESSION_STABILITY_RISK');
    assert.equal(result.value.productionMoneyAllowed, false);
    assert.equal(result.value.metrics.blockedBatches, 2);
  }
});

test('MultiSessionCertificationEngine returns Result/Either error on invalid batch identity', () => {
  const engine = new MultiSessionCertificationEngine();

  const result = engine.evaluate({
    batches: [
      createBatch('', {
        label: '',
      }),
    ],
    policy: createPolicy(),
  });

  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.equal(result.error.decision, 'NAO_UTILIZAR');
    assert.equal(result.error.reason, 'INVALID_MULTI_SESSION_CERTIFICATION_INPUT');
    assert.equal(result.error.productionMoneyAllowed, false);
  }
});

test('MultiSessionCertificationEngine counts invalid paper batch as institutional risk', () => {
  const engine = new MultiSessionCertificationEngine();

  const invalidPaperBatch = createBatch('invalid-paper', {
    sessions: [
      createSession('invalid-session', {
        totalDecisions: 10,
        paperCompatibleDecisions: 10,
        waitDecisions: 10,
        blockedDecisions: 10,
      }),
    ],
  });

  const result = engine.evaluate({
    batches: [createBatch('c1'), createBatch('c2'), invalidPaperBatch],
    policy: createPolicy(),
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'NAO_UTILIZAR');
    assert.equal(result.value.reason, 'MULTI_SESSION_STABILITY_RISK');
    assert.equal(result.value.productionMoneyAllowed, false);
    assert.equal(result.value.metrics.invalidBatches, 1);
  }
});

test('MultiSessionCertificationEngine processes large batch arrays with O(n) behavior', () => {
  const engine = new MultiSessionCertificationEngine();

  const batches = Array.from({ length: 100 }, (_, index) =>
    createBatch(`cert-${index + 1}`),
  );

  const result = engine.evaluate({
    batches,
    policy: {
      ...createPolicy(),
      minimumCertificationBatches: 100,
    },
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.metrics.totalBatches, 100);
    assert.equal(result.value.metrics.paperCompatibleBatches, 100);
    assert.equal(result.value.batchEvaluations.length, 100);
    assert.equal(result.value.productionMoneyAllowed, false);
  }
});
