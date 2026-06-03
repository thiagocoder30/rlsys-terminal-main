import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  InstitutionalRecommendationEngine,
  type InstitutionalRecommendationInput,
} from '../../../src/domain/institutional-recommendation/institutional-recommendation-engine';

const favorableInput: InstitutionalRecommendationInput = {
  recommendationId: 'recommendation-228',
  sessionId: 'paper-session-228',
  strategyId: 'fusion',
  tableId: 'table-alpha',
  readinessApproved: true,
  certificationApproved: true,
  riskApproved: true,
  operatorApproved: true,
  consensusScore: 0.86,
  calibratedConfidence: 0.84,
  strategyReputationScore: 0.82,
  tableReputationScore: 0.8,
  memoryScore: 0.84,
  similarityScore: 0.88,
  correlationScore: 0.84,
  patternScore: 0.86,
  learningWeightScore: 0.82,
  learningValidationScore: 0.84,
  learningValidationStatus: 'LEARNING_TRUSTED',
};

describe('InstitutionalRecommendationEngine', () => {
  it('recommends PAPER_FAVORAVEL only when institutional alignment is strong', () => {
    const engine = new InstitutionalRecommendationEngine();
    const result = engine.recommend(favorableInput);

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.decision, 'PAPER_FAVORAVEL');
      assert.equal(result.value.productionMoneyAllowed, false);
      assert.equal(result.value.liveMoneyAuthorization, false);
      assert.equal(result.value.paperOnly, true);
      assert.equal(result.value.defensiveBlock, false);
      assert.ok(result.value.reasons.includes('INSTITUTIONAL_ALIGNMENT_STRONG'));
    }
  });

  it('blocks when risk gate is not approved', () => {
    const engine = new InstitutionalRecommendationEngine();
    const result = engine.recommend({
      ...favorableInput,
      riskApproved: false,
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.decision, 'NAO_UTILIZAR');
      assert.equal(result.value.defensiveBlock, true);
      assert.ok(result.value.reasons.includes('RISK_BLOCKED'));
    }
  });

  it('blocks rejected learning defensively', () => {
    const engine = new InstitutionalRecommendationEngine();
    const result = engine.recommend({
      ...favorableInput,
      learningValidationStatus: 'LEARNING_REJECTED',
      learningValidationScore: 0.2,
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.decision, 'NAO_UTILIZAR');
      assert.equal(result.value.defensiveBlock, true);
      assert.ok(result.value.reasons.includes('LEARNING_REJECTED'));
    }
  });

  it('observes uncertain but non-blocking institutional context', () => {
    const engine = new InstitutionalRecommendationEngine();
    const result = engine.recommend({
      ...favorableInput,
      consensusScore: 0.58,
      calibratedConfidence: 0.58,
      strategyReputationScore: 0.56,
      tableReputationScore: 0.56,
      memoryScore: 0.58,
      similarityScore: 0.58,
      correlationScore: 0.58,
      patternScore: 0.58,
      learningWeightScore: 0.58,
      learningValidationScore: 0.58,
      learningValidationStatus: 'LEARNING_UNCERTAIN',
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.decision, 'OBSERVAR');
      assert.equal(result.value.defensiveBlock, false);
      assert.ok(result.value.reasons.includes('LEARNING_UNCERTAIN'));
    }
  });

  it('does not allow weak context to become paper favorable', () => {
    const engine = new InstitutionalRecommendationEngine();
    const result = engine.recommend({
      ...favorableInput,
      consensusScore: 0.3,
      calibratedConfidence: 0.3,
      strategyReputationScore: 0.3,
      tableReputationScore: 0.3,
      memoryScore: 0.3,
      similarityScore: 0.3,
      correlationScore: 0.3,
      patternScore: 0.3,
      learningWeightScore: 0.3,
      learningValidationScore: 0.3,
      learningValidationStatus: 'LEARNING_UNCERTAIN',
    });

    assert.equal(result.ok, true);

    if (result.ok) {
      assert.equal(result.value.decision, 'NAO_UTILIZAR');
      assert.ok(result.value.reasons.includes('INSTITUTIONAL_ALIGNMENT_WEAK'));
    }
  });

  it('rejects invalid recommendation input through Result', () => {
    const engine = new InstitutionalRecommendationEngine();
    const result = engine.recommend({
      ...favorableInput,
      calibratedConfidence: 1.5,
    });

    assert.equal(result.ok, false);

    if (!result.ok) {
      assert.equal(result.error.code, 'INVALID_INSTITUTIONAL_RECOMMENDATION_INPUT');
    }
  });
});
