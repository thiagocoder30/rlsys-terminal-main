import { describe, it, expect, beforeEach } from 'vitest';
import { StrategyConfidenceRepository } from '../../src/application/adaptive/StrategyConfidenceRepository';

describe('StrategyConfidenceRepository', () => {
    let repo: StrategyConfidenceRepository;

    beforeEach(() => {
        repo = new StrategyConfidenceRepository();
    });

    it('should append and retrieve latest', () => {
        repo.append('strat1', { strategyId: 'strat1', score: { value: 80, level: 'HIGH' }, trend: 'UP', volatility: 10, stability: 90, recovery: 100, lastUpdated: 0 });
        repo.append('strat1', { strategyId: 'strat1', score: { value: 85, level: 'HIGH' }, trend: 'UP', volatility: 10, stability: 90, recovery: 100, lastUpdated: 1 });
        
        expect(repo.getCount()).toBe(2);
        const latest = repo.getLatest('strat1');
        expect(latest?.score.value).toBe(85);
    });
});
