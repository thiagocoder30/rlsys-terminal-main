import { describe, it, expect } from 'vitest';
import { AdaptiveConfidenceEngine } from '../../src/application/adaptive/AdaptiveConfidenceEngine';
import { StrategyPerformanceHistory } from '../../src/application/adaptive/StrategyPerformanceHistory';
import { DecisionLedger } from '../../src/application/runtime/DecisionLedger';
import { RuntimeTelemetry } from '../../src/application/runtime/RuntimeTelemetry';

describe('AdaptiveConfidenceEngine', () => {
    it('should evaluate default confidence for new strategy', () => {
        const history = new StrategyPerformanceHistory();
        const telemetry = new RuntimeTelemetry();
        const ledger = new DecisionLedger();
        const engine = new AdaptiveConfidenceEngine(ledger, telemetry, history);
        
        const conf = engine.evaluateConfidence('new');
        expect(conf.score.value).toBe(50);
        expect(conf.score.level).toBe('MEDIUM');
    });

    it('should evaluate confidence correctly based on performance', () => {
        const history = new StrategyPerformanceHistory();
        const telemetry = new RuntimeTelemetry();
        const ledger = new DecisionLedger();
        
        history.recordExecution('strat1', true, 10, 0, 50);
        history.recordExecution('strat1', true, 10, 0, 50);
        
        const engine = new AdaptiveConfidenceEngine(ledger, telemetry, history);
        const conf = engine.evaluateConfidence('strat1');
        
        expect(conf.score.value).toBeGreaterThan(50);
        expect(conf.trend).toBe('UP');
    });
});
