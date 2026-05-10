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
  assert.equal(report.operationalGate, 'BLOCKED');
  assert.equal(report.execution.mode, 'RESEARCH_ONLY');
  assert.equal(report.execution.liveStakeFraction, 0);
  assert.ok(['CONSERVATIVE_ENTRY', 'MODERATE_ENTRY'].includes(report.action));
  assert.ok(report.confidenceScore >= 0 && report.confidenceScore <= 1);
  assert.ok(report.rules.length >= 6);
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
