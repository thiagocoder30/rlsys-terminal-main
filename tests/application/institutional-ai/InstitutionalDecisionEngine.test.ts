import { describe, it, expect, beforeEach } from 'vitest';
import { InstitutionalDecisionEngine } from '../../../src/application/institutional-ai/InstitutionalDecisionEngine';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../../../src/application/runtime/observability/ObservableDecisionLedger';

describe('InstitutionalDecisionEngine (IADL)', () => {
    let eventBus: ObservabilityEventBus;
    let ledger: ObservableDecisionLedger;
    let engine: InstitutionalDecisionEngine;

    beforeEach(() => {
        eventBus = new ObservabilityEventBus();
        ledger = new ObservableDecisionLedger(eventBus);
        engine = new InstitutionalDecisionEngine(eventBus, ledger);
    });

    it('should generate a snapshot when SESSION_PERFORMANCE_UPDATED is emitted', () => {
        eventBus.publish('SESSION_PERFORMANCE_UPDATED', '5.0.0', 'uuid-1', 'SESSION-123', {
            accuracy: 0.9,
            profit: 100
        });

        const snapshot = engine.getHistory().getLatestSnapshot();
        expect(snapshot).not.toBeNull();
        expect(snapshot?.snapshotId).toBeDefined();
        expect(snapshot?.overallIntelligenceScore).toBeGreaterThanOrEqual(0);
        expect(snapshot?.overallIntelligenceScore).toBeLessThanOrEqual(1);
        expect(snapshot?.institutionalConfidence).toBeGreaterThanOrEqual(0);
        expect(snapshot?.institutionalConsensus).toBeGreaterThanOrEqual(0);
        expect(snapshot?.institutionalHealth).toBeGreaterThanOrEqual(0);
    });

    it('should calculate confidence based on learning and evolution indexes', () => {
        eventBus.publish('LEARNING_SNAPSHOT_CREATED', '5.0.0', 'uuid-1', 'SESSION-123', {
            overallLearningIndex: 0.8
        });
        eventBus.publish('EVOLUTION_SNAPSHOT_CREATED', '5.0.0', 'uuid-1', 'SESSION-123', {
            institutionalIntelligenceIndex: 0.8
        });
        
        eventBus.publish('SESSION_PERFORMANCE_UPDATED', '5.0.0', 'uuid-1', 'SESSION-123', {});
        
        const snapshot = engine.getHistory().getLatestSnapshot();
        expect(snapshot?.learningIndex).toBe(0.8);
        expect(snapshot?.evolutionIndex).toBe(0.8);
        expect(snapshot?.institutionalConfidence).toBeGreaterThan(0.1);
    });
});
