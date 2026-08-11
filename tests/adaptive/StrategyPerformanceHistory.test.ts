import { describe, it, expect, beforeEach } from 'vitest';
import { StrategyPerformanceHistory } from '../../src/application/adaptive/StrategyPerformanceHistory';

describe('StrategyPerformanceHistory', () => {
    let history: StrategyPerformanceHistory;

    beforeEach(() => {
        history = new StrategyPerformanceHistory();
    });

    it('should initialize empty', () => {
        expect(history.getAllPerformances().length).toBe(0);
    });

    it('should record execution correctly', () => {
        history.recordExecution('strat1', true, 10, 0, 50);
        const perf = history.getPerformance('strat1');
        expect(perf).toBeDefined();
        expect(perf?.wins).toBe(1);
        expect(perf?.totalExecutions).toBe(1);
        expect(perf?.winRate).toBe(1);
        expect(perf?.cumulativeProfit).toBe(10);
    });

    it('should calculate moving averages and volatility', () => {
        history.recordExecution('strat1', true, 10, 0, 50);
        history.recordExecution('strat1', false, -5, 5, 50);
        const perf = history.getPerformance('strat1');
        expect(perf?.totalExecutions).toBe(2);
        expect(perf?.wins).toBe(1);
        expect(perf?.losses).toBe(1);
        expect(perf?.winRate).toBe(0.5);
        expect(perf?.cumulativeProfit).toBe(5);
        expect(perf?.averageProfit).toBe(2.5);
        expect(perf?.averageDrawdown).toBe(2.5);
        expect(perf?.volatility).toBeGreaterThan(0);
        expect(perf?.stability).toBeGreaterThan(0);
    });
});
