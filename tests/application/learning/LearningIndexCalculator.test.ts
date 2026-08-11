import { describe, it, expect } from 'vitest';
import { LearningIndexCalculator } from '../../../src/application/learning/LearningIndexCalculator';

describe('LearningIndexCalculator', () => {
    it('should calculate indexes correctly', () => {
        const calculator = new LearningIndexCalculator();
        const overall = calculator.calculateOverallIndex(1, 1, 1, 1, 1, 1, 1);
        expect(overall).toBe(1.0);

        const stability = calculator.calculateStability(1.0);
        expect(stability).toBe(1.0); // capped at 1.0

        const confidence = calculator.calculateInstitutionalConfidence(1, 1, 1);
        expect(confidence).toBeCloseTo(1.0); // (1.5 + 1.2 + 1) / 3.7
    });
});
