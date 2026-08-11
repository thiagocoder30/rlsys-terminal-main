import { describe, it, expect } from 'vitest';
import { StrategyWeightNormalizer } from '../../../src/application/calibration/StrategyWeightNormalizer';

describe('StrategyWeightNormalizer Unit Tests', () => {
    const normalizer = new StrategyWeightNormalizer();

    it('should normalize weights into [0, 1] range summing to ~1.0', () => {
        const raw = {
            STRAT_A: 10,
            STRAT_B: 30,
            STRAT_C: 60
        };

        const result = normalizer.normalizeToUnit(raw);
        expect(result.STRAT_A).toBe(0.1);
        expect(result.STRAT_B).toBe(0.3);
        expect(result.STRAT_C).toBe(0.6);

        const sum = Object.values(result).reduce((a, b) => a + b, 0);
        expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
    });

    it('should clamp negative values to zero and distribute remaining properly', () => {
        const raw = {
            STRAT_A: -10,
            STRAT_B: 20,
            STRAT_C: 20
        };

        const result = normalizer.normalizeToUnit(raw);
        expect(result.STRAT_A).toBe(0);
        expect(result.STRAT_B).toBe(0.5);
        expect(result.STRAT_C).toBe(0.5);
    });

    it('should handle all zeros by distributing equal share', () => {
        const raw = {
            STRAT_A: 0,
            STRAT_B: 0,
            STRAT_C: 0,
            STRAT_D: 0
        };

        const result = normalizer.normalizeToUnit(raw);
        expect(result.STRAT_A).toBe(0.25);
        expect(result.STRAT_B).toBe(0.25);
        expect(result.STRAT_C).toBe(0.25);
        expect(result.STRAT_D).toBe(0.25);
    });

    it('should scale normalized weights to 100 percentage scale', () => {
        const raw = {
            STRAT_A: 2,
            STRAT_B: 8
        };

        const scaled = normalizer.scaleToHundred(raw);
        expect(scaled.STRAT_A).toBe(20);
        expect(scaled.STRAT_B).toBe(80);
    });
});
