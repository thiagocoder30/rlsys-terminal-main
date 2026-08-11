import { describe, it, expect } from 'vitest';
import { ConsensusCalculator } from '../../src/application/ensemble/ConsensusCalculator';

describe('ConsensusCalculator', () => {
    const calc = new ConsensusCalculator();

    it('should calculate absolute consensus', () => {
        const votes = new Map([
            ['S1', { strategyId: 'S1', totalWeight: 2, voteCount: 2, averageConfidence: 90 }]
        ]);
        const result = calc.calculate(votes, 2);
        
        expect(result.score.level).toBe('ABSOLUTE');
        expect(result.agreement.percentage).toBe(100);
        expect(result.dominant?.strategyId).toBe('S1');
    });

    it('should calculate weak consensus', () => {
        const votes = new Map([
            ['S1', { strategyId: 'S1', totalWeight: 1, voteCount: 1, averageConfidence: 90 }],
            ['S2', { strategyId: 'S2', totalWeight: 1, voteCount: 1, averageConfidence: 90 }],
            ['S3', { strategyId: 'S3', totalWeight: 1, voteCount: 1, averageConfidence: 90 }]
        ]);
        const result = calc.calculate(votes, 3);
        
        expect(result.score.level).toBe('WEAK');
        expect(result.agreement.percentage).toBeCloseTo(33.33, 1);
    });
});
