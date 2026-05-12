const test = require('node:test');
const assert = require('node:assert/strict');
const { EVRiskAnalyticsEngine } = require('../dist/domain/analytics/EVRiskAnalyticsEngine');

function profitableOutcomes(count = 40) {
  return Array.from({ length: count }, (_, index) => ({
    signalId: `positive-${index}`,
    strategyId: index % 2 === 0 ? 'sector-pressure' : 'dealer-signature',
    regime: index % 4 === 0 ? 'STABLE' : 'DRIFTING',
    stake: 1,
    netProfit: index % 5 === 0 ? -1 : 0.5,
    confidence: 0.72,
    frameIndex: index * 3
  }));
}

test('EVRiskAnalyticsEngine identifies positive edge candidate under bounded risk', () => {
  const engine = new EVRiskAnalyticsEngine();
  const result = engine.analyze({
    experimentId: 'positive-edge-candidate',
    totalFrames: 240,
    startingBankroll: 100,
    ruinThreshold: 20,
    outcomes: profitableOutcomes(50),
    policy: { minSampleSize: 30, minEvPerUnitStake: 0.01, minProfitFactor: 1.05, maxDrawdownRate: 0.2 }
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'POSITIVE_EDGE_CANDIDATE');
  assert.ok(result.value.metrics.expectedValuePerUnitStake > 0);
  assert.ok(result.value.metrics.profitFactor > 1);
  assert.equal(result.value.strategyBreakdown.length, 2);
  assert.equal(result.value.regimeBreakdown.length, 2);
});

test('EVRiskAnalyticsEngine blocks negative expected value samples', () => {
  const engine = new EVRiskAnalyticsEngine();
  const outcomes = Array.from({ length: 40 }, (_, index) => ({
    signalId: `negative-${index}`,
    strategyId: 'raw-frequency',
    regime: 'STABLE',
    stake: 1,
    netProfit: index % 3 === 0 ? 1 : -1,
    confidence: 0.61
  }));

  const result = engine.analyze({ experimentId: 'negative-ev', outcomes, startingBankroll: 80 });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'NEGATIVE_OR_INCONCLUSIVE');
  assert.ok(result.value.blockers.some((blocker) => blocker.includes('EV/unit')));
});

test('EVRiskAnalyticsEngine blocks insufficient samples even when profitable', () => {
  const engine = new EVRiskAnalyticsEngine();
  const result = engine.analyze({
    experimentId: 'too-small',
    outcomes: profitableOutcomes(5),
    policy: { minSampleSize: 30 }
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'NEGATIVE_OR_INCONCLUSIVE');
  assert.ok(result.value.blockers.some((blocker) => blocker.includes('sample size')));
});

test('EVRiskAnalyticsEngine exposes deterministic checksums for repeated analytics', () => {
  const engine = new EVRiskAnalyticsEngine();
  const request = {
    experimentId: 'deterministic-risk',
    totalFrames: 100,
    startingBankroll: 100,
    outcomes: profitableOutcomes(35)
  };

  const first = engine.analyze(request);
  const second = engine.analyze(request);

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(first.value.checksum, second.value.checksum);
});

test('EVRiskAnalyticsEngine rejects malformed outcomes without silent failure', () => {
  const engine = new EVRiskAnalyticsEngine();
  const result = engine.analyze({
    experimentId: 'malformed',
    outcomes: [
      { signalId: 'dup', stake: 1, netProfit: 1 },
      { signalId: 'dup', stake: 0, netProfit: Number.NaN }
    ]
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'EV_RISK_INVALID_REQUEST');
});

test('EVRiskAnalyticsEngine blocks oversized analytics batches before processing', () => {
  const engine = new EVRiskAnalyticsEngine();
  const result = engine.analyze({
    experimentId: 'oversized',
    outcomes: profitableOutcomes(4),
    policy: { maxOutcomes: 3 }
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'EV_RISK_TOO_LARGE');
});
