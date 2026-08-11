import { describe, it, expect } from 'vitest';
import { WeightedVotingEngine } from '../../src/application/ensemble/WeightedVotingEngine';

describe('WeightedVotingEngine', () => {
    it('should calculate weights correctly', () => {
        const engine = new WeightedVotingEngine();
        const votes = [
            { modelId: 'M1', suggestedStrategy: 'S1', confidence: 100, weight: 1 },
            { modelId: 'M2', suggestedStrategy: 'S1', confidence: 50, weight: 0.5 },
            { modelId: 'M3', suggestedStrategy: 'S2', confidence: 80, weight: 2 },
            { modelId: 'M4', suggestedStrategy: null, confidence: 100, weight: 1 }
        ];

        const result = engine.calculateVotes(votes);
        expect(result.size).toBe(2);
        
        const s1 = result.get('S1');
        expect(s1?.totalWeight).toBe(1.5);
        expect(s1?.voteCount).toBe(2);
        expect(s1?.averageConfidence).toBe(75);

        const s2 = result.get('S2');
        expect(s2?.totalWeight).toBe(2);
        expect(s2?.voteCount).toBe(1);
    });
});
