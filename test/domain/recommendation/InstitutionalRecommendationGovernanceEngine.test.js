'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RECOMMENDATIONS,
  InstitutionalRecommendationGovernanceEngine,
} = require('../../../src/domain/recommendation/InstitutionalRecommendationGovernanceEngine');

test('returns PAPER_FAVORAVEL when governance score is strong', () => {
  const engine = new InstitutionalRecommendationGovernanceEngine();

  const result = engine.evaluate({
    consensusScore: 0.90,
    reputationScore: 0.88,
    confidenceScore: 0.87,
    memoryScore: 0.85,
    operatorScore: 0.82,
    riskScore: 0.83,
  });

  assert.equal(
    result.recommendation,
    RECOMMENDATIONS.PAPER_FAVORAVEL
  );

  assert.equal(
    result.institutionalFlags.paperOnly,
    true
  );

  assert.equal(
    result.institutionalFlags.liveMoneyAuthorization,
    false
  );
});

test('returns NAO_UTILIZAR when score is weak', () => {
  const engine = new InstitutionalRecommendationGovernanceEngine();

  const result = engine.evaluate({
    consensusScore: 0.30,
    reputationScore: 0.40,
    confidenceScore: 0.30,
    memoryScore: 0.35,
    operatorScore: 0.40,
    riskScore: 0.30,
  });

  assert.equal(
    result.recommendation,
    RECOMMENDATIONS.NAO_UTILIZAR
  );
});

test('validates score ranges', () => {
  const engine = new InstitutionalRecommendationGovernanceEngine();

  assert.throws(() => {
    engine.evaluate({
      consensusScore: 1.2,
      reputationScore: 0.5,
      confidenceScore: 0.5,
      memoryScore: 0.5,
      operatorScore: 0.5,
      riskScore: 0.5,
    });
  });
});
