import { describe, it, expect, beforeEach } from 'vitest';
import { EnsembleDecisionEngine } from '../../src/application/ensemble/EnsembleDecisionEngine';
import { WeightedVotingEngine } from '../../src/application/ensemble/WeightedVotingEngine';
import { ConsensusCalculator } from '../../src/application/ensemble/ConsensusCalculator';
import { DecisionConflictAnalyzer } from '../../src/application/ensemble/DecisionConflictAnalyzer';

describe('EnsembleDecisionEngine', () => {
    let engine: EnsembleDecisionEngine;

    beforeEach(() => {
        engine = new EnsembleDecisionEngine(
            new WeightedVotingEngine(),
            new ConsensusCalculator(),
            new DecisionConflictAnalyzer()
        );
    });

    it('should generate a valid consensus from votes', () => {
        const votes = [
            { modelId: 'MARKOV', suggestedStrategy: 'S1', confidence: 80, weight: 1 },
            { modelId: 'SHANNON', suggestedStrategy: 'S1', confidence: 90, weight: 1.2 },
            { modelId: 'ZSCORE', suggestedStrategy: 'S2', confidence: 60, weight: 0.8 }
        ];

        const consensus = engine.evaluate(votes);
        
        expect(consensus.consensusId).toBeDefined();
        expect(consensus.timestampUtc).toBeDefined();
        expect(consensus.dominantStrategy).toBeDefined();
        expect(consensus.dominantStrategy?.strategyId).toBe('S1');
        expect(consensus.score.value).toBe(2.2);
        expect(consensus.integrityHash).toBeDefined();
    });

    it('should handle no votes gracefully', () => {
        const consensus = engine.evaluate([]);
        expect(consensus.dominantStrategy).toBeNull();
        expect(consensus.score.level).toBe('WEAK');
    });
});
