const test = require('node:test');
const assert = require('node:assert/strict');
const { ConfidenceScorer } = require('../dist/domain/services/ConfidenceScorer');

test('ConfidenceScorer returns a bounded score and grade', () => {
  const scorer = new ConfidenceScorer();
  const analysis = {
    status: 'ALLOWED',
    reason: 'test',
    metrics: {
      sampleSize: 300,
      normalizedEntropy: 0.97,
      entropy: 5,
      maxEntropy: 5.2,
      chiSquare: 40,
      maxAbsNumberZScore: 2,
      hotNumbers: [],
      coldNumbers: [],
      sectors: [],
      lastNumber: 1
    },
    signals: [{ type: 'SECTOR_BIAS', target: 'tiers', confidence: 0.62, rationale: 'test' }],
    suggestedFraction: 0.005,
    bankroll: 0.005,
    risk: { level: 'MEDIUM', warnings: [] }
  };

  const score = scorer.score(analysis, {
    trades: 40,
    wins: 18,
    losses: 22,
    hitRate: 0.45,
    roi: 0.03,
    maxDrawdown: 0.1,
    expectancyPerTrade: 0.001,
    finalEquity: 1.03
  });

  assert.ok(score.finalScore >= 0 && score.finalScore <= 1);
  assert.ok(['A', 'B', 'C', 'D', 'F'].includes(score.grade));
});
