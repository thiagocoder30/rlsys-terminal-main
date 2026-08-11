import { describe, it, expect } from 'vitest';
import { MultiSessionIntelligenceEngine } from '../../../src/application/multisession/MultiSessionIntelligenceEngine';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../../../src/application/runtime/DecisionLedger';

describe('MultiSessionIntelligenceEngine', () => {
    it('should generate snapshots on PREDICTIVE_SCENARIO_CREATED', () => {
        const eventBus = new ObservabilityEventBus();
        const ledger = new DecisionLedger();
        
        const engine = new MultiSessionIntelligenceEngine(eventBus, ledger);
        eventBus.publish('PREDICTIVE_SCENARIO_CREATED', '5.0.0', 'CORR-1', 'SESSION-000', {});
        
        const snapshot = engine.getHistory().getLatestSnapshot();
        expect(snapshot).toBeDefined();
        if (snapshot) {
            expect(snapshot.correlationIndex).toBeGreaterThanOrEqual(0);
            expect(snapshot.stabilityIndex).toBeGreaterThanOrEqual(0);
        }
    });

    it('should handle SESSION_FINISHED', () => {
        const eventBus = new ObservabilityEventBus();
        const ledger = new DecisionLedger();
        
        const engine = new MultiSessionIntelligenceEngine(eventBus, ledger);
        eventBus.publish('SESSION_FINISHED', '5.0.0', 'CORR-1', 'SESSION-000', {});
        
        const snapshot = engine.getHistory().getLatestSnapshot();
        expect(snapshot).toBeDefined();
    });
});
