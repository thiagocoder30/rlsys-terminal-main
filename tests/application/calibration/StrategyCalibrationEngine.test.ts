import { describe, it, expect, beforeEach } from 'vitest';
import { StrategyCalibrationEngine } from '../../../src/application/calibration/StrategyCalibrationEngine';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../../../src/application/runtime/DecisionLedger';

describe('StrategyCalibrationEngine Unit Tests', () => {
    let eventBus: ObservabilityEventBus;
    let ledger: DecisionLedger;
    let calibrationEngine: StrategyCalibrationEngine;

    beforeEach(() => {
        eventBus = new ObservabilityEventBus();
        ledger = new DecisionLedger();
        calibrationEngine = new StrategyCalibrationEngine(eventBus, ledger);
    });

    it('should initialize and generate a valid default StrategyWeightSnapshot', () => {
        const snapshot = calibrationEngine.getLatestSnapshot('SESSION-000');
        expect(snapshot).toBeDefined();
        expect(snapshot.sessionId).toBe('SESSION-000');
        expect(snapshot.weights.length).toBeGreaterThan(0);
        expect(snapshot.snapshotHash).toBeDefined();
        expect(snapshot.snapshotHash.length).toBe(64);
    });

    it('should apply exponential decay and recalculate dynamic weights upon ROUND_PROCESSED', () => {
        eventBus.publish('ROUND_PROCESSED', '5.0.0', 'corr-1', 'SESSION-000', {
            suggestedStrategy: 'MARKOV_TREND',
            confidence: 0.90,
            consensus: 0.85,
            status: 'RECOMMENDATION',
            pnlDelta: 15,
            isWin: true
        });

        const snapshot = calibrationEngine.getLatestSnapshot('SESSION-000');
        const markov = snapshot.weights.find(w => w.strategyId === 'MARKOV_TREND');
        expect(markov).toBeDefined();
        expect(markov!.dynamicWeight).toBeGreaterThan(0);
        expect(markov!.trend).toBeDefined();
    });

    it('should react to market regime updates and adjust strategy weights accordingly', () => {
        eventBus.publish('MARKET_REGIME_UPDATED', '5.0.0', 'corr-2', 'SESSION-000', {
            snapshot: {
                currentRegime: 'TRENDING'
            }
        });

        const snapshot = calibrationEngine.getLatestSnapshot('SESSION-000');
        expect(snapshot.marketRegime).toBe('TRENDING');
    });

    it('should append audit entries to DecisionLedger', () => {
        calibrationEngine.calibrateAndEmitSnapshot('SESSION-000');
        const entries = ledger.getEntries('SESSION-000');
        expect(entries.some(e => e.decisionSummary === 'STRATEGY_WEIGHT_UPDATED')).toBe(true);
        expect(entries.some(e => e.decisionSummary === 'CALIBRATION_SNAPSHOT_CREATED')).toBe(true);
        expect(entries.some(e => e.decisionSummary === 'CALIBRATION_DECAY_APPLIED')).toBe(true);
    });

    it('should maintain a history of up to 100 snapshots', () => {
        for (let i = 0; i < 110; i++) {
            calibrationEngine.calibrateAndEmitSnapshot('SESSION-000');
        }
        const history = calibrationEngine.getCalibrationHistory('SESSION-000');
        expect(history.length).toBeLessThanOrEqual(100);
    });
});
