import { describe, it, expect } from 'vitest';
import { HistoricalPatternDetector } from '../../../src/application/multisession/HistoricalPatternDetector';

describe('HistoricalPatternDetector', () => {
    it('should detect patterns based on inputs', () => {
        const detector = new HistoricalPatternDetector();
        
        const patterns = detector.detectPatterns('TRENDING', 0.9, 0.8);
        expect(patterns).toContain('HIGH_HISTORICAL_CONSISTENCY');
        expect(patterns).toContain('TREND_ADAPTATION_MASTERY');
    });

    it('should calculate valid stability and seasonality', () => {
        const detector = new HistoricalPatternDetector();
        
        const stability = detector.calculateStabilityIndex(0.8, 0.5);
        expect(stability).toBeCloseTo((0.8 * 0.7) + (0.5 * 0.3));
        
        const seasonality = detector.calculateSeasonalityScore(5, 0.8);
        expect(seasonality).toBeGreaterThan(0);
    });
});
