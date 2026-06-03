import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LearningConfidenceValidationEngine,
  type LearningConfidenceValidationSample,
} from '../../../src/domain/learning-confidence-validation/learning-confidence-validation-engine';

const trustedSamples: readonly LearningConfidenceValidationSample[] = [
  {
    sampleId: 'sample-001',
    learningKey: 'fusion:table-alpha:low-volatility',
    occurredAtEpochMs: 1000,
    memoryScore: 0.84,
    patternScore: 0.86,
    correlationScore: 0.84,
    similarityScore: 0.88,
    adjustedWeightScore: 0.82,
    outcomeScore: 0.84,
    riskScore: 0.18,
    operatorScore: 0.9,
    blocked: false,
  },
  {
    sampleId: 'sample-002',
    learningKey: 'fusion:table-alpha:low-volatility',
    occurredAtEpochMs: 2000,
    memoryScore: 0.82,
    patternScore: 0.84,
    correlationScore: 0.82,
    similarityScore: 0.86,
    adjustedWeightScore: 0.8,
    outcomeScore: 0.82,
    riskScore: 0.2,
    operatorScore: 0.88,
    blocked: false,
  },
  {
    sampleId: 'sample-003',
    learningKey: 'fusion:table-alpha:low-volatility',
    occurredAtEpochMs: 3000,
    memoryScore: 0.86,
    patternScore: 0.88,
    correlationScore: 0.86,
    similarityScore: 0.9,
    adjustedWeightScore: 0.84,
    outcomeScore: 0.86,
    riskScore: 0.16,
    operatorScore: 0.92,
    blocked: false,
  },
  {
    sampleId: 'sample-004',
    learningKey: 'fusion:table-alpha:low-volatility',
    occurredAtEpochMs: 4000,
    memoryScore: 0.83,
    patternScore: 0.85,
    correlationScore: 0.83,
    similarityScore: 0.87,
    adjustedWeightScore: 0.81,
    outcomeScore: 0.83,
    riskScore: 0.19,
    operatorScore: 0.89,
    blocked: false,
  },
  {
    sampleId: 'sample-005',
    learningKey: 'fusion:table-alpha:low-volatility',
    occurredAtEpochMs: 5000,
    memoryScore: 0.85,
    patternScore: 0.87,
    correlationScore: 0.85,
    similarityScore: 0.89,
    adjustedWeightScore: 0.83,
    outcomeScore: 0.85,
    riskScore: 0.17,
    operatorScore: 0.91,
    blocked: false,
  },
];

describe('LearningConfidenceValidationEngine', () => {
  it('trusts recurring low-variance supportive learning', () => {
    const engine = new LearningConfidenceValidationEngine();
    const result = engine.validateLearning(
      'fusion:table-alpha:low-volatility',
      trustedSamples,
    );

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'LEARNING_TRUSTED');
      assert.equal(result.value.productionMoneyAllowed, false);
      assert.equal(result.value.liveMoneyAuthorization, false);
      assert.equal(result.value.paperOnly, true);
      assert.ok(result.value.reasons.includes('POSITIVE_VALIDATED_LEARNING'));
    }
  });

  it('keeps low evidence learning uncertain', () => {
    const engine = new LearningConfidenceValidationEngine();
    const result = engine.validateLearning(
      'fusion:table-alpha:low-volatility',
      [trustedSamples[0]],
    );

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'LEARNING_UNCERTAIN');
      assert.ok(result.value.reasons.includes('LOW_EVIDENCE_VOLUME'));
    }
  });

  it('keeps low recurrence learning uncertain', () => {
    const engine = new LearningConfidenceValidationEngine();
    const result = engine.validateLearning(
      'fusion:table-alpha:low-volatility',
      [
        ...trustedSamples.slice(0, 2),
        {
          ...trustedSamples[2],
          learningKey: 'other-context',
        },
        {
          ...trustedSamples[3],
          learningKey: 'other-context',
        },
        {
          ...trustedSamples[4],
          learningKey: 'other-context',
        },
      ],
    );

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'LEARNING_UNCERTAIN');
      assert.ok(result.value.reasons.includes('LOW_RECURRENCE'));
    }
  });

  it('blocks learning when block rate is excessive', () => {
    const engine = new LearningConfidenceValidationEngine();
    const result = engine.validateLearning(
      'fusion:table-alpha:low-volatility',
      trustedSamples.map((sample, index) => ({
        ...sample,
        blocked: index < 3,
      })),
    );

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'LEARNING_BLOCKED');
      assert.ok(result.value.reasons.includes('EXCESSIVE_BLOCK_RATE'));
      assert.ok(result.value.reasons.includes('DEFENSIVE_LEARNING_BLOCK'));
    }
  });

  it('rejects weak learning evidence', () => {
    const engine = new LearningConfidenceValidationEngine();
    const result = engine.validateLearning(
      'fusion:table-alpha:low-volatility',
      trustedSamples.map((sample) => ({
        ...sample,
        memoryScore: 0.2,
        patternScore: 0.2,
        correlationScore: 0.2,
        similarityScore: 0.2,
        adjustedWeightScore: 0.2,
        outcomeScore: 0.2,
        riskScore: 0.4,
        operatorScore: 0.7,
      })),
    );

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.status, 'LEARNING_REJECTED');
      assert.ok(result.value.reasons.includes('NEGATIVE_VALIDATED_LEARNING'));
    }
  });

  it('rejects invalid learning samples through Result', () => {
    const engine = new LearningConfidenceValidationEngine();
    const result = engine.validateLearning(
      'fusion:table-alpha:low-volatility',
      [
        {
          ...trustedSamples[0],
          memoryScore: 1.5,
        },
      ],
    );

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(
        result.error.code,
        'INVALID_LEARNING_CONFIDENCE_VALIDATION_INPUT',
      );
    }
  });
});
