import { describe, it, expect } from 'vitest';
import { StrategyScore } from '../../../../src/domain/intelligence/strategy/StrategyScore';

describe('StrategyScore', () => {
  it('should correctly define StrategyScore interface shape', () => {
    const score: StrategyScore = {
      candidateId: 'strat-1',
      overallScore: 85,
      probabilityContribution: 25,
      entropyContribution: 15,
      vixContribution: 20,
      zScoreContribution: 15,
      confidenceContribution: 10,
      riskPenalty: 5,
      finalScore: 80
    };

    expect(score.candidateId).toBe('strat-1');
    expect(score.finalScore).toBe(80);
    expect(score.overallScore).toBe(85);
  });
});
