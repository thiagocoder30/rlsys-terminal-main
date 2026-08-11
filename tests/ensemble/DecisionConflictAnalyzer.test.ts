import { describe, it, expect } from 'vitest';
import { DecisionConflictAnalyzer } from '../../src/application/ensemble/DecisionConflictAnalyzer';

describe('DecisionConflictAnalyzer', () => {
    const analyzer = new DecisionConflictAnalyzer();

    it('should return NONE when complete agreement', () => {
        const votes = new Map([
            ['S1', { strategyId: 'S1', totalWeight: 2, voteCount: 2, averageConfidence: 90 }]
        ]);
        const result = analyzer.analyze(votes, 2);
        expect(result.level).toBe('NONE');
        expect(result.score).toBe(0);
    });

    it('should calculate HIGH conflict', () => {
        const votes = new Map([
            ['S1', { strategyId: 'S1', totalWeight: 1, voteCount: 1, averageConfidence: 90 }],
            ['S2', { strategyId: 'S2', totalWeight: 1, voteCount: 1, averageConfidence: 90 }],
            ['S3', { strategyId: 'S3', totalWeight: 1, voteCount: 1, averageConfidence: 90 }],
            ['S4', { strategyId: 'S4', totalWeight: 1, voteCount: 1, averageConfidence: 90 }]
        ]);
        const result = analyzer.analyze(votes, 4);
        expect(result.level).toBe('HIGH');
        expect(result.score).toBe(75); // 1 - 4*(1/16) = 1 - 0.25 = 0.75 -> 75
    });
});
