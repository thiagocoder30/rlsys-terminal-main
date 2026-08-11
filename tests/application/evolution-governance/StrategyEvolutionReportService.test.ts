import { describe, it, expect } from 'vitest';
import { StrategyEvolutionReportService } from '../../../src/application/evolution-governance/StrategyEvolutionReportService';
import { StrategyEvolutionGovernanceEngine } from '../../../src/application/evolution-governance/StrategyEvolutionGovernanceEngine';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../../../src/application/runtime/DecisionLedger';

describe('StrategyEvolutionReportService', () => {
    it('should return snapshots and history', () => {
        const eventBus = new ObservabilityEventBus();
        const ledger = new DecisionLedger();
        const engine = new StrategyEvolutionGovernanceEngine(eventBus, ledger);
        const service = new StrategyEvolutionReportService(engine);
        
        eventBus.publish('SESSION_PERFORMANCE_UPDATED', '5.0.0', 'CORR-1', 'SESSION-000', {});
        
        expect(service.getStrategyEvolution()).toBeDefined();
        expect(service.getStrategyEvolutionHistory().length).toBeGreaterThan(0);
    });
});
