import { describe, it, expect } from 'vitest';
import { SessionIntelligenceEngine } from '../../../src/application/session-intelligence/SessionIntelligenceEngine';
import { SessionInsightHistory } from '../../../src/application/session-intelligence/SessionInsightHistory';
import { SessionAuditHistory } from '../../../src/application/session-audit/SessionAuditHistory';
import { HistoricalSessionSnapshot } from '../../../src/application/session-audit/HistoricalSessionSnapshot';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../../../src/application/runtime/observability/ObservableDecisionLedger';

describe('SessionIntelligenceEngine', () => {
    it('should calculate intelligence profile, append to history and publish event', () => {
        const eventBus = new ObservabilityEventBus();
        const ledger = new ObservableDecisionLedger(eventBus);
        const auditHistory = new SessionAuditHistory();
        const insightHistory = new SessionInsightHistory();

        let eventFired = false;
        eventBus.subscribe('SESSION_INTELLIGENCE_UPDATED', () => {
            eventFired = true;
        });

        const auditSnapshot = new HistoricalSessionSnapshot({
            sessionId: 'S-001',
            startTime: Date.now() - 3600000,
            endTime: Date.now(),
            initialBankroll: 1000,
            finalBankroll: 1200,
            profitLoss: 200,
            roi: 0.2,
            totalRounds: 20,
            confirmedSuggestions: 18,
            skippedSuggestions: 2,
            wins: 15,
            losses: 5,
            stopReason: 'STOP_WIN_TRIGGERED',
            strategiesUsed: ['Dozen 1'],
            performanceScore: 88
        });
        auditHistory.append(auditSnapshot);

        const engine = new SessionIntelligenceEngine(eventBus, ledger, auditHistory, insightHistory);
        const snapshot = engine.analyzeOperatorIntelligence('OP-001');

        expect(snapshot.data.operatorProfile.operatorId).toBe('OP-001');
        expect(snapshot.data.operatorProfile.totalSessions).toBe(1);
        expect(snapshot.data.consistencyScore).toBeGreaterThan(0);
        expect(snapshot.hash).toBeDefined();
        expect(eventFired).toBe(true);

        const records = insightHistory.getRecords();
        expect(records.length).toBe(1);
    });
});
