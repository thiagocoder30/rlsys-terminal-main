const test = require('node:test');
const assert = require('node:assert/strict');
const { BayesianEdgeValidator } = require('../dist/domain/services/BayesianEdgeValidator');

const baseAnalysis = {
  status: 'ALLOWED',
  reason: 'test',
  metrics: { sampleSize: 600 },
  signals: [{ type: 'SECTOR_BIAS', target: 'voisins', confidence: 0.7, rationale: 'test' }],
  suggestedFraction: 0.005,
  bankroll: 0.005,
  risk: { level: 'LOW', warnings: [] }
};

test('BayesianEdgeValidator rejects insufficient evidence', () => {
  const validator = new BayesianEdgeValidator();
  const result = validator.validate(baseAnalysis, { trades: 10, wins: 5, losses: 5, hitRate: 0.5, roi: 0.01, maxDrawdown: 0.01, expectancyPerTrade: 0.001, finalEquity: 1.01 });
  assert.equal(result.verdict, 'REJECTED');
  assert.ok(result.probabilityEdgePositive >= 0 && result.probabilityEdgePositive <= 1);
});

test('BayesianEdgeValidator supports strong positive out-of-sample evidence', () => {
  const validator = new BayesianEdgeValidator({ minTrades: 40, minProbabilityEdgePositive: 0.55, minEvidenceScore: 0.3 });
  const result = validator.validate(baseAnalysis, { trades: 120, wins: 68, losses: 52, hitRate: 68 / 120, roi: 0.08, maxDrawdown: 0.04, expectancyPerTrade: 0.002, finalEquity: 1.08 });
  assert.equal(result.verdict, 'SUPPORTED');
  assert.ok(result.estimatedEdge > 0);
});
