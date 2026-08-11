import { describe, it, expect } from 'vitest';
import { SessionComparisonEngine } from '../../../src/application/session-audit/SessionComparisonEngine';
import { HistoricalSessionSnapshot } from '../../../src/application/session-audit/HistoricalSessionSnapshot';

describe('SessionComparisonEngine', () => {
    it('should identify best/worst sessions and trend', () => {
        const s1 = new HistoricalSessionSnapshot({
            sessionId: 's1',
            startTime: 1000,
            endTime: 2000,
            initialBankroll: 1000,
            finalBankroll: 900,
            profitLoss: -100,
            roi: -0.1,
            totalRounds: 10,
            confirmedSuggestions: 10,
            skippedSuggestions: 0,
            wins: 3,
            losses: 7,
            stopReason: 'STOP_LOSS',
            strategiesUsed: ['Dozen 1'],
            performanceScore: 30
        });

        const s2 = new HistoricalSessionSnapshot({
            sessionId: 's2',
            startTime: 3000,
            endTime: 4000,
            initialBankroll: 900,
            finalBankroll: 1200,
            profitLoss: 300,
            roi: 0.333,
            totalRounds: 10,
            confirmedSuggestions: 10,
            skippedSuggestions: 0,
            wins: 8,
            losses: 2,
            stopReason: 'STOP_WIN',
            strategiesUsed: ['Dozen 2'],
            performanceScore: 90
        });

        const result = SessionComparisonEngine.compare([s1, s2]);

        expect(result.bestSession?.data.sessionId).toBe('s2');
        expect(result.worstSession?.data.sessionId).toBe('s1');
        expect(result.trend).toBe('IMPROVING');
    });
});
