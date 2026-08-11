import { describe, it, expect } from 'vitest';
import { StrategyPerformanceAnalyzer } from '../../../src/application/session-audit/StrategyPerformanceAnalyzer';
import { HistoricalSessionSnapshot } from '../../../src/application/session-audit/HistoricalSessionSnapshot';

describe('StrategyPerformanceAnalyzer', () => {
    it('should correctly group and score strategy performances', () => {
        const snapshot1 = new HistoricalSessionSnapshot({
            sessionId: 's1',
            startTime: Date.now() - 10000,
            endTime: Date.now() - 5000,
            initialBankroll: 1000,
            finalBankroll: 1100,
            profitLoss: 100,
            roi: 0.1,
            totalRounds: 10,
            confirmedSuggestions: 8,
            skippedSuggestions: 2,
            wins: 7,
            losses: 3,
            stopReason: 'STOP_WIN_TRIGGERED',
            strategiesUsed: ['Dozen 1', 'Column 2'],
            performanceScore: 80
        });

        const summaries = StrategyPerformanceAnalyzer.analyze([snapshot1]);
        expect(summaries.length).toBe(2);
        expect(summaries.map(s => s.strategyName)).toContain('Dozen 1');
        expect(summaries.map(s => s.strategyName)).toContain('Column 2');
        expect(summaries[0].winRate).toBe(0.7);
    });
});
