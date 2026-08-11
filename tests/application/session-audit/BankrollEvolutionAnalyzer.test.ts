import { describe, it, expect } from 'vitest';
import { BankrollEvolutionAnalyzer } from '../../../src/application/session-audit/BankrollEvolutionAnalyzer';
import { HistoricalSessionSnapshot } from '../../../src/application/session-audit/HistoricalSessionSnapshot';

describe('BankrollEvolutionAnalyzer', () => {
    it('should calculate bankroll growth, drawdown, and peaks correctly', () => {
        const s1 = new HistoricalSessionSnapshot({
            sessionId: 's1',
            startTime: 1000,
            endTime: 2000,
            initialBankroll: 1000,
            finalBankroll: 1200,
            profitLoss: 200,
            roi: 0.2,
            totalRounds: 10,
            confirmedSuggestions: 10,
            skippedSuggestions: 0,
            wins: 7,
            losses: 3,
            stopReason: 'STOP_WIN',
            strategiesUsed: ['Dozen 1'],
            performanceScore: 85
        });

        const s2 = new HistoricalSessionSnapshot({
            sessionId: 's2',
            startTime: 3000,
            endTime: 4000,
            initialBankroll: 1200,
            finalBankroll: 1100,
            profitLoss: -100,
            roi: -0.0833,
            totalRounds: 10,
            confirmedSuggestions: 10,
            skippedSuggestions: 0,
            wins: 4,
            losses: 6,
            stopReason: 'MANUAL',
            strategiesUsed: ['Dozen 1'],
            performanceScore: 40
        });

        const summary = BankrollEvolutionAnalyzer.analyze([s1, s2]);

        expect(summary.startingBankroll).toBe(1000);
        expect(summary.currentBankroll).toBe(1100);
        expect(summary.highestBankroll).toBe(1200);
        expect(summary.lowestBankroll).toBe(1000);
        expect(summary.growthRate).toBe(0.1); // (1100 - 1000)/1000
        expect(summary.sessionCount).toBe(2);
    });
});
