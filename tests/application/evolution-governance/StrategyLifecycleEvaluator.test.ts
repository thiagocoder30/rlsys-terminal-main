import { describe, it, expect } from 'vitest';
import { StrategyLifecycleEvaluator } from '../../../src/application/evolution-governance/StrategyLifecycleEvaluator';

describe('StrategyLifecycleEvaluator', () => {
    const evalor = new StrategyLifecycleEvaluator();

    it('should return PROMOTE when conditions are met', () => {
        expect(evalor.evaluateLifecycle(0.9, 0.8, 0.2, 0.9)).toBe('PROMOTE');
    });

    it('should return DEPRECATE when maturity is very low', () => {
        expect(evalor.evaluateLifecycle(0.2, 0.5, 0.2, 0.5)).toBe('DEPRECATE');
    });

    it('should return RETIRE when maturity is low and risk is high', () => {
        expect(evalor.evaluateLifecycle(0.1, 0.5, 0.95, 0.5)).toBe('RETIRE');
    });

    it('should return WATCH when risk is elevated', () => {
        expect(evalor.evaluateLifecycle(0.5, 0.5, 0.6, 0.5)).toBe('WATCH');
    });

    it('should return KEEP otherwise', () => {
        expect(evalor.evaluateLifecycle(0.5, 0.5, 0.2, 0.6)).toBe('KEEP');
    });
});
