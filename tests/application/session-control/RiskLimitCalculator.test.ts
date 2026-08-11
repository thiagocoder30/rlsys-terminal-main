import { describe, it, expect } from 'vitest';
import { RiskLimitCalculator } from '../../../src/application/session-control/RiskLimitCalculator';

describe('RiskLimitCalculator', () => {
    it('should calculate default 15% stop loss', () => {
        const calc = new RiskLimitCalculator();
        expect(calc.calculateStopLossLimit(1000)).toBe(850);
    });

    it('should calculate default 30% stop win', () => {
        const calc = new RiskLimitCalculator();
        expect(calc.calculateStopWinLimit(1000)).toBe(1300);
    });
});
