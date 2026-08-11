import { describe, it, expect } from 'vitest';
import { EnsembleSnapshotManager } from '../../src/application/ensemble/EnsembleSnapshotManager';

describe('EnsembleSnapshotManager', () => {
    it('should keep track of snapshots and metrics', () => {
        const manager = new EnsembleSnapshotManager();
        manager.append({
            consensusId: '1',
            timestampUtc: new Date().toISOString(),
            votes: [],
            dominantStrategy: { strategyId: 'S1', weight: 1, confidence: 90 },
            score: { value: 1, level: 'STRONG' },
            conflictLevel: 'LOW',
            agreement: { score: 75, percentage: 75 }
        });

        expect(manager.getHistory().length).toBe(1);
        expect(manager.getLatest()?.consensusId).toBe('1');
        
        const metrics = manager.getMetrics();
        expect(metrics.totalDecisions).toBe(1);
        expect(metrics.consensusRate).toBe(100);
        expect(metrics.ensembleConfidence).toBe(90);
    });
});
