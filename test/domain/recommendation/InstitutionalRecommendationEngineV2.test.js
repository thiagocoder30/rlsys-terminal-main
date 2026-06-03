'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RECOMMENDATION_DECISIONS,
  InstitutionalRecommendationEngineV2,
} = require('../../../src/domain/recommendation/InstitutionalRecommendationEngineV2');

function createReadyInput() {
  return {
    sessionId: 'session-241',
    tableId: 'table-alpha',
    strategyId: 'fusion',
    metrics: {
      graphConfidence: 0.86,
      contextSimilarity: 0.84,
      outcomeCorrelation: 0.82,
      learningStability: 0.85,
      recommendationGovernance: 0.87,
      operatorReadiness: 0.88,
      riskControl: 0.9,
    },
    evidence: [
      { id: 'ev-graph', source: 'knowledge-graph', label: 'Graph confidence ready', confidence: 0.86 },
      { id: 'ev-similarity', source: 'context-similarity', label: 'Similar context found', confidence: 0.84 },
      { id: 'ev-correlation', source: 'outcome-correlation', label: 'Outcome correlation ready', confidence: 0.82 },
      { id: 'ev-learning', source: 'learning-weight-adjustment', label: 'Learning stable', confidence: 0.85 },
      { id: 'ev-risk', source: 'risk-governance', label: 'Risk controlled', confidence: 0.9 },
    ],
  };
}

test('returns PAPER_FAVORAVEL for strong supervised institutional context', () => {
  const engine = new InstitutionalRecommendationEngineV2();

  const first = engine.evaluate(createReadyInput());
  const second = engine.evaluate(createReadyInput());

  assert.equal(first.decision, RECOMMENDATION_DECISIONS.PAPER_FAVORAVEL);
  assert.ok(first.recommendationScore >= 0.78);
  assert.equal(first.blockers.length, 0);
  assert.equal(first.checksum, second.checksum);
  assert.equal(first.checksum.length, 64);
});

test('returns OBSERVAR for moderate valid context without blockers', () => {
  const engine = new InstitutionalRecommendationEngineV2();

  const input = createReadyInput();
  input.metrics = {
    graphConfidence: 0.6,
    contextSimilarity: 0.62,
    outcomeCorrelation: 0.59,
    learningStability: 0.61,
    recommendationGovernance: 0.6,
    operatorReadiness: 0.63,
    riskControl: 0.64,
  };
  input.evidence = input.evidence.map((item) => Object.assign({}, item, { confidence: 0.7 }));

  const result = engine.evaluate(input);

  assert.equal(result.decision, RECOMMENDATION_DECISIONS.OBSERVAR);
  assert.equal(result.blockers.length, 0);
  assert.ok(result.recommendationScore >= 0.52);
  assert.ok(result.recommendationScore < 0.78);
});

test('returns NAO_UTILIZAR when defensive blockers exist', () => {
  const engine = new InstitutionalRecommendationEngineV2();

  const input = createReadyInput();
  input.metrics.riskControl = 0.3;

  const result = engine.evaluate(input);

  assert.equal(result.decision, RECOMMENDATION_DECISIONS.NAO_UTILIZAR);
  assert.ok(result.blockers.includes('RISK_CONTROL_BELOW_OBSERVATION_THRESHOLD'));
});

test('blocks when evidence count is insufficient', () => {
  const engine = new InstitutionalRecommendationEngineV2();
  const input = createReadyInput();

  input.evidence = input.evidence.slice(0, 2);

  const result = engine.evaluate(input);

  assert.equal(result.decision, RECOMMENDATION_DECISIONS.NAO_UTILIZAR);
  assert.ok(result.blockers.includes('INSUFFICIENT_RECOMMENDATION_EVIDENCE'));
});

test('blocks when evidence confidence is low', () => {
  const engine = new InstitutionalRecommendationEngineV2();
  const input = createReadyInput();

  input.evidence = input.evidence.map((item) => Object.assign({}, item, { confidence: 0.2 }));

  const result = engine.evaluate(input);

  assert.equal(result.decision, RECOMMENDATION_DECISIONS.NAO_UTILIZAR);
  assert.ok(result.blockers.includes('LOW_RECOMMENDATION_EVIDENCE_CONFIDENCE'));
});

test('deduplicates evidence by id preserving first occurrence', () => {
  const engine = new InstitutionalRecommendationEngineV2();
  const input = createReadyInput();

  input.evidence.push({
    id: 'ev-risk',
    source: 'duplicate-risk',
    label: 'Duplicate should not override',
    confidence: 0.1,
  });

  const result = engine.evaluate(input);
  const riskEvidence = result.evidence.find((item) => item.id === 'ev-risk');

  assert.equal(result.evidenceCount, 5);
  assert.equal(riskEvidence.source, 'risk-governance');
});

test('supports custom normalized unit weights deterministically', () => {
  const engine = new InstitutionalRecommendationEngineV2(
    undefined,
    {
      graphConfidence: 0.2,
      contextSimilarity: 0.2,
      outcomeCorrelation: 0.2,
      learningStability: 0.1,
      recommendationGovernance: 0.1,
      operatorReadiness: 0.1,
      riskControl: 0.1,
    }
  );

  const result = engine.evaluate(createReadyInput());

  assert.equal(Number(Object.values(result.weights).reduce((total, value) => total + value, 0).toFixed(6)), 1);
  assert.equal(result.decision, RECOMMENDATION_DECISIONS.PAPER_FAVORAVEL);
});

test('enforces permanent institutional safety flags', () => {
  const engine = new InstitutionalRecommendationEngineV2();
  const result = engine.evaluate(createReadyInput());

  assert.equal(result.institutionalFlags.paperOnly, true);
  assert.equal(result.institutionalFlags.productionMoneyAllowed, false);
  assert.equal(result.institutionalFlags.liveMoneyAuthorization, false);
  assert.equal(result.institutionalFlags.automaticExecutionAllowed, false);
  assert.equal(result.institutionalFlags.humanSupervisionRequired, true);
  assert.equal(result.explanation.advisoryOnly, true);
});

test('validates metric ranges', () => {
  const engine = new InstitutionalRecommendationEngineV2();
  const input = createReadyInput();

  input.metrics.graphConfidence = 1.2;

  assert.throws(
    () => engine.evaluate(input),
    /input\.metrics\.graphConfidence must be between 0 and 1/
  );
});

test('validates threshold ordering', () => {
  assert.throws(
    () => new InstitutionalRecommendationEngineV2({
      favorableScore: 0.5,
      observeScore: 0.7,
    }),
    /thresholds\.observeScore must be less than or equal to thresholds\.favorableScore/
  );
});
