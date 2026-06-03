'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SIMILARITY_DECISIONS,
  ContextSimilarityEngineV2,
} = require('../../../src/domain/learning/ContextSimilarityEngineV2');

function createCurrentContext() {
  return {
    id: 'current-context',
    tableId: 'table-alpha',
    strategyId: 'fusion',
    graphConfidence: 0.86,
    consensusScore: 0.84,
    riskScore: 0.82,
    operatorScore: 0.88,
    features: {
      momentum: 0.82,
      volatility: 0.28,
      sectorPressure: 0.74,
      biasCluster: 0.78,
    },
    signals: [
      'CONTROLLED_RISK',
      'HIGH_CONSENSUS',
      'FUSION_ACTIVE',
    ],
  };
}

function createHistoricalContexts() {
  return [
    {
      id: 'historical-strong',
      tableId: 'table-alpha',
      strategyId: 'fusion',
      graphConfidence: 0.85,
      consensusScore: 0.83,
      riskScore: 0.8,
      operatorScore: 0.87,
      features: {
        momentum: 0.81,
        volatility: 0.3,
        sectorPressure: 0.72,
        biasCluster: 0.76,
      },
      signals: [
        'CONTROLLED_RISK',
        'HIGH_CONSENSUS',
        'FUSION_ACTIVE',
      ],
    },
    {
      id: 'historical-weak',
      tableId: 'table-beta',
      strategyId: 'triplicacao',
      graphConfidence: 0.32,
      consensusScore: 0.35,
      riskScore: 0.3,
      operatorScore: 0.4,
      features: {
        momentum: 0.2,
        volatility: 0.9,
        sectorPressure: 0.22,
        biasCluster: 0.18,
      },
      signals: [
        'HIGH_VOLATILITY',
        'LOW_CONSENSUS',
      ],
    },
  ];
}

test('finds strong similar context with deterministic checksum', () => {
  const engine = new ContextSimilarityEngineV2();

  const input = {
    sessionId: 'session-237',
    currentContext: createCurrentContext(),
    historicalContexts: createHistoricalContexts(),
  };

  const first = engine.evaluate(input);
  const second = engine.evaluate(input);

  assert.equal(first.decision, SIMILARITY_DECISIONS.SIMILAR_CONTEXT_FOUND);
  assert.equal(first.candidateCount, 2);
  assert.equal(first.matches[0].contextId, 'historical-strong');
  assert.equal(first.checksum, second.checksum);
  assert.equal(first.checksum.length, 64);
});

test('deduplicates historical contexts by id preserving first occurrence', () => {
  const engine = new ContextSimilarityEngineV2();
  const historicalContexts = createHistoricalContexts();

  historicalContexts.push({
    id: 'historical-strong',
    tableId: 'table-duplicate',
    strategyId: 'triplicacao',
    graphConfidence: 0.1,
    consensusScore: 0.1,
    riskScore: 0.1,
    operatorScore: 0.1,
    features: {
      momentum: 0.1,
    },
    signals: [
      'DUPLICATE',
    ],
  });

  const result = engine.evaluate({
    sessionId: 'session-237',
    currentContext: createCurrentContext(),
    historicalContexts,
  });

  assert.equal(result.candidateCount, 2);
  assert.equal(result.matches[0].contextId, 'historical-strong');
  assert.equal(result.matches[0].tableId, 'table-alpha');
});

test('excludes current context from candidate list', () => {
  const engine = new ContextSimilarityEngineV2();
  const currentContext = createCurrentContext();
  const historicalContexts = createHistoricalContexts();

  historicalContexts.push(Object.assign({}, currentContext));

  const result = engine.evaluate({
    sessionId: 'session-237',
    currentContext,
    historicalContexts,
  });

  assert.equal(result.candidateCount, 2);
});

test('returns no reliable context when history is empty', () => {
  const engine = new ContextSimilarityEngineV2();

  const result = engine.evaluate({
    sessionId: 'session-237',
    currentContext: createCurrentContext(),
    historicalContexts: [],
  });

  assert.equal(result.decision, SIMILARITY_DECISIONS.NO_RELIABLE_CONTEXT);
  assert.ok(result.blockers.includes('INSUFFICIENT_HISTORICAL_CONTEXTS'));
});

test('returns observe when context is valid but below strong similarity', () => {
  const engine = new ContextSimilarityEngineV2({
    minimumReliableSimilarity: 0.3,
    strongSimilarity: 0.95,
    minimumCandidateCount: 1,
    maximumResults: 5,
  });

  const result = engine.evaluate({
    sessionId: 'session-237',
    currentContext: createCurrentContext(),
    historicalContexts: createHistoricalContexts(),
  });

  assert.equal(result.decision, SIMILARITY_DECISIONS.OBSERVE_CONTEXT);
});

test('limits returned matches according to maximumResults', () => {
  const engine = new ContextSimilarityEngineV2({
    maximumResults: 1,
  });

  const result = engine.evaluate({
    sessionId: 'session-237',
    currentContext: createCurrentContext(),
    historicalContexts: createHistoricalContexts(),
  });

  assert.equal(result.returnedMatches, 1);
  assert.equal(result.matches.length, 1);
});

test('enforces permanent institutional safety flags', () => {
  const engine = new ContextSimilarityEngineV2();

  const result = engine.evaluate({
    sessionId: 'session-237',
    currentContext: createCurrentContext(),
    historicalContexts: createHistoricalContexts(),
  });

  assert.equal(result.institutionalFlags.paperOnly, true);
  assert.equal(result.institutionalFlags.productionMoneyAllowed, false);
  assert.equal(result.institutionalFlags.liveMoneyAuthorization, false);
  assert.equal(result.institutionalFlags.automaticExecutionAllowed, false);
  assert.equal(result.institutionalFlags.humanSupervisionRequired, true);
});

test('validates feature unit ranges', () => {
  const engine = new ContextSimilarityEngineV2();
  const currentContext = createCurrentContext();

  currentContext.features.momentum = 1.2;

  assert.throws(
    () => engine.evaluate({
      sessionId: 'session-237',
      currentContext,
      historicalContexts: createHistoricalContexts(),
    }),
    /input\.currentContext\.features\.momentum must be between 0 and 1/
  );
});

test('validates threshold ordering', () => {
  assert.throws(
    () => new ContextSimilarityEngineV2({
      minimumReliableSimilarity: 0.9,
      strongSimilarity: 0.7,
    }),
    /thresholds\.minimumReliableSimilarity must be less than or equal to thresholds\.strongSimilarity/
  );
});

test('uses deterministic ranking tie-break by context id', () => {
  const engine = new ContextSimilarityEngineV2();
  const currentContext = createCurrentContext();

  const candidateA = Object.assign({}, currentContext, { id: 'candidate-a' });
  const candidateB = Object.assign({}, currentContext, { id: 'candidate-b' });

  const result = engine.evaluate({
    sessionId: 'session-237',
    currentContext,
    historicalContexts: [
      candidateB,
      candidateA,
    ],
  });

  assert.equal(result.matches[0].contextId, 'candidate-a');
  assert.equal(result.matches[1].contextId, 'candidate-b');
});
