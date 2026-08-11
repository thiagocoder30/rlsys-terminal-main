import { describe, it, expect } from 'vitest';
import { ConfidenceCalibrationService } from '../../src/application/adaptive/ConfidenceCalibrationService';
import { StrategyConfidence } from '../../src/domain/adaptive/StrategyConfidence';

describe('ConfidenceCalibrationService', () => {
    const service = new ConfidenceCalibrationService();

    it('should calibrate weight based on score and trend', () => {
        const conf: StrategyConfidence = { strategyId: '1', score: { value: 100, level: 'MAXIMUM' }, trend: 'UP', volatility: 0, stability: 100, recovery: 100, lastUpdated: 0 };
        const weight = service.calibrateWeight(conf);
        expect(weight).toBe(1.1); // 1.0 * 1.1
    });

    it('should reduce weight for high volatility', () => {
        const conf: StrategyConfidence = { strategyId: '1', score: { value: 100, level: 'MAXIMUM' }, trend: 'UP', volatility: 60, stability: 100, recovery: 100, lastUpdated: 0 };
        const weight = service.calibrateWeight(conf);
        expect(weight).toBeCloseTo(0.88); // 1.1 * 0.8
    });

    it('should return priority based on score', () => {
        const conf: StrategyConfidence = { strategyId: '1', score: { value: 95, level: 'MAXIMUM' }, trend: 'UP', volatility: 0, stability: 100, recovery: 100, lastUpdated: 0 };
        expect(service.calibratePriority(conf)).toBe(1);
    });
});
