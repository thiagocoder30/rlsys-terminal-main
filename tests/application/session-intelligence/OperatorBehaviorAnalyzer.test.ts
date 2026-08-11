import { describe, it, expect } from 'vitest';
import { OperatorBehaviorAnalyzer } from '../../../src/application/session-intelligence/OperatorBehaviorAnalyzer';
import { HistoricalSessionSnapshot } from '../../../src/application/session-audit/HistoricalSessionSnapshot';

describe('OperatorBehaviorAnalyzer', () => {
    it('should generate meaningful insights based on session history', () => {
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
            stopReason: 'STOP_WIN_TRIGGERED',
            strategiesUsed: ['Dozen 1'],
            performanceScore: 85
        });

        const insights = OperatorBehaviorAnalyzer.analyze([s1]);
        expect(insights.length).toBeGreaterThan(0);
        expect(insights[0]).toContain('Elevada adesão');
    });
});
