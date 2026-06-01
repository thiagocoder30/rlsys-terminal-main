import test from 'node:test';
import assert from 'node:assert/strict';
import { PaperRuntimeCertificationHarness } from '../dist/domain/certification/paper-runtime/index.js';

const createPolicy = () => ({
  minimumSessions: 3,
  minimumCompletedSessions: 3,
  minimumPaperCompatibleRatio: 0.6,
  maximumBlockedRatio: 0.25,
  maximumRuntimeErrorRatio: 0.05,
  maximumAverageDrawdownPercent: 12,
  minimumStabilityScore: 0.7,
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

test('PaperRuntimeCertificationHarness returns PAPER_COMPATIVEL when certification criteria are satisfied', () => {
  const harness = new PaperRuntimeCertificationHarness();

  const result = harness.evaluate({
    sessions: [
      createSession('session-1'),
      createSession('session-2'),
      createSession('session-3'),
    ],
    policy: createPolicy(),
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'PAPER_COMPATIVEL');
    assert.equal(result.value.reason, 'PAPER_RUNTIME_CERTIFIED');
    assert.equal(result.value.productionMoneyAllowed, false);
    assert.equal(result.value.metrics.totalSessions, 3);
    assert.equal(result.value.metrics.completedSessions, 3);
  }
});

test('PaperRuntimeCertificationHarness returns AGUARDAR when evidence is insufficient', () => {
  const harness = new PaperRuntimeCertificationHarness();

  const result = harness.evaluate({
    sessions: [createSession('session-1')],
    policy: createPolicy(),
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'AGUARDAR');
    assert.equal(result.value.reason, 'PAPER_RUNTIME_NEEDS_MORE_EVIDENCE');
    assert.equal(result.value.productionMoneyAllowed, false);
  }
});

test('PaperRuntimeCertificationHarness returns NAO_UTILIZAR when blocked ratio is above policy', () => {
  const harness = new PaperRuntimeCertificationHarness();

  const result = harness.evaluate({
    sessions: [
      createSession('session-1', {
        paperCompatibleDecisions: 4,
        waitDecisions: 1,
        blockedDecisions: 5,
      }),
      createSession('session-2', {
        paperCompatibleDecisions: 4,
        waitDecisions: 1,
        blockedDecisions: 5,
      }),
      createSession('session-3', {
        paperCompatibleDecisions: 4,
        waitDecisions: 1,
        blockedDecisions: 5,
      }),
    ],
    policy: createPolicy(),
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'NAO_UTILIZAR');
    assert.equal(result.value.reason, 'PAPER_RUNTIME_STABILITY_RISK');
    assert.equal(result.value.productionMoneyAllowed, false);
  }
});

test('PaperRuntimeCertificationHarness returns NAO_UTILIZAR when drawdown is above policy', () => {
  const harness = new PaperRuntimeCertificationHarness();

  const result = harness.evaluate({
    sessions: [
      createSession('session-1', { maxDrawdownPercent: 20 }),
      createSession('session-2', { maxDrawdownPercent: 20 }),
      createSession('session-3', { maxDrawdownPercent: 20 }),
    ],
    policy: createPolicy(),
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.decision, 'NAO_UTILIZAR');
    assert.equal(result.value.reason, 'PAPER_RUNTIME_STABILITY_RISK');
    assert.equal(result.value.productionMoneyAllowed, false);
  }
});

test('PaperRuntimeCertificationHarness returns Result/Either error on invalid session totals', () => {
  const harness = new PaperRuntimeCertificationHarness();

  const result = harness.evaluate({
    sessions: [
      createSession('session-1', {
        totalDecisions: 10,
        paperCompatibleDecisions: 10,
        waitDecisions: 10,
        blockedDecisions: 10,
      }),
    ],
    policy: createPolicy(),
  });

  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.equal(result.error.decision, 'NAO_UTILIZAR');
    assert.equal(result.error.reason, 'INVALID_PAPER_RUNTIME_CERTIFICATION_INPUT');
    assert.equal(result.error.productionMoneyAllowed, false);
  }
});

test('PaperRuntimeCertificationHarness processes large session arrays in one pass-compatible behavior', () => {
  const harness = new PaperRuntimeCertificationHarness();
  const sessions = Array.from({ length: 100 }, (_, index) =>
    createSession(`session-${index + 1}`),
  );

  const result = harness.evaluate({
    sessions,
    policy: {
      ...createPolicy(),
      minimumSessions: 100,
      minimumCompletedSessions: 100,
    },
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.value.metrics.totalSessions, 100);
    assert.equal(result.value.metrics.completedSessions, 100);
    assert.equal(result.value.productionMoneyAllowed, false);
  }
});
