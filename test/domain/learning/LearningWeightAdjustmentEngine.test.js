'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ADJUSTMENT_DECISIONS,
  LearningWeightAdjustmentEngine,
} = require('../../../src/domain/learning/LearningWeightAdjustmentEngine');

function createWeights() {
  return {
    consensus: 0.3,
    similarity: 0.25,
    outcomeCorrelation: 0.25,
    operatorReadiness: 0.2,
  };
}

function createEvidence() {
  return [
    {
      id: 'ev-1',
      factorName: 'consensus',
      direction: 'INCREASE',
      confidence: 0.9,
      strength: 0.8,
    },
    {
      id: 'ev-2',
      factorName: 'outcomeCorrelation',
      direction: 'INCREASE',
      confidence: 0.85,
      strength: 0.75,
    },
    {
      id: 'ev-3',
      factorName: 'operatorReadiness',
      direction: 'DECREASE',
      confidence: 0.8,
      strength: 0.6,
    },
  ];
}

function sumWeights(weights) {
  return Object.keys(weights).reduce((total, key) => total + weights[key], 0);
}

test('adjusts learning weights with deterministic checksum', () => {
  const engine = new LearningWeightAdjustmentEngine();

  const input = {
    sessionId: 'session-239',
    currentWeights: createWeights(),
    evidence: createEvidence(),
  };

  const first = engine.adjust(input);
  const second = engine.adjust(input);

  assert.equal(first.decision, ADJUSTMENT_DECISIONS.WEIGHTS_ADJUSTED);
  assert.equal(first.evidenceCount, 3);
  assert.ok(first.adjustedWeights.consensus > first.currentWeights.consensus);
  assert.ok(first.adjustedWeights.operatorReadiness < first.currentWeights.operatorReadiness);
  assert.equal(Number(sumWeights(first.adjustedWeights).toFixed(6)), 1);
  assert.equal(first.checksum, second.checksum);
  assert.equal(first.checksum.length, 64);
});

test('blocks adjustment when evidence is insufficient', () => {
  const engine = new LearningWeightAdjustmentEngine();

  const result = engine.adjust({
    sessionId: 'session-239',
    currentWeights: createWeights(),
    evidence: createEvidence().slice(0, 1),
  });

  assert.equal(result.decision, ADJUSTMENT_DECISIONS.ADJUSTMENT_BLOCKED);
  assert.ok(result.blockers.includes('INSUFFICIENT_LEARNING_EVIDENCE'));
});

test('blocks adjustment when evidence confidence is low', () => {
  const engine = new LearningWeightAdjustmentEngine();

  const result = engine.adjust({
    sessionId: 'session-239',
    currentWeights: createWeights(),
    evidence: [
      {
        id: 'ev-low-1',
        factorName: 'consensus',
        direction: 'INCREASE',
        confidence: 0.2,
        strength: 0.8,
      },
      {
        id: 'ev-low-2',
        factorName: 'similarity',
        direction: 'INCREASE',
        confidence: 0.3,
        strength: 0.7,
      },
    ],
  });

  assert.equal(result.decision, ADJUSTMENT_DECISIONS.ADJUSTMENT_BLOCKED);
  assert.ok(result.blockers.includes('LOW_LEARNING_EVIDENCE_CONFIDENCE'));
});

test('returns observe when evidence only requests hold', () => {
  const engine = new LearningWeightAdjustmentEngine();

  const result = engine.adjust({
    sessionId: 'session-239',
    currentWeights: createWeights(),
    evidence: [
      {
        id: 'ev-hold-1',
        factorName: 'consensus',
        direction: 'HOLD',
        confidence: 0.9,
        strength: 0.8,
      },
      {
        id: 'ev-hold-2',
        factorName: 'similarity',
        direction: 'HOLD',
        confidence: 0.85,
        strength: 0.8,
      },
    ],
  });

  assert.equal(result.decision, ADJUSTMENT_DECISIONS.OBSERVE_WEIGHTS);
  assert.equal(result.adjustmentPlan.length, 0);
});

test('deduplicates evidence by id preserving first occurrence', () => {
  const engine = new LearningWeightAdjustmentEngine();
  const evidence = createEvidence();

  evidence.push({
    id: 'ev-1',
    factorName: 'consensus',
    direction: 'DECREASE',
    confidence: 1,
    strength: 1,
  });

  const result = engine.adjust({
    sessionId: 'session-239',
    currentWeights: createWeights(),
    evidence,
  });

  assert.equal(result.evidenceCount, 3);
  assert.ok(result.adjustedWeights.consensus > result.currentWeights.consensus);
});

test('ignores evidence for unknown factors safely', () => {
  const engine = new LearningWeightAdjustmentEngine();

  const result = engine.adjust({
    sessionId: 'session-239',
    currentWeights: createWeights(),
    evidence: [
      ...createEvidence(),
      {
        id: 'ev-unknown',
        factorName: 'unknownFactor',
        direction: 'INCREASE',
        confidence: 0.9,
        strength: 0.9,
      },
    ],
  });

  assert.equal(result.evidenceCount, 4);
  assert.equal(
    Object.prototype.hasOwnProperty.call(result.adjustedWeights, 'unknownFactor'),
    false
  );
});

test('enforces permanent institutional safety flags', () => {
  const engine = new LearningWeightAdjustmentEngine();

  const result = engine.adjust({
    sessionId: 'session-239',
    currentWeights: createWeights(),
    evidence: createEvidence(),
  });

  assert.equal(result.institutionalFlags.paperOnly, true);
  assert.equal(result.institutionalFlags.productionMoneyAllowed, false);
  assert.equal(result.institutionalFlags.liveMoneyAuthorization, false);
  assert.equal(result.institutionalFlags.automaticExecutionAllowed, false);
  assert.equal(result.institutionalFlags.humanSupervisionRequired, true);
});

test('validates unsupported adjustment direction', () => {
  const engine = new LearningWeightAdjustmentEngine();

  assert.throws(
    () => engine.adjust({
      sessionId: 'session-239',
      currentWeights: createWeights(),
      evidence: [
        {
          id: 'ev-bad',
          factorName: 'consensus',
          direction: 'BOOST',
          confidence: 0.9,
          strength: 0.8,
        },
      ],
    }),
    /evidence\[0\]\.direction is not supported/
  );
});

test('validates weight ranges', () => {
  const engine = new LearningWeightAdjustmentEngine();
  const weights = createWeights();

  weights.consensus = 1.2;

  assert.throws(
    () => engine.adjust({
      sessionId: 'session-239',
      currentWeights: weights,
      evidence: createEvidence(),
    }),
    /input\.currentWeights\.consensus must be between 0 and 1/
  );
});

test('validates threshold consistency', () => {
  assert.throws(
    () => new LearningWeightAdjustmentEngine({
      adjustmentStep: 0.2,
      maximumAdjustmentPerCycle: 0.1,
    }),
    /thresholds\.adjustmentStep must be less than or equal to thresholds\.maximumAdjustmentPerCycle/
  );
});
