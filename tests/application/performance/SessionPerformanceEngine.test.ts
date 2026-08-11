import { describe, it, expect, beforeEach } from 'vitest';
import { SessionPerformanceEngine } from '../../../src/application/performance/SessionPerformanceEngine';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../../../src/application/runtime/DecisionLedger';

describe('SessionPerformanceEngine Unit Tests', () => {
    let eventBus: ObservabilityEventBus;
    let ledger: DecisionLedger;
    let performanceEngine: SessionPerformanceEngine;

    beforeEach(() => {
        eventBus = new ObservabilityEventBus();
        ledger = new DecisionLedger();
        performanceEngine = new SessionPerformanceEngine(eventBus, ledger);
    });

    it('should initialize and produce an initial performance snapshot', () => {
        const snapshot = performanceEngine.getLatestSnapshot('SESSION-000');
        expect(snapshot).toBeDefined();
        expect(snapshot.sessionId).toBe('SESSION-000');
        expect(snapshot.sessionHealth).toBeDefined();
        expect(snapshot.confidenceTrend).toBe('STABLE');
        expect(snapshot.consensusTrend).toBe('STABLE');
    });

    it('should update metrics upon ROUND_PROCESSED event', () => {
        eventBus.publish('ROUND_PROCESSED', '5.0.0', 'corr-1', 'SESSION-000', {
            vix: 30,
            entropy: 0.92,
            status: 'RECOMMENDATION',
            confidence: 0.85,
            consensus: 0.75,
            stake: 15,
            suggestedStrategy: 'STRAT_MARKOV'
        });

        const snapshot = performanceEngine.getLatestSnapshot('SESSION-000');
        expect(snapshot.averageVix).toBe(30);
        expect(snapshot.averageEntropy).toBe(0.92);
        expect(snapshot.averageRecommendationScore).toBe(0.85);
    });

    it('should evaluate session health correctly when drawdown increases', () => {
        eventBus.publish('SESSION_UPDATED', '5.0.0', 'corr-2', 'SESSION-000', {
            drawdown: 18.5
        });

        const snapshot = performanceEngine.getLatestSnapshot('SESSION-000');
        expect(snapshot.sessionHealth).toBe('CRITICAL');
        expect(ledger.getEntries('SESSION-000').some(e => e.decisionSummary === 'SESSION_HEALTH_CHANGED')).toBe(true);
    });

    it('should calculate confidence stability and trends across observations', () => {
        for (let i = 0; i < 5; i++) {
            eventBus.publish('ROUND_PROCESSED', '5.0.0', `corr-${i}`, 'SESSION-000', {
                vix: 25,
                entropy: 0.95,
                status: 'RECOMMENDATION',
                confidence: 0.5 + i * 0.08,
                consensus: 0.6 + i * 0.05,
                stake: 10,
                suggestedStrategy: 'STRAT_ZSCORE'
            });
        }

        const snapshot = performanceEngine.getLatestSnapshot('SESSION-000');
        expect(snapshot.confidenceTrend).toBe('UPWARD');
        expect(snapshot.consensusTrend).toBe('EXPANDING');
        expect(snapshot.operationalStabilityIndex).toBeGreaterThan(0);
    });

    it('should record snapshots into DecisionLedger in append-only SHA-256 mode', () => {
        performanceEngine.evaluateAndEmitSnapshot('SESSION-000');
        const entries = ledger.getEntries('SESSION-000');
        expect(entries.length).toBeGreaterThan(0);
        expect(entries[0].integrityHash).toBeDefined();
        expect(entries[0].integrityHash.length).toBe(64); // SHA-256 hex string length
    });
});
