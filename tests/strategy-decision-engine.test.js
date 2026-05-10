const test = require('node:test');
const assert = require('node:assert/strict');
const { StrategyDecisionEngine } = require('../dist/domain/decision/StrategyDecisionEngine');

function baseContext(overrides = {}) {
  return {
    sessionId: 'session-test',
    bankroll: 1000,
    warmup: {
      tableGate: 'GO_RESEARCH',
      riskLabel: 'LOW',
      completeness: 1,
      normalizedEntropy: 0.92,
      thirdLawDeviation: 0.08,
      maxNumberConcentration: 0.08
    },
    strategy: {
      status: 'ALLOWED',
      sampleSize: 240,
      signalCount: 2,
      maxSignalConfidence: 0.72,
      suggestedFraction: 0.004,
      riskLevel: 'LOW'
    },
    benchmark: {
      verdict: 'BENCHMARK_CANDIDATE',
      benchmarkScore: 0.82,
      relativeEdge: 0.06,
      baselineDominanceRisk: 0.18,
      beatRateByCandidate: 0.78
    },
    capital: {
      reviewStatus: 'CAPITAL_RESILIENT_CANDIDATE',
      ruinProbability: 0.06,
      worstDrawdown: 0.18,
      exposureSaturation: 0.32,
      circuitBreakerCount: 0
    },
    monteCarlo: {
      reviewStatus: 'ROBUSTNESS_CANDIDATE',
      robustnessScore: 0.78,
      ruinProbability: 0.08,
      p95MaxDrawdown: 0.24,
      sequenceDependencyRisk: 0.22,
      tailRisk: 'MODERATE'
    },
    ...overrides
  };
}

test('StrategyDecisionEngine returns research-only entry candidate for strong evidence', () => {
  const engine = new StrategyDecisionEngine();
  const report = engine.decide(baseContext());

  assert.equal(report.engineVersion, 'strategy-decision-v1');
  assert.equal(report.operationalGate, 'SIGNAL');
  assert.equal(report.allowed, true);
  assert.equal(report.execution.mode, 'RESEARCH_ONLY');
  assert.equal(report.execution.liveStakeFraction, 0);
  assert.ok(['CONSERVATIVE_ENTRY', 'MODERATE_ENTRY'].includes(report.action));
  assert.ok(report.confidenceScore >= 0 && report.confidenceScore <= 1);
  assert.ok(report.rules.length >= 7);
  assert.equal(report.execution.bankrollGuard.status, 'MARTINGALE_READY');
  assert.ok(report.execution.bankrollGuard.baseStake > 0);
  assert.ok(report.execution.bankrollGuard.martingaleStakeSequence.length >= 2);
  assert.equal(report.execution.bankrollGuard.totalExposureFraction <= report.execution.stopLossFraction, true);
});

test('StrategyDecisionEngine blocks NO_GO warmup regardless of other evidence', () => {
  const engine = new StrategyDecisionEngine();
  const context = baseContext({ warmup: { ...baseContext().warmup, tableGate: 'NO_GO', riskLabel: 'CRITICAL' } });
  const report = engine.decide(context);

  assert.equal(report.action, 'BLOCKED');
  assert.equal(report.decisionGrade, 'REJECTED');
  assert.ok(report.blockers.some((blocker) => blocker.includes('NO_GO')));
});

test('StrategyDecisionEngine never opens live stake even for candidates', () => {
  const engine = new StrategyDecisionEngine();
  const report = engine.decide(baseContext());

  assert.equal(report.execution.liveStakeFraction, 0);
  assert.ok(report.execution.paperStakeFraction >= 0);
  assert.equal(report.execution.mode, 'RESEARCH_ONLY');
});


test('StrategyDecisionEngine blocks unsafe bankroll progression when stake does not fit stop loss budget', () => {
  const engine = new StrategyDecisionEngine();
  const context = baseContext({
    bankroll: 10,
    strategy: { ...baseContext().strategy, suggestedFraction: 0.009 }
  });
  const report = engine.decide(context);

  assert.equal(report.operationalGate, 'NO_GO');
  assert.ok(report.blockers.some((blocker) => blocker.includes('Stake sugerida')));
  assert.equal(report.execution.liveStakeFraction, 0);
});

test('StrategyDecisionEngine exposes no-stake bankroll guard for observation states', () => {
  const engine = new StrategyDecisionEngine();
  const context = baseContext({ strategy: { ...baseContext().strategy, signalCount: 0 } });
  const report = engine.decide(context);

  assert.equal(report.operationalGate, 'OBSERVE');
  assert.equal(report.execution.bankrollGuard.status, 'NO_STAKE');
  assert.deepEqual(report.execution.bankrollGuard.martingaleStakeSequence, []);
});
