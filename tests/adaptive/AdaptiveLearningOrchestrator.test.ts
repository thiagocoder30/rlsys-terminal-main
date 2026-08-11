import { describe, it, expect } from 'vitest';
import { AdaptiveLearningOrchestrator } from '../../src/application/adaptive/AdaptiveLearningOrchestrator';
import { ObservabilityEventBus } from '../../src/application/runtime/observability/ObservabilityEventBus';
import { AdaptiveConfidenceEngine } from '../../src/application/adaptive/AdaptiveConfidenceEngine';
import { ConfidenceSnapshotManager } from '../../src/application/adaptive/ConfidenceSnapshotManager';
import { StrategyPerformanceHistory } from '../../src/application/adaptive/StrategyPerformanceHistory';
import { RuntimeTelemetry } from '../../src/application/runtime/RuntimeTelemetry';
import { StrategyConfidenceRepository } from '../../src/application/adaptive/StrategyConfidenceRepository';
import { DecisionLedger } from '../../src/application/runtime/DecisionLedger';

describe('AdaptiveLearningOrchestrator', () => {
    it('should listen to SnapshotCreated and process execution', () => {
        const eventBus = new ObservabilityEventBus();
        const telemetry = new RuntimeTelemetry();
        const ledger = new DecisionLedger();
        const history = new StrategyPerformanceHistory();
        const engine = new AdaptiveConfidenceEngine(ledger, telemetry, history);
        const repo = new StrategyConfidenceRepository();
        const snapshotManager = new ConfidenceSnapshotManager(repo);
        
        new AdaptiveLearningOrchestrator(eventBus, engine, snapshotManager, history, telemetry, repo);
        
        eventBus.publish('SnapshotCreated', '1', 'corr', 'sess', {
            snapshotTimeMs: 10,
            snapshot: {
                shadowPnL: { 'strat1': 10 }
            }
        });
        
        expect(history.getPerformance('strat1')?.wins).toBe(1);
        expect(repo.getCount()).toBe(1);
    });
});
