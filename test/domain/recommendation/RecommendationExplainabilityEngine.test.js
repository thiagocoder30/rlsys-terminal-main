'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  EXPLAINABILITY_LEVELS,
  SUPPORTED_DECISIONS,
  RecommendationExplainabilityEngine,
} = require('../../../src/domain/recommendation/RecommendationExplainabilityEngine');

function createInput() {
  return {
    sessionId: 'session-242',
    tableId: 'table-alpha',
    strategyId: 'fusion',
    decision: SUPPORTED_DECISIONS.PAPER_FAVORAVEL,
    recommendationScore: 0.84,
    factors: [
      { factorName: 'graphConfidence', value: 0.86, weight: 0.16, contribution: 0.1376 },
      { factorName: 'contextSimilarity', value: 0.84, weight: 0.16, contribution: 0.1344 },
      { factorName: 'outcomeCorrelation', value: 0.82, weight: 0.18, contribution: 0.1476 },
      { factorName: 'learningStability', value: 0.85, weight: 0.16, contribution: 0.136 },
      { factorName: 'riskControl', value: 0.9, weight: 0.08, contribution: 0.072 },
    ],
    blockers: [],
    evidence: [
      { id: 'ev-1', source: 'knowledge-graph', label: 'Graph confidence ready', confidence: 0.86 },
      { id: 'ev-2', source: 'context-similarity', label: 'Similar context found', confidence: 0.84 },
      { id: 'ev-3', source: 'outcome-correlation', label: 'Outcome correlation ready', confidence: 0.82 },
    ],
  };
}

test('creates favorable explanation with deterministic checksum', () => {
  const engine = new RecommendationExplainabilityEngine();

  const first = engine.explain(createInput());
  const second = engine.explain(createInput());

  assert.equal(first.explainabilityLevel, EXPLAINABILITY_LEVELS.FAVORABLE);
  assert.equal(first.decision, SUPPORTED_DECISIONS.PAPER_FAVORAVEL);
  assert.equal(first.narrative.operatorAction, 'Operador pode avaliar manualmente a estratégia indicada em modo PAPER.');
  assert.equal(first.checksum, second.checksum);
  assert.equal(first.checksum.length, 64);
});

test('creates observation explanation for moderate context', () => {
  const engine = new RecommendationExplainabilityEngine();
  const input = createInput();

  input.decision = SUPPORTED_DECISIONS.OBSERVAR;
  input.recommendationScore = 0.61;

  const result = engine.explain(input);

  assert.equal(result.explainabilityLevel, EXPLAINABILITY_LEVELS.OBSERVATION);
  assert.equal(result.narrative.title, 'Contexto exige observação institucional.');
});

test('creates blocked explanation when blockers exist', () => {
  const engine = new RecommendationExplainabilityEngine();
  const input = createInput();

  input.decision = SUPPORTED_DECISIONS.NAO_UTILIZAR;
  input.recommendationScore = 0.72;
  input.blockers = [
    'RISK_CONTROL_BELOW_OBSERVATION_THRESHOLD',
  ];

  const result = engine.explain(input);

  assert.equal(result.explainabilityLevel, EXPLAINABILITY_LEVELS.BLOCKED);
  assert.equal(result.narrative.topReason, 'RISK_CONTROL_BELOW_OBSERVATION_THRESHOLD');
});

test('ranks strongest factors by contribution', () => {
  const engine = new RecommendationExplainabilityEngine();
  const result = engine.explain(createInput());

  assert.equal(result.strongestFactors[0].factorName, 'outcomeCorrelation');
});

test('deduplicates evidence by id preserving first occurrence', () => {
  const engine = new RecommendationExplainabilityEngine();
  const input = createInput();

  input.evidence.push({
    id: 'ev-1',
    source: 'duplicate',
    label: 'Duplicate should not override',
    confidence: 0.1,
  });

  const result = engine.explain(input);
  const evidence = result.evidence.find((item) => item.id === 'ev-1');

  assert.equal(result.evidenceCount, 3);
  assert.equal(evidence.source, 'knowledge-graph');
});

test('deduplicates blockers deterministically', () => {
  const engine = new RecommendationExplainabilityEngine();
  const input = createInput();

  input.blockers = [
    'LOW_RECOMMENDATION_EVIDENCE_CONFIDENCE',
    'RISK_CONTROL_BELOW_OBSERVATION_THRESHOLD',
    'LOW_RECOMMENDATION_EVIDENCE_CONFIDENCE',
  ];

  const result = engine.explain(input);

  assert.deepEqual(result.blockers, [
    'LOW_RECOMMENDATION_EVIDENCE_CONFIDENCE',
    'RISK_CONTROL_BELOW_OBSERVATION_THRESHOLD',
  ]);
});

test('limits strongest factors according to threshold', () => {
  const engine = new RecommendationExplainabilityEngine({
    maximumFactors: 2,
  });

  const result = engine.explain(createInput());

  assert.equal(result.strongestFactors.length, 2);
});

test('enforces permanent institutional safety flags', () => {
  const engine = new RecommendationExplainabilityEngine();
  const result = engine.explain(createInput());

  assert.equal(result.advisoryOnly, true);
  assert.equal(result.institutionalFlags.paperOnly, true);
  assert.equal(result.institutionalFlags.productionMoneyAllowed, false);
  assert.equal(result.institutionalFlags.liveMoneyAuthorization, false);
  assert.equal(result.institutionalFlags.automaticExecutionAllowed, false);
  assert.equal(result.institutionalFlags.humanSupervisionRequired, true);
});

test('validates unsupported decision', () => {
  const engine = new RecommendationExplainabilityEngine();
  const input = createInput();

  input.decision = 'AUTO_BET';

  assert.throws(
    () => engine.explain(input),
    /input\.decision is not supported/
  );
});

test('validates recommendation score range', () => {
  const engine = new RecommendationExplainabilityEngine();
  const input = createInput();

  input.recommendationScore = 1.2;

  assert.throws(
    () => engine.explain(input),
    /input\.recommendationScore must be between 0 and 1/
  );
});
