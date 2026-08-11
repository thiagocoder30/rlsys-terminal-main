import { describe, it, expect } from 'vitest';
import { SessionAuditReportService } from '../../../src/application/session-audit/SessionAuditReportService';
import { SessionAuditHistory } from '../../../src/application/session-audit/SessionAuditHistory';
import { HistoricalSessionSnapshot } from '../../../src/application/session-audit/HistoricalSessionSnapshot';

describe('SessionAuditReportService', () => {
    it('should aggregate history and performance reports accurately', () => {
        const history = new SessionAuditHistory();
        const service = new SessionAuditReportService(history);

        const snapshot = new HistoricalSessionSnapshot({
            sessionId: 'SESSION-001',
            startTime: Date.now() - 60000,
            endTime: Date.now(),
            initialBankroll: 1000,
            finalBankroll: 1250,
            profitLoss: 250,
            roi: 0.25,
            totalRounds: 20,
            confirmedSuggestions: 15,
            skippedSuggestions: 5,
            wins: 15,
            losses: 5,
            stopReason: 'STOP_WIN_TRIGGERED',
            strategiesUsed: ['Dozen 1'],
            performanceScore: 90
        });

        history.append(snapshot);

        const historyRecords = service.getSessionHistory();
        expect(historyRecords.length).toBe(1);

        const report = service.getPerformanceReport();
        expect(report.evolution.startingBankroll).toBe(1000);
        expect(report.evolution.currentBankroll).toBe(1250);
        expect(report.strategyPerformances.length).toBe(1);
        expect(report.comparison.bestSession?.data.sessionId).toBe('SESSION-001');
    });
});
