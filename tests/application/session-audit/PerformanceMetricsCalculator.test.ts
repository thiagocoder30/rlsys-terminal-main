import { describe, it, expect } from 'vitest';
import { PerformanceMetricsCalculator } from '../../../src/application/session-audit/PerformanceMetricsCalculator';

describe('PerformanceMetricsCalculator', () => {
    it('should calculate ROI, win rate, confirmation rate and score accurately', () => {
        const metrics = PerformanceMetricsCalculator.calculate(
            1000,
            1200,
            20,
            15,
            5,
            12,
            8
        );

        expect(metrics.roi).toBe(0.2); // +20%
        expect(metrics.winRate).toBe(0.6); // 12/20
        expect(metrics.confirmationRate).toBe(0.75); // 15/20
        expect(metrics.utilizationRate).toBe(0.8); // 12/15
        expect(metrics.overallScore).toBeGreaterThan(0);
        expect(metrics.overallScore).toBeLessThanOrEqual(100);
    });
});
