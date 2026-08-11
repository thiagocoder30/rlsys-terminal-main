import { describe, it, expect, beforeEach } from 'vitest';
import { MarketRegimeEngine } from '../../../src/application/regime/MarketRegimeEngine';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../../../src/application/runtime/DecisionLedger';

describe('MarketRegimeEngine Unit Tests', () => {
    let eventBus: ObservabilityEventBus;
    let ledger: DecisionLedger;
    let regimeEngine: MarketRegimeEngine;

    beforeEach(() => {
        eventBus = new ObservabilityEventBus();
        ledger = new DecisionLedger();
        regimeEngine = new MarketRegimeEngine(eventBus, ledger);
    });

    it('should classify initial market state as LOW_INFORMATION when samples are < 10', () => {
        const snapshot = regimeEngine.getLatestSnapshot('SESSION-000');
        expect(snapshot).toBeDefined();
        expect(snapshot.currentRegime).toBe('LOW_INFORMATION');
        expect(snapshot.eligibleStrategyFamilies).toContain('WARMUP_OBSERVATION');
    });

    it('should classify market as CHAOTIC when VIX >= 70 or entropy >= 0.98', () => {
        for (let i = 0; i < 12; i++) {
            eventBus.publish('ROUND_PROCESSED', '5.0.0', `corr-${i}`, 'SESSION-000', {
                vix: 75,
                entropy: 0.99,
                confidence: 0.4,
                consensus: 0.3
            });
        }

        const snapshot = regimeEngine.getLatestSnapshot('SESSION-000');
        expect(snapshot.currentRegime).toBe('CHAOTIC');
        expect(snapshot.eligibleStrategyFamilies).toContain('CAPITAL_PRESERVATION_HOLD');
    });

    it('should classify market as TRENDING when high confidence, high consensus, and moderate entropy', () => {
        for (let i = 0; i < 12; i++) {
            eventBus.publish('ROUND_PROCESSED', '5.0.0', `corr-${i}`, 'SESSION-000', {
                vix: 30,
                entropy: 0.82,
                confidence: 0.85,
                consensus: 0.75
            });
        }

        const snapshot = regimeEngine.getLatestSnapshot('SESSION-000');
        expect(snapshot.currentRegime).toBe('TRENDING');
        expect(snapshot.eligibleStrategyFamilies).toContain('MARKOV_TREND');
    });

    it('should detect regime transitions and record audit logs in DecisionLedger', () => {
        // First 10 samples -> TRENDING
        for (let i = 0; i < 10; i++) {
            eventBus.publish('ROUND_PROCESSED', '5.0.0', `corr-${i}`, 'SESSION-000', {
                vix: 25,
                entropy: 0.80,
                confidence: 0.80,
                consensus: 0.70
            });
        }

        let snapshot = regimeEngine.getLatestSnapshot('SESSION-000');
        expect(snapshot.currentRegime).toBe('TRENDING');

        // Transition to CHAOTIC
        eventBus.publish('ROUND_PROCESSED', '5.0.0', 'corr-trans', 'SESSION-000', {
            vix: 85,
            entropy: 0.99,
            confidence: 0.30,
            consensus: 0.20
        });

        snapshot = regimeEngine.getLatestSnapshot('SESSION-000');
        expect(snapshot.currentRegime).toBe('CHAOTIC');
        expect(snapshot.previousRegime).toBe('TRENDING');

        const entries = ledger.getEntries('SESSION-000');
        expect(entries.some(e => e.decisionSummary === 'MARKET_REGIME_CHANGED')).toBe(true);
    });

    it('should generate valid SHA-256 snapshot hashes', () => {
        const snapshot = regimeEngine.evaluateAndEmitSnapshot('SESSION-000');
        expect(snapshot.snapshotHash).toBeDefined();
        expect(snapshot.snapshotHash.length).toBe(64);
    });
});
