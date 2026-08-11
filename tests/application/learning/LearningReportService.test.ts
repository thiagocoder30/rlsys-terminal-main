import { describe, it, expect } from 'vitest';
import { LearningReportService } from '../../../src/application/learning/LearningReportService';
import { InstitutionalLearningEngine } from '../../../src/application/learning/InstitutionalLearningEngine';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../../../src/application/runtime/DecisionLedger';

describe('LearningReportService', () => {
    it('should retrieve snapshots', () => {
        const engine = new InstitutionalLearningEngine(new ObservabilityEventBus(), new DecisionLedger());
        const service = new LearningReportService(engine);
        
        const history = service.getLearningHistory('SESSION-000');
        expect(history).toBeDefined();
        
        const latest = service.getLearningSnapshot('SESSION-000');
        expect(latest).toBeNull(); // No events fired yet
    });
});
