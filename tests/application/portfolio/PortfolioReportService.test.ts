import { describe, it, expect } from 'vitest';
import { PortfolioReportService } from '../../../src/application/portfolio/PortfolioReportService';
import { PortfolioIntelligenceEngine } from '../../../src/application/portfolio/PortfolioIntelligenceEngine';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../../../src/application/runtime/DecisionLedger';

describe('PortfolioReportService', () => {
    it('should retrieve snapshots and history', () => {
        const eventBus = new ObservabilityEventBus();
        const ledger = new DecisionLedger();
        const engine = new PortfolioIntelligenceEngine(eventBus, ledger);
        const service = new PortfolioReportService(engine);
        
        const history = service.getPortfolioHistory('SESSION-000');
        expect(history).toBeDefined();
        
        const latest = service.getPortfolioSnapshot('SESSION-000');
        expect(latest).toBeNull(); // No events fired yet
    });
});
