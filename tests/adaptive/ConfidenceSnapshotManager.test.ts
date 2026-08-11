import { describe, it, expect, beforeEach } from 'vitest';
import { ConfidenceSnapshotManager } from '../../src/application/adaptive/ConfidenceSnapshotManager';
import { StrategyConfidenceRepository } from '../../src/application/adaptive/StrategyConfidenceRepository';

describe('ConfidenceSnapshotManager', () => {
    it('should create and retrieve snapshot', () => {
        const repo = new StrategyConfidenceRepository();
        const manager = new ConfidenceSnapshotManager(repo);
        
        manager.createSnapshot({ strategyId: 'test', score: { value: 50, level: 'MEDIUM' }, trend: 'STABLE', volatility: 0, stability: 100, recovery: 100, lastUpdated: 0 });
        expect(manager.getHistory('test').length).toBe(1);
        expect(manager.getLatestSnapshot('test')?.score.value).toBe(50);
    });
});
