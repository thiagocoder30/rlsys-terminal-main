import { describe, it, expect } from 'vitest';
import { RiskBehaviorAnalyzer } from '../../../src/application/session-intelligence/RiskBehaviorAnalyzer';
import { HistoricalSessionSnapshot } from '../../../src/application/session-audit/HistoricalSessionSnapshot';

describe('RiskBehaviorAnalyzer', () => {
    it('should identify LOW_RISK for low drawdown and no stop losses', () => {
        const s1 = new HistoricalSessionSnapshot({
            sessionId: 's1',
            startTime: 1000,
            endTime: 2000,
            initialBankroll: 1000,
            finalBankroll: 1100,
            profitLoss: 100,
            roi: 0.1,
            totalRounds: 10,
            confirmedSuggestions: 10,
            skippedSuggestions: 0,
            wins: 8,
            losses: 2,
            stopReason: 'STOP_WIN',
            strategiesUsed: ['Dozen 1'],
            performanceScore: 90
        });

        const level = RiskBehaviorAnalyzer.analyze([s1], 0.02);
        expect(level).toBe('LOW_RISK');
    });

    it('should identify HIGH_RISK for drawdown > 25%', () => {
        const s1 = new HistoricalSessionSnapshot({
            sessionId: 's1',
            startTime: 1000,
            endTime: 2000,
            initialBankroll: 1000,
            finalBankroll: 700,
            profitLoss: -300,
            roi: -0.3,
            totalRounds: 10,
            confirmedSuggestions: 10,
            skippedSuggestions: 0,
            wins: 2,
            losses: 8,
            stopReason: 'STOP_LOSS',
            strategiesUsed: ['Dozen 1'],
            performanceScore: 20
        });

        const level = RiskBehaviorAnalyzer.analyze([s1], 0.30);
        expect(level).toBe('HIGH_RISK');
    });
});
