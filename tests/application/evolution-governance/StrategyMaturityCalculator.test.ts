import { describe, it, expect } from 'vitest';
import { StrategyMaturityCalculator } from '../../../src/application/evolution-governance/StrategyMaturityCalculator';

describe('StrategyMaturityCalculator', () => {
    it('should calculate valid maturity index for low maturity', () => {
        const calc = new StrategyMaturityCalculator();
        const score = calc.calculateMaturityIndex(0.1, 0.2, 0.2, 0.1);
        expect(score).toBeCloseTo(0.14);
    });

    it('should calculate valid maturity index for medium maturity', () => {
        const calc = new StrategyMaturityCalculator();
        const score = calc.calculateMaturityIndex(0.5, 0.5, 0.5, 0.5);
        expect(score).toBeCloseTo(0.5);
    });

    it('should calculate valid maturity index for high maturity', () => {
        const calc = new StrategyMaturityCalculator();
        const score = calc.calculateMaturityIndex(0.9, 0.8, 0.8, 0.9);
        expect(score).toBeCloseTo(0.86);
    });
});
