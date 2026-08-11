import { describe, it, expect } from 'vitest';
import { LearningAggregator } from '../../../src/application/learning/LearningAggregator';

describe('LearningAggregator', () => {
    it('should increment scores and cap at 1.0', () => {
        const aggregator = new LearningAggregator();
        const initial = aggregator.getScores();
        expect(initial.knowledgeScore).toBe(0.5);

        aggregator.updateKnowledgeScore({});
        const afterOne = aggregator.getScores();
        expect(afterOne.knowledgeScore).toBeCloseTo(0.55);

        for (let i = 0; i < 20; i++) {
            aggregator.updateKnowledgeScore({});
        }

        const capped = aggregator.getScores();
        expect(capped.knowledgeScore).toBe(1.0);
    });
});
