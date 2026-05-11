const assert = require('node:assert/strict');
const test = require('node:test');
const { DecisionOrchestrator } = require('../dist/domain/decision/DecisionOrchestrator');
const { ExplainabilityEngine } = require('../dist/domain/explainability/ExplainabilityEngine');

function baseDecisionContext(overrides = {}) {
  return {
    sessionId: 'session-explainability',
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

function orchestratedReport(overrides = {}) {
  const orchestrator = new DecisionOrchestrator();
  const result = orchestrator.orchestrate({
    decisionContext: baseDecisionContext(overrides.decisionContext),
    strategyCandidates: overrides.strategyCandidates ?? [strongCandidate()],
    sessionControl: overrides.sessionControl ?? readyControl(),
    regimeClassification: overrides.regimeClassification,
    strategyEnsemble: overrides.strategyEnsemble,
    temporalDecay: overrides.temporalDecay,
    adaptiveConfidence: overrides.adaptiveConfidence
  });

  assert.equal(result.success, true);
  return result.value;
}

test('ExplainabilityEngine generates deterministic audit narrative for research signal', () => {
  const engine = new ExplainabilityEngine();
  const decisionReport = orchestratedReport();

  const first = engine.explain({ decisionReport });
  const second = engine.explain({ decisionReport });

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(first.value.explanationId, second.value.explanationId);
  assert.equal(first.value.checksum, second.value.checksum);
  assert.equal(first.value.decisionStatus, 'READY_FOR_RESEARCH_SIGNAL');
  assert.equal(first.value.recommendedStrategy.strategyId, 'sector-alpha');
  assert.match(first.value.executiveSummary, /Hipótese research-only pronta/);
  assert.match(first.value.auditNarrative, /Execução real permanece RESEARCH_ONLY/);
  assert.ok(first.value.moduleSummaries.some((summary) => summary.module === 'RANKING' && summary.status === 'CLEAR'));
});

test('ExplainabilityEngine surfaces blockers as primary reason for rejected decisions', () => {
  const engine = new ExplainabilityEngine();
  const decisionReport = orchestratedReport({
    sessionControl: {
      ...readyControl(),
      phase: 'COOLDOWN',
      nextAction: 'WAIT_COOLDOWN',
      cooldownRemainingSpins: 3,
      reason: 'Cooldown após concentração anormal na janela live.'
    }
  });

  const result = engine.explain({ decisionReport, maxEvidenceItems: 4 });

  assert.equal(result.success, true);
  assert.equal(result.value.decisionStatus, 'REJECTED');
  assert.equal(result.value.evidence.length <= 4, true);
  assert.equal(result.value.evidence[0].severity, 'BLOCKER');
  assert.equal(result.value.evidence[0].module, 'SESSION');
  assert.match(result.value.primaryReason, /cooldown/i);
  assert.match(result.value.executiveSummary, /Decisão rejeitada/);
});

test('ExplainabilityEngine bounds evidence list for low-memory operator UI', () => {
  const engine = new ExplainabilityEngine();
  const decisionReport = {
    ...orchestratedReport(),
    blockers: ['Regime CHAOTIC bloqueia sinais', 'Ensemble bloqueia sinal por conflito estratégico'],
    warnings: ['Aviso 1', 'Aviso 2', 'Aviso 3', 'Aviso 4']
  };

  const result = engine.explain({ decisionReport, maxEvidenceItems: 3 });

  assert.equal(result.success, true);
  assert.equal(result.value.evidence.length, 3);
  assert.deepEqual(result.value.evidence.map((item) => item.severity), ['BLOCKER', 'BLOCKER', 'WARNING']);
  assert.match(result.value.checksum, /^[a-f0-9]{64}$/);
});

test('ExplainabilityEngine rejects malformed input without silent failure', () => {
  const engine = new ExplainabilityEngine();
  const result = engine.explain({ decisionReport: { sessionId: '', blockers: 'bad', warnings: [] }, maxEvidenceItems: 0 });

  assert.equal(result.success, false);
  assert.equal(result.error.code, 'EXPLAINABILITY_FAILED');
  assert.match(result.error.message, /invalid_explainability/);
});
