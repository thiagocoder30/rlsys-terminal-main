import { describe, it, expect } from 'vitest';
import { PredictiveReportService } from '../../../src/application/predictive/PredictiveReportService';
import { PredictiveScenarioEngine } from '../../../src/application/predictive/PredictiveScenarioEngine';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../../../src/application/runtime/DecisionLedger';

describe('PredictiveReportService', () => {
    it('should retrieve snapshots', () => {
        const engine = new PredictiveScenarioEngine(new ObservabilityEventBus(), new DecisionLedger());
        const service = new PredictiveReportService(engine);
        
        const history = service.getPredictiveHistory('SESSION-000');
        expect(history).toBeDefined();
        
        const latest = service.getPredictiveScenario('SESSION-000');
        expect(latest).toBeNull(); // No events fired yet
    });
});
