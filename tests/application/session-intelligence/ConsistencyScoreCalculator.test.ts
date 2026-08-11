import { describe, it, expect } from 'vitest';
import { ConsistencyScoreCalculator } from '../../../src/application/session-intelligence/ConsistencyScoreCalculator';
import { HistoricalSessionSnapshot } from '../../../src/application/session-audit/HistoricalSessionSnapshot';

describe('ConsistencyScoreCalculator', () => {
    it('should calculate consistency score between 0 and 100', () => {
        const s1 = new HistoricalSessionSnapshot({
            sessionId: 's1',
            startTime: 1000,
            endTime: 2000,
            initialBankroll: 1000,
            finalBankroll: 1200,
            profitLoss: 200,
            roi: 0.2,
            totalRounds: 10,
            confirmedSuggestions: 9,
            skippedSuggestions: 1,
            wins: 7,
            losses: 3,
            stopReason: 'STOP_WIN',
            strategiesUsed: ['Dozen 1'],
            performanceScore: 85
        });

        const score = ConsistencyScoreCalculator.calculate([s1]);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
        expect(score).toBe(92);
    });

    it('should return default 50 for empty history', () => {
        expect(ConsistencyScoreCalculator.calculate([])).toBe(50);
    });
});
