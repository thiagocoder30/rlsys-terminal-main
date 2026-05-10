const test = require('node:test');
const assert = require('node:assert/strict');
const { DecisionOrchestrator } = require('../dist/domain/decision/DecisionOrchestrator');
const { RegimeClassificationEngine } = require('../dist/domain/regime/RegimeClassificationEngine');
const { StrategyEnsembleEngine } = require('../dist/domain/strategy/StrategyEnsembleEngine');

function baseDecisionContext(overrides = {}) {
  return {
    sessionId: 'session-orchestrator',
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
      status: 'LOCKED',
      sampleSize: 240,
      signalCount: 0,
      maxSignalConfidence: 0,
      suggestedFraction: 0,
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

function strongCandidate(strategyId = 'sector-alpha') {
  return {
    strategyId,
    label: 'Sector Alpha',
    status: 'ACTIVE',
    sampleSize: 180,
    wins: 112,
    losses: 58,
    pushes: 10,
    signalConfidence: 0.84,
    expectedValue: 0.035,
    maxDrawdown: 0.12,
    volatility: 0.18,
    recencyWeight: 0.92,
    riskLevel: 'LOW'
  };
}

function readyControl() {
  return {
    phase: 'DECISION_READY',
    nextAction: 'EVALUATE_DECISION',
    spinsUntilWarmup: 0,
    spinsUntilDecision: 0,
    cooldownRemainingSpins: 0,
    decisionWindowSize: 100,
    reason: 'Janela live pronta para avaliação determinística.'
  };
}

test('DecisionOrchestrator connects ranking to research-only live decision', () => {
  const orchestrator = new DecisionOrchestrator();
  const result = orchestrator.orchestrate({
    decisionContext: baseDecisionContext(),
    strategyCandidates: [strongCandidate()],
    sessionControl: readyControl()
  });

  assert.equal(result.success, true);
  const report = result.value;
  assert.equal(report.engineVersion, 'decision-orchestrator-v1');
  assert.equal(report.recommendedStrategy.strategyId, 'sector-alpha');
  assert.equal(report.status, 'READY_FOR_RESEARCH_SIGNAL');
  assert.equal(report.operationalGate, 'SIGNAL');
  assert.equal(report.governance.liveStakeAllowed, false);
  assert.equal(report.decision.execution.mode, 'RESEARCH_ONLY');
  assert.equal(report.decision.execution.liveStakeFraction, 0);
  assert.equal(report.ranking.eligibleCount, 1);
});

test('DecisionOrchestrator keeps observation state when live session is not ready', () => {
  const orchestrator = new DecisionOrchestrator();
  const result = orchestrator.orchestrate({
    decisionContext: baseDecisionContext(),
    strategyCandidates: [strongCandidate()],
    sessionControl: {
      ...readyControl(),
      phase: 'COLLECTING_WARMUP',
      nextAction: 'INGEST_ROUND',
      spinsUntilWarmup: 12,
      reason: 'Coletar mais 12 rodada(s) para completar o warm-up.'
    }
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'REJECTED');
  assert.equal(result.value.action, 'OBSERVE');
  assert.equal(result.value.operationalGate, 'OBSERVE');
  assert.ok(result.value.blockers.some((blocker) => blocker.includes('ainda não está pronta')));
  assert.equal(result.value.governance.liveStakeAllowed, false);
});

test('DecisionOrchestrator returns typed Result error for malformed input', () => {
  const orchestrator = new DecisionOrchestrator();
  const result = orchestrator.orchestrate({
    decisionContext: baseDecisionContext({ bankroll: -1 }),
    strategyCandidates: [strongCandidate()],
    sessionControl: readyControl()
  });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'DECISION_ORCHESTRATOR_FAILED');
  assert.match(result.error.message, /invalid_decision_bankroll/);
});


test('DecisionOrchestrator blocks research signal when regime policy blocks signals', () => {
  const orchestrator = new DecisionOrchestrator();
  const regimeResult = new RegimeClassificationEngine().classify(Array.from({ length: 140 }, (_, index) => (index < 120 ? 7 : index % 3)));
  assert.equal(regimeResult.success, true);

  const result = orchestrator.orchestrate({
    decisionContext: baseDecisionContext(),
    strategyCandidates: [strongCandidate()],
    sessionControl: readyControl(),
    regimeClassification: regimeResult.value
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'REJECTED');
  assert.equal(result.value.action, 'BLOCKED');
  assert.equal(result.value.operationalGate, 'NO_GO');
  assert.equal(result.value.regimeClassification.regime, 'CHAOTIC');
  assert.ok(result.value.blockers.some((blocker) => blocker.includes('bloqueia sinais')));
});


test('DecisionOrchestrator blocks research signal when ensemble reports strategic conflict', () => {
  const orchestrator = new DecisionOrchestrator();
  const ensembleResult = new StrategyEnsembleEngine().evaluate([
    {
      strategyId: 'alpha',
      label: 'Alpha',
      status: 'SUPPORT',
      targetId: 'sector-voisins',
      targetLabel: 'Voisins',
      confidence: 0.82,
      evidenceScore: 0.78,
      riskPenalty: 0.18,
      recencyWeight: 0.94,
      weight: 0.8
    },
    {
      strategyId: 'beta',
      label: 'Beta',
      status: 'SUPPORT',
      targetId: 'sector-voisins',
      targetLabel: 'Voisins',
      confidence: 0.8,
      evidenceScore: 0.76,
      riskPenalty: 0.2,
      recencyWeight: 0.92,
      weight: 0.78
    },
    {
      strategyId: 'delta',
      label: 'Delta',
      status: 'OPPOSE',
      targetId: 'sector-voisins',
      targetLabel: 'Voisins',
      confidence: 0.81,
      evidenceScore: 0.75,
      riskPenalty: 0.22,
      recencyWeight: 0.9,
      weight: 0.95
    },
    {
      strategyId: 'epsilon',
      label: 'Epsilon',
      status: 'OPPOSE',
      targetId: 'sector-voisins',
      targetLabel: 'Voisins',
      confidence: 0.79,
      evidenceScore: 0.72,
      riskPenalty: 0.24,
      recencyWeight: 0.9,
      weight: 0.9
    }
  ]);
  assert.equal(ensembleResult.success, true);
  assert.equal(ensembleResult.value.decision, 'CONFLICT');

  const result = orchestrator.orchestrate({
    decisionContext: baseDecisionContext(),
    strategyCandidates: [strongCandidate()],
    sessionControl: readyControl(),
    strategyEnsemble: ensembleResult.value
  });

  assert.equal(result.success, true);
  assert.equal(result.value.status, 'REJECTED');
  assert.equal(result.value.action, 'BLOCKED');
  assert.equal(result.value.operationalGate, 'NO_GO');
  assert.equal(result.value.strategyEnsemble.decision, 'CONFLICT');
  assert.ok(result.value.blockers.some((blocker) => blocker.includes('Ensemble bloqueia')));
});
