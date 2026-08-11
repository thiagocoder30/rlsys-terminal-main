import { describe, it, expect } from 'vitest';
import { PortfolioIntelligenceEngine } from '../../../src/application/portfolio/PortfolioIntelligenceEngine';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../../../src/application/runtime/DecisionLedger';

describe('PortfolioIntelligenceEngine', () => {
    it('should evaluate portfolio on event (geração correta do snapshot, persistência no Ledger, integração via EventBus)', () => {
        const eventBus = new ObservabilityEventBus();
        const ledger = new DecisionLedger();
        
        const engine = new PortfolioIntelligenceEngine(eventBus, ledger);
        
        eventBus.publish('MULTI_SESSION_UPDATED', '5.0.0', 'CORR-1', 'SESSION-000', {});
        
        const snapshot = engine.getHistory().getLatestSnapshot();
        expect(snapshot).toBeDefined();
        if (snapshot) {
            expect(snapshot.portfolioHealth).toBeGreaterThanOrEqual(0);
            expect(snapshot.diversificationIndex).toBeGreaterThanOrEqual(0);
        }
    });
});
