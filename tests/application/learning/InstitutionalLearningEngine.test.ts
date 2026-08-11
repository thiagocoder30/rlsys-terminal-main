import { describe, it, expect, vi } from 'vitest';
import { InstitutionalLearningEngine } from '../../../src/application/learning/InstitutionalLearningEngine';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../../../src/application/runtime/DecisionLedger';

describe('InstitutionalLearningEngine', () => {
    it('should calculate and store learning snapshot on events', () => {
        const eventBus = new ObservabilityEventBus();
        const ledger = new DecisionLedger();
        
        const engine = new InstitutionalLearningEngine(eventBus, ledger);
        
        eventBus.publish('KNOWLEDGE_UPDATED', '5.0.0', 'CORR-1', 'TEST', { version: '1.0' });
        
        const snapshot = engine.getHistory().getLatestSnapshot();
        expect(snapshot).toBeDefined();
        if (snapshot) {
            expect(snapshot.knowledgeScore).toBeGreaterThanOrEqual(0.5);
            expect(snapshot.overallLearningIndex).toBeGreaterThanOrEqual(0.5);
            expect(snapshot.learningStability).toBeGreaterThanOrEqual(0.5);
        }
    });
});
