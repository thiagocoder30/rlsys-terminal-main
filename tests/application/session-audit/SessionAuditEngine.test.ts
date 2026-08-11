import { describe, it, expect } from 'vitest';
import { SessionAuditEngine } from '../../../src/application/session-audit/SessionAuditEngine';
import { SessionAuditHistory } from '../../../src/application/session-audit/SessionAuditHistory';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../../../src/application/runtime/observability/ObservableDecisionLedger';

describe('SessionAuditEngine', () => {
    it('should audit session, append snapshot with hash and freeze data', () => {
        const eventBus = new ObservabilityEventBus();
        const ledger = new ObservableDecisionLedger(eventBus);
        const history = new SessionAuditHistory();
        const engine = new SessionAuditEngine(eventBus, ledger, history);

        let eventFired = false;
        eventBus.subscribe('SESSION_HISTORY_ANALYZED', () => { eventFired = true; });

        const snapshot = engine.auditSession({
            sessionId: 'SESSION-001',
            startTime: Date.now() - 60000,
            endTime: Date.now(),
            initialBankroll: 1000,
            finalBankroll: 1250,
            totalRounds: 25,
            confirmedSuggestions: 20,
            skippedSuggestions: 5,
            wins: 18,
            losses: 7,
            stopReason: 'STOP_WIN_TRIGGERED',
            strategiesUsed: ['Dozen 2']
        });

        expect(snapshot.data.sessionId).toBe('SESSION-001');
        expect(snapshot.data.profitLoss).toBe(250);
        expect(snapshot.data.roi).toBe(0.25);
        expect(snapshot.hash).toBeDefined();
        expect(Object.isFrozen(snapshot)).toBe(true);
        expect(Object.isFrozen(snapshot.data)).toBe(true);

        const records = history.getRecords();
        expect(records.length).toBe(1);
        expect(eventFired).toBe(true);
    });
});
