import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LearningWeightAdjustmentEngine,
  type LearningWeightAdjustmentEvidence,
  type LearningWeightVector,
} from '../../../src/domain/learning-weight-adjustment/learning-weight-adjustment-engine';

const baseWeights: LearningWeightVector = {
  baseConfidence: 0.1,
  strategyReputation: 0.1,
  tableReputation: 0.1,
  memory: 0.1,
  similarity: 0.1,
  correlation: 0.1,
  pattern: 0.1,
  risk: 0.1,
  operator: 0.1,
  consensus: 0.1,
};

const supportiveEvidence: readonly LearningWeightAdjustmentEvidence[] = [
  {
    evidenceId: 'evidence-001',
    memoryScore: 0.84,
    similarityScore: 0.86,
    correlationScore: 0.82,
    patternScore: 0.84,
    outcomeScore: 0.82,
    riskScore: 0.2,
    operatorScore: 0.88,
    confidenceScore: 0.84,
    consensusScore: 0.86,
    blocked: false,
  },
  {
    evidenceId: 'evidence-002',
    memoryScore: 0.82,
    similarityScore: 0.84,
    correlationScore: 0.8,
    patternScore: 0.82,
    outcomeScore: 0.8,
    riskScore: 0.22,
    operatorScore: 0.86,
    confidenceScore: 0.82,
    consensusScore: 0.84,
    blocked: false,
  },
  {
    evidenceId: 'evidence-003',
    memoryScore: 0.86,
    similarityScore: 0.88,
    correlationScore: 0.84,
    patternScore: 0.86,
    outcomeScore: 0.84,
    riskScore: 0.18,
    operatorScore: 0.9,
    confidenceScore: 0.86,
    consensusScore: 0.88,
    blocked: false,
  },
];

describe('LearningWeightAdjustmentEngine', () => {
  it('adjusts weights with supportive paper learning evidence', () => {
    const engine = new LearningWeightAdjustmentEngine();
    const result = engine.adjust({
      adjustmentId: 'adjustment-226',
      baseWeights,
      evidence: supportiveEvidence,
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'WEIGHTS_SUPPORT_PAPER');
      assert.equal(result.value.productionMoneyAllowed, false);
      assert.equal(result.value.liveMoneyAuthorization, false);
      assert.equal(result.value.paperOnly, true);
      assert.ok(result.value.reasons.includes('SUPPORTIVE_LEARNING_EVIDENCE'));
      assert.ok(result.value.adjustedWeights.memory > baseWeights.memory);
      assert.ok(result.value.adjustedWeights.risk < baseWeights.risk);
    }
  });

  it('keeps low evidence neutral', () => {
    const engine = new LearningWeightAdjustmentEngine();
    const result = engine.adjust({
      adjustmentId: 'adjustment-226',
      baseWeights,
      evidence: [supportiveEvidence[0]],
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'WEIGHTS_NEUTRAL');
      assert.ok(result.value.reasons.includes('LOW_EVIDENCE'));
    }
  });

  it('blocks when risk evidence is excessive', () => {
    const engine = new LearningWeightAdjustmentEngine();
    const result = engine.adjust({
      adjustmentId: 'adjustment-226',
      baseWeights,
      evidence: supportiveEvidence.map((evidence) => ({
        ...evidence,
        riskScore: 0.9,
      })),
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'WEIGHTS_BLOCKED');
      assert.ok(result.value.reasons.includes('RISK_WEIGHT_ELEVATED'));
      assert.ok(result.value.reasons.includes('DEFENSIVE_WEIGHT_BLOCK'));
    }
  });

  it('blocks when operator evidence is weak', () => {
    const engine = new LearningWeightAdjustmentEngine();
    const result = engine.adjust({
      adjustmentId: 'adjustment-226',
      baseWeights,
      evidence: supportiveEvidence.map((evidence) => ({
        ...evidence,
        operatorScore: 0.2,
      })),
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'WEIGHTS_BLOCKED');
      assert.ok(result.value.reasons.includes('OPERATOR_WEIGHT_DEGRADED'));
    }
  });

  it('normalizes adjusted weights deterministically', () => {
    const engine = new LearningWeightAdjustmentEngine();
    const result = engine.adjust({
      adjustmentId: 'adjustment-226',
      baseWeights,
      evidence: supportiveEvidence,
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      const normalizedSum = Object.values(result.value.normalizedWeights).reduce(
        (sum, weight) => sum + weight,
        0,
      );

      assert.ok(normalizedSum > 0.999);
      assert.ok(normalizedSum < 1.001);
    }
  });

  it('rejects invalid evidence through Result', () => {
    const engine = new LearningWeightAdjustmentEngine();
    const result = engine.adjust({
      adjustmentId: 'adjustment-226',
      baseWeights,
      evidence: [
        {
          ...supportiveEvidence[0],
          memoryScore: 1.5,
        },
      ],
    });

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(
        result.error.code,
        'INVALID_LEARNING_WEIGHT_ADJUSTMENT_INPUT',
      );
    }
  });
});
