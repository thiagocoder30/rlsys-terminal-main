'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OUTCOMES,
  CORRELATION_DECISIONS,
  OutcomeCorrelationEngine,
} = require('../../../src/domain/learning/OutcomeCorrelationEngine');

function createCorrelatedObservations() {
  return [
    {
      id: 'obs-1',
      contextId: 'ctx-1',
      strategyId: 'fusion',
      outcome: OUTCOMES.PAPER_LOSS,
      factors: {
        consensus: 0.2,
        volatility: 0.9,
        operatorReadiness: 0.2,
      },
    },
    {
      id: 'obs-2',
      contextId: 'ctx-2',
      strategyId: 'fusion',
      outcome: OUTCOMES.PAPER_NEUTRAL,
      factors: {
        consensus: 0.5,
        volatility: 0.5,
        operatorReadiness: 0.5,
      },
    },
    {
      id: 'obs-3',
      contextId: 'ctx-3',
      strategyId: 'fusion',
      outcome: OUTCOMES.PAPER_WIN,
      factors: {
        consensus: 0.9,
        volatility: 0.1,
        operatorReadiness: 0.85,
      },
    },
  ];
}

function createModerateObservations() {
  return [
    {
      id: 'mod-1',
      contextId: 'ctx-mod-1',
      strategyId: 'fusion',
      outcome: OUTCOMES.PAPER_LOSS,
      factors: {
        consensus: 0.2,
      },
    },
    {
      id: 'mod-2',
      contextId: 'ctx-mod-2',
      strategyId: 'fusion',
      outcome: OUTCOMES.PAPER_WIN,
      factors: {
        consensus: 0.7,
      },
    },
    {
      id: 'mod-3',
      contextId: 'ctx-mod-3',
      strategyId: 'fusion',
      outcome: OUTCOMES.PAPER_NEUTRAL,
      factors: {
        consensus: 0.4,
      },
    },
    {
      id: 'mod-4',
      contextId: 'ctx-mod-4',
      strategyId: 'fusion',
      outcome: OUTCOMES.PAPER_NEUTRAL,
      factors: {
        consensus: 0.8,
      },
    },
  ];
}

test('creates strong outcome correlation analysis with deterministic checksum', () => {
  const engine = new OutcomeCorrelationEngine();

  const input = {
    sessionId: 'session-238',
    observations: createCorrelatedObservations(),
  };

  const first = engine.analyze(input);
  const second = engine.analyze(input);

  assert.equal(first.decision, CORRELATION_DECISIONS.CORRELATION_READY);
  assert.equal(first.observationCount, 3);
  assert.ok(first.strongestCorrelation >= 0.55);
  assert.equal(first.checksum, second.checksum);
  assert.equal(first.checksum.length, 64);
});

test('detects positive and negative factor directions', () => {
  const engine = new OutcomeCorrelationEngine();

  const result = engine.analyze({
    sessionId: 'session-238',
    observations: createCorrelatedObservations(),
  });

  const consensus = result.factors.find((factor) => factor.factorName === 'consensus');
  const volatility = result.factors.find((factor) => factor.factorName === 'volatility');

  assert.equal(consensus.direction, 'POSITIVE');
  assert.equal(volatility.direction, 'NEGATIVE');
});

test('deduplicates observations by id preserving first occurrence', () => {
  const engine = new OutcomeCorrelationEngine();
  const observations = createCorrelatedObservations();

  observations.push({
    id: 'obs-1',
    contextId: 'ctx-duplicate',
    strategyId: 'triplicacao',
    outcome: OUTCOMES.PAPER_WIN,
    factors: {
      consensus: 1,
      volatility: 0,
      operatorReadiness: 1,
    },
  });

  const result = engine.analyze({
    sessionId: 'session-238',
    observations,
  });

  assert.equal(result.observationCount, 3);
});

test('blocks analysis when observations are insufficient', () => {
  const engine = new OutcomeCorrelationEngine();

  const result = engine.analyze({
    sessionId: 'session-238',
    observations: createCorrelatedObservations().slice(0, 1),
  });

  assert.equal(result.decision, CORRELATION_DECISIONS.INSUFFICIENT_CORRELATION);
  assert.ok(result.blockers.includes('INSUFFICIENT_OUTCOME_OBSERVATIONS'));
});

test('returns observe when correlation is reliable but not strong', () => {
  const engine = new OutcomeCorrelationEngine({
    minimumObservationCount: 3,
    minimumFactorSupport: 2,
    minimumReliableCorrelation: 0.1,
    strongCorrelation: 0.95,
    maximumFactors: 8,
  });

  const result = engine.analyze({
    sessionId: 'session-238',
    observations: createModerateObservations(),
  });

  assert.equal(result.decision, CORRELATION_DECISIONS.OBSERVE_CORRELATION);
  assert.equal(result.blockers.length, 0);
  assert.ok(result.strongestCorrelation >= 0.1);
  assert.ok(result.strongestCorrelation < 0.95);
});

test('limits returned factor list according to maximumFactors', () => {
  const engine = new OutcomeCorrelationEngine({
    maximumFactors: 1,
  });

  const result = engine.analyze({
    sessionId: 'session-238',
    observations: createCorrelatedObservations(),
  });

  assert.equal(result.factorCount, 1);
  assert.equal(result.factors.length, 1);
});

test('enforces permanent institutional safety flags', () => {
  const engine = new OutcomeCorrelationEngine();

  const result = engine.analyze({
    sessionId: 'session-238',
    observations: createCorrelatedObservations(),
  });

  assert.equal(result.institutionalFlags.paperOnly, true);
  assert.equal(result.institutionalFlags.productionMoneyAllowed, false);
  assert.equal(result.institutionalFlags.liveMoneyAuthorization, false);
  assert.equal(result.institutionalFlags.automaticExecutionAllowed, false);
  assert.equal(result.institutionalFlags.humanSupervisionRequired, true);
});

test('validates factor unit ranges', () => {
  const engine = new OutcomeCorrelationEngine();
  const observations = createCorrelatedObservations();

  observations[0].factors.consensus = 1.2;

  assert.throws(
    () => engine.analyze({
      sessionId: 'session-238',
      observations,
    }),
    /observations\[0\]\.factors\.consensus must be between 0 and 1/
  );
});

test('validates unsupported outcome', () => {
  const engine = new OutcomeCorrelationEngine();
  const observations = createCorrelatedObservations();

  observations[0].outcome = 'LIVE_MONEY_WIN';

  assert.throws(
    () => engine.analyze({
      sessionId: 'session-238',
      observations,
    }),
    /outcome is not supported/
  );
});

test('validates threshold ordering', () => {
  assert.throws(
    () => new OutcomeCorrelationEngine({
      minimumReliableCorrelation: 0.8,
      strongCorrelation: 0.6,
    }),
    /thresholds\.minimumReliableCorrelation must be less than or equal to thresholds\.strongCorrelation/
  );
});
