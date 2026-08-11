import { describe, it, expect } from 'vitest';
import { MultiSessionReportService } from '../../../src/application/multisession/MultiSessionReportService';
import { MultiSessionIntelligenceEngine } from '../../../src/application/multisession/MultiSessionIntelligenceEngine';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../../../src/application/runtime/DecisionLedger';

describe('MultiSessionReportService', () => {
    it('should retrieve snapshots', () => {
        const engine = new MultiSessionIntelligenceEngine(new ObservabilityEventBus(), new DecisionLedger());
        const service = new MultiSessionReportService(engine);
        
        const history = service.getMultiSessionHistory('SESSION-000');
        expect(history).toBeDefined();
        
        const latest = service.getMultiSession('SESSION-000');
        expect(latest).toBeNull(); // No events fired yet
    });
});
