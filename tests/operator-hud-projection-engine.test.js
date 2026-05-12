const assert = require('node:assert/strict');
const test = require('node:test');
const { DecisionOrchestrator } = require('../dist/domain/decision/DecisionOrchestrator');
const { ExplainabilityEngine } = require('../dist/domain/explainability/ExplainabilityEngine');
const { OperatorHudProjectionEngine } = require('../dist/domain/operator/OperatorHudProjectionEngine');
const { IncrementalStatisticsEngine } = require('../dist/domain/statistics/IncrementalStatisticsEngine');

function baseDecisionContext(overrides = {}) {
  return {
    sessionId: 'session-hud',
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

function candidate() {
  return {
    strategyId: 'sector-alpha',
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

function explanation(overrides = {}) {
  const orchestrator = new DecisionOrchestrator();
  const decision = orchestrator.orchestrate({
    decisionContext: baseDecisionContext(overrides.decisionContext),
    strategyCandidates: overrides.strategyCandidates ?? [candidate()],
    sessionControl: overrides.sessionControl ?? readyControl()
  });
  assert.equal(decision.success, true);
  const explainability = new ExplainabilityEngine().explain({ decisionReport: decision.value });
  assert.equal(explainability.success, true);
  return explainability.value;
}

test('OperatorHudProjectionEngine creates deterministic research-only HUD projection', () => {
  const engine = new OperatorHudProjectionEngine();
  const stats = new IncrementalStatisticsEngine({ windowSize: 16 });
  for (let index = 0; index < 16; index += 1) {
    const result = stats.ingest({ value: index % 37, eventId: `evt-${index}` });
    assert.equal(result.success, true);
  }

  const first = engine.project({ explanation: explanation(), statistics: stats.snapshot() });
  const second = engine.project({ explanation: explanation(), statistics: stats.snapshot() });

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(first.value.auditChecksum, second.value.auditChecksum);
  assert.equal(first.value.mode, 'READY_RESEARCH_ONLY');
  assert.equal(first.value.riskBand.label, 'LOW');
  assert.match(first.value.primaryAction, /sem stake real/);
  assert.ok(first.value.cards.some((card) => card.kind === 'STRATEGY'));
});

test('OperatorHudProjectionEngine surfaces blocked decisions as danger mode', () => {
  const engine = new OperatorHudProjectionEngine();
  const blocked = explanation({
    sessionControl: {
      ...readyControl(),
      phase: 'COOLDOWN',
      nextAction: 'WAIT_COOLDOWN',
      cooldownRemainingSpins: 3,
      reason: 'Cooldown ativo.'
    }
  });

  const projected = engine.project({ explanation: blocked });

  assert.equal(projected.success, true);
  assert.equal(projected.value.mode, 'BLOCKED');
  assert.equal(projected.value.riskBand.label, 'MEDIUM');
  assert.match(projected.value.headline, /Operação bloqueada/);
});

test('OperatorHudProjectionEngine bounds cards for low-memory operator UI', () => {
  const engine = new OperatorHudProjectionEngine();
  const projected = engine.project({ explanation: explanation(), maxCards: 3 });

  assert.equal(projected.success, true);
  assert.equal(projected.value.cards.length, 3);
  assert.match(projected.value.compactStatusLine, /session-hud/);
});

test('OperatorHudProjectionEngine rejects malformed input without silent failure', () => {
  const engine = new OperatorHudProjectionEngine();
  const projected = engine.project({ explanation: null });

  assert.equal(projected.success, false);
  assert.equal(projected.error.code, 'OPERATOR_HUD_PROJECTION_FAILED');
});
