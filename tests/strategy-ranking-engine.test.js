const test = require('node:test');
const assert = require('node:assert/strict');
const { StrategyRankingEngine } = require('../dist/domain/strategy/StrategyRankingEngine');

function candidate(overrides = {}) {
  return {
    strategyId: 'sector-rotation',
    label: 'Sector Rotation',
    status: 'ACTIVE',
    sampleSize: 180,
    wins: 104,
    losses: 70,
    pushes: 6,
    signalConfidence: 0.78,
    expectedValue: 0.028,
    maxDrawdown: 0.18,
    volatility: 0.22,
    recencyWeight: 0.92,
    riskLevel: 'LOW',
    ...overrides
  };
}

test('StrategyRankingEngine ranks eligible candidates by Bayesian evidence adjusted for risk', () => {
  const engine = new StrategyRankingEngine();
  const report = engine.rank([
    candidate({ strategyId: 'raw-win-rate-trap', label: 'Raw Win Rate Trap', sampleSize: 24, wins: 18, losses: 6, pushes: 0, expectedValue: 0.05 }),
    candidate(),
    candidate({ strategyId: 'high-risk-edge', label: 'High Risk Edge', wins: 125, losses: 50, pushes: 5, maxDrawdown: 0.44, volatility: 0.5, riskLevel: 'HIGH' })
  ]);

  assert.equal(report.engineVersion, 'strategy-ranking-v1');
  assert.equal(report.candidateCount, 3);
  assert.equal(report.topCandidate.strategyId, 'sector-rotation');
  assert.equal(report.topCandidate.decision, 'ELIGIBLE');
  assert.equal(report.rankings[0].rank, 1);
  assert.equal(report.rankings[0].decision, 'ELIGIBLE');
  assert.equal(report.rankings.some((item) => item.strategyId === 'raw-win-rate-trap' && item.decision === 'WATCH'), true);
  assert.equal(report.rankings.some((item) => item.strategyId === 'high-risk-edge' && item.decision === 'LOCKED'), true);
});

test('StrategyRankingEngine is deterministic for repeated input order and tie-breaks by id', () => {
  const engine = new StrategyRankingEngine();
  const left = candidate({ strategyId: 'b-strategy', label: 'B Strategy' });
  const right = candidate({ strategyId: 'a-strategy', label: 'A Strategy' });

  const first = engine.rank([left, right]);
  const second = engine.rank([left, right]);

  assert.deepEqual(first, second);
  assert.equal(first.rankings[0].strategyId, 'a-strategy');
});

test('StrategyRankingEngine rejects malformed candidates without silent failure', () => {
  const engine = new StrategyRankingEngine();

  assert.throws(() => engine.rank([candidate({ strategyId: '' })]), /invalid_strategy_candidate_id/);
  assert.throws(() => engine.rank([candidate({ wins: 200 })]), /invalid_strategy_candidate_outcome_total/);
  assert.throws(() => engine.rank([candidate({ signalConfidence: 1.2 })]), /invalid_strategy_candidate_signal_confidence/);
});
