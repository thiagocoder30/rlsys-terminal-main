import { describe, it, expect } from 'vitest';
import { ImprovementTrendCalculator } from '../../../src/application/session-intelligence/ImprovementTrendCalculator';
import { HistoricalSessionSnapshot } from '../../../src/application/session-audit/HistoricalSessionSnapshot';

describe('ImprovementTrendCalculator', () => {
    it('should identify IMPROVING trend when latest score is significantly higher', () => {
        const s1 = new HistoricalSessionSnapshot({
            sessionId: 's1',
            startTime: 1000,
            endTime: 2000,
            initialBankroll: 1000,
            finalBankroll: 1000,
            profitLoss: 0,
            roi: 0,
            totalRounds: 10,
            confirmedSuggestions: 5,
            skippedSuggestions: 5,
            wins: 5,
            losses: 5,
            stopReason: 'MANUAL',
            strategiesUsed: ['Dozen 1'],
            performanceScore: 50
        });

        const s2 = new HistoricalSessionSnapshot({
            sessionId: 's2',
            startTime: 3000,
            endTime: 4000,
            initialBankroll: 1000,
            finalBankroll: 1300,
            profitLoss: 300,
            roi: 0.3,
            totalRounds: 10,
            confirmedSuggestions: 9,
            skippedSuggestions: 1,
            wins: 8,
            losses: 2,
            stopReason: 'STOP_WIN',
            strategiesUsed: ['Dozen 2'],
            performanceScore: 90
        });

        const trend = ImprovementTrendCalculator.calculate([s1, s2]);
        expect(trend).toBe('IMPROVING');
    });
});
