import { describe, it, expect } from 'vitest';
import { StrategyEvolutionGovernanceEngine } from '../../../src/application/evolution-governance/StrategyEvolutionGovernanceEngine';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../../../src/application/runtime/DecisionLedger';

describe('StrategyEvolutionGovernanceEngine', () => {
    it('should evaluate and create snapshots', () => {
        const eventBus = new ObservabilityEventBus();
        const ledger = new DecisionLedger();
        const engine = new StrategyEvolutionGovernanceEngine(eventBus, ledger);
        
        eventBus.publish('SESSION_PERFORMANCE_UPDATED', '5.0.0', 'CORR-1', 'SESSION-000', {});
        
        const history = engine.getHistory();
        const latest = history.getLatestSnapshot();
        expect(latest).toBeDefined();
        if (latest) {
            expect(latest.recommendations.length).toBeGreaterThan(0);
        }
    });
});
