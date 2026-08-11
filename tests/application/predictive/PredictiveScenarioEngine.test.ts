import { describe, it, expect } from 'vitest';
import { PredictiveScenarioEngine } from '../../../src/application/predictive/PredictiveScenarioEngine';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../../../src/application/runtime/DecisionLedger';

describe('PredictiveScenarioEngine', () => {
    it('should generate scenarios on events', () => {
        const eventBus = new ObservabilityEventBus();
        const ledger = new DecisionLedger();
        
        const engine = new PredictiveScenarioEngine(eventBus, ledger);
        eventBus.publish('MARKET_REGIME_UPDATED', '5.0.0', 'CORR-1', 'SESSION-000', { regime: 'TRENDING' });
        
        const snapshot = engine.getHistory().getLatestSnapshot();
        expect(snapshot).toBeDefined();
        if (snapshot) {
            expect(snapshot.dominantScenario).toBeDefined();
            expect(snapshot.confidence).toBeGreaterThanOrEqual(0);
        }
    });
});
