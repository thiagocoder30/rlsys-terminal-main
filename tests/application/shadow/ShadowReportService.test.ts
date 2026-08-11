import { describe, it, expect, beforeEach } from 'vitest';
import { ShadowReportService } from '../../../src/application/shadow/ShadowReportService';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../../../src/application/runtime/DecisionLedger';

describe('ShadowReportService Unit Tests', () => {
    let eventBus: ObservabilityEventBus;
    let ledger: DecisionLedger;
    let service: ShadowReportService;

    beforeEach(() => {
        eventBus = new ObservabilityEventBus();
        ledger = new DecisionLedger();
        service = new ShadowReportService(eventBus, ledger);
    });

    it('should generate an initial valid ShadowPerformanceSnapshot', () => {
        const snapshot = service.getShadowPerformance('SESSION-000');
        expect(snapshot).toBeDefined();
        expect(snapshot.sessionId).toBe('SESSION-000');
        expect(snapshot.initialBankroll).toBe(10000);
        expect(snapshot.currentBankroll).toBe(10000);
        expect(snapshot.snapshotHash).toBeDefined();
        expect(snapshot.snapshotHash.length).toBe(64);
    });

    it('should react to ROUND_PROCESSED events and update shadow portfolio and ledger', () => {
        eventBus.publish('ROUND_PROCESSED', '5.0.0', 'corr-1', 'SESSION-000', {
            isOpportunity: true,
            suggestedStrategy: 'MARKOV_TREND',
            confidence: 0.85,
            consensus: 0.80,
            status: 'RECOMMENDATION',
            pnlDelta: 25,
            isWin: true
        });

        const snapshot = service.getShadowPerformance('SESSION-000');
        expect(snapshot.totalSimulations).toBe(1);
        expect(snapshot.wins).toBe(1);
        expect(snapshot.currentBankroll).toBeGreaterThan(10000);

        const ledgerEntries = ledger.getEntries('SESSION-000');
        expect(ledgerEntries.some(e => e.decisionSummary === 'SHADOW_DECISION_CREATED')).toBe(true);
        expect(ledgerEntries.some(e => e.decisionSummary === 'SHADOW_TRADE_SIMULATED')).toBe(true);
        expect(ledgerEntries.some(e => e.decisionSummary === 'SHADOW_PERFORMANCE_UPDATED')).toBe(true);
    });

    it('should maintain history buffer up to 100 snapshots', () => {
        for (let i = 0; i < 110; i++) {
            service.processDecisionEvent('SESSION-000', {
                isOpportunity: true,
                strategy: 'MARKOV_TREND',
                preFlightStatus: 'APPROVED',
                status: 'RECOMMENDATION'
            }, { isWin: true });
        }

        const history = service.getShadowHistory('SESSION-000');
        expect(history.length).toBeLessThanOrEqual(100);
    });
});
