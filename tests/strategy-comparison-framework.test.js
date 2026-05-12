const test = require('node:test');
const assert = require('node:assert/strict');
const { StrategyComparisonFramework } = require('../dist/domain/comparison/StrategyComparisonFramework');

function candidate(overrides = {}) {
  return {
    strategyId: 'dealer-signature',
    sampleSize: 120,
    totalStake: 120,
    netProfit: 18,
    evPerUnitStake: 0.15,
    profitFactor: 1.42,
    maxDrawdownRate: 0.08,
    riskOfRuinEstimate: 0.02,
    signalFrequency: 0.18,
    confidence: 0.76,
    regimes: ['stable', 'drifting'],
    ...overrides
  };
}

test('StrategyComparisonFramework selects a clear risk-adjusted leader', () => {
  const framework = new StrategyComparisonFramework();
  const result = framework.compare({
    experimentId: 'strategy-bakeoff-001',
    candidates: [
      candidate(),
      candidate({ strategyId: 'raw-frequency', evPerUnitStake: 0.03, profitFactor: 1.08, maxDrawdownRate: 0.2, riskOfRuinEstimate: 0.08, confidence: 0.57 }),
      candidate({ strategyId: 'sector-pressure', evPerUnitStake: 0.08, profitFactor: 1.18, maxDrawdownRate: 0.12, riskOfRuinEstimate: 0.04, confidence: 0.66 })
    ],
    policy: { minLeaderScoreGap: 0.02 }
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'LEADER_FOUND');
  assert.equal(result.value.leader.strategyId, 'dealer-signature');
  assert.equal(result.value.ranking.length, 3);
  assert.ok(result.value.leader.score > result.value.runnerUp.score);
});

test('StrategyComparisonFramework returns no clear leader for close candidates', () => {
  const framework = new StrategyComparisonFramework();
  const result = framework.compare({
    experimentId: 'close-race',
    candidates: [
      candidate({ strategyId: 'alpha-a', evPerUnitStake: 0.08, profitFactor: 1.2, confidence: 0.7 }),
      candidate({ strategyId: 'alpha-b', evPerUnitStake: 0.079, profitFactor: 1.2, confidence: 0.7 })
    ],
    policy: { minLeaderScoreGap: 0.08 }
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'NO_CLEAR_LEADER');
  assert.ok(result.value.blockers.some((blocker) => blocker.includes('leader score gap')));
});

test('StrategyComparisonFramework blocks candidates that fail eligibility policy', () => {
  const framework = new StrategyComparisonFramework();
  const result = framework.compare({
    experimentId: 'bad-candidates',
    candidates: [
      candidate({ strategyId: 'negative-ev', evPerUnitStake: -0.02, profitFactor: 0.91 }),
      candidate({ strategyId: 'too-risky', maxDrawdownRate: 0.7, riskOfRuinEstimate: 0.4 })
    ]
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'BLOCKED');
  assert.equal(result.value.leader, undefined);
  assert.ok(result.value.ranking.every((entry) => entry.eligible === false));
});

test('StrategyComparisonFramework is deterministic across repeated comparisons', () => {
  const framework = new StrategyComparisonFramework();
  const request = {
    experimentId: 'deterministic-comparison',
    candidates: [
      candidate({ strategyId: 'b-strategy' }),
      candidate({ strategyId: 'a-strategy' })
    ]
  };

  const first = framework.compare(request);
  const second = framework.compare(request);

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(first.value.checksum, second.value.checksum);
  assert.equal(first.value.ranking[0].strategyId, 'a-strategy');
});

test('StrategyComparisonFramework rejects malformed input without silent failure', () => {
  const framework = new StrategyComparisonFramework();
  const result = framework.compare({
    experimentId: 'malformed',
    candidates: [
      candidate({ strategyId: 'dup' }),
      candidate({ strategyId: 'dup', sampleSize: Number.NaN })
    ]
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'STRATEGY_COMPARISON_INVALID_REQUEST');
});

test('StrategyComparisonFramework blocks oversized comparison batches', () => {
  const framework = new StrategyComparisonFramework();
  const result = framework.compare({
    experimentId: 'oversized-comparison',
    candidates: [candidate({ strategyId: 'one' }), candidate({ strategyId: 'two' })],
    policy: { maxStrategies: 1 }
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'STRATEGY_COMPARISON_TOO_LARGE');
});
