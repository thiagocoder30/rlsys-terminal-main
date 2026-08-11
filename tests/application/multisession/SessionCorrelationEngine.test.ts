import { describe, it, expect } from 'vitest';
import { SessionCorrelationEngine } from '../../../src/application/multisession/SessionCorrelationEngine';

describe('SessionCorrelationEngine', () => {
    it('should calculate valid correlation index', () => {
        const engine = new SessionCorrelationEngine();
        
        const corr1 = engine.calculateCorrelationIndex(0.8, 0.8, 0.5, 0.5);
        expect(corr1).toBe(1.0); // Exact match
        
        const corr2 = engine.calculateCorrelationIndex(0.0, 1.0, 0.0, 1.0);
        expect(corr2).toBeCloseTo(0.0); // Completely opposite
    });
});
