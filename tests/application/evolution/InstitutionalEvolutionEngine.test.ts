import { describe, it, expect } from 'vitest';
import { InstitutionalEvolutionEngine } from '../../../src/application/evolution/InstitutionalEvolutionEngine';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../../../src/application/runtime/DecisionLedger';

describe('InstitutionalEvolutionEngine', () => {
    it('should generate a snapshot when receiving events', () => {
        const eventBus = new ObservabilityEventBus();
        const ledger = new DecisionLedger();
        
        const engine = new InstitutionalEvolutionEngine(eventBus, ledger);
        eventBus.publish('SESSION_PERFORMANCE_UPDATED', '5.0.0', 'CORR-1', 'SESSION-000', {});
        
        const history = engine.getHistory();
        expect(history.getLatestSnapshot()).not.toBeNull();
    });
});
