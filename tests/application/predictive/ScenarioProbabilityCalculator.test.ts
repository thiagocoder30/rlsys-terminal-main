import { describe, it, expect } from 'vitest';
import { ScenarioProbabilityCalculator } from '../../../src/application/predictive/ScenarioProbabilityCalculator';

describe('ScenarioProbabilityCalculator', () => {
    it('should normalize probabilities to sum 1.0', () => {
        const calculator = new ScenarioProbabilityCalculator();
        const probs = calculator.calculateProbabilities({ a: 10, b: 30 });
        
        expect(probs['a']).toBeCloseTo(0.25);
        expect(probs['b']).toBeCloseTo(0.75);
    });

    it('should handle zero totals properly', () => {
        const calculator = new ScenarioProbabilityCalculator();
        const probs = calculator.calculateProbabilities({ a: 0, b: 0 });
        
        expect(probs['a']).toBeCloseTo(0.5);
        expect(probs['b']).toBeCloseTo(0.5);
    });
});
