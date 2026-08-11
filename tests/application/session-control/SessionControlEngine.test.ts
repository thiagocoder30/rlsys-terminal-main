import { SessionLifecycleManager } from '../../../src/application/session-lifecycle/SessionLifecycleManager';
import { SessionLifecycleHistory } from '../../../src/application/session-lifecycle/SessionLifecycleHistory';
import { describe, it, expect, beforeEach } from 'vitest';
import { SessionControlEngine } from '../../../src/application/session-control/SessionControlEngine';
import { SessionHistory } from '../../../src/application/session-control/SessionHistory';
import { SessionStatus } from '../../../src/application/session-control/SessionState';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../../../src/application/runtime/observability/ObservableDecisionLedger';

describe('SessionControlEngine', () => {
    let engine: SessionControlEngine;
    let eventBus: ObservabilityEventBus;
    let ledger: ObservableDecisionLedger;
    let history: SessionHistory;

    beforeEach(() => {
        eventBus = new ObservabilityEventBus();
        ledger = new ObservableDecisionLedger(eventBus);
        history = new SessionHistory();
        const lm = new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger); engine = new SessionControlEngine(eventBus, ledger, history, lm); engine.lm = lm;
    });

    it('should start session correctly', () => {
        engine.startSession(1000, { provider: 'Pragmatic', minimumChipValue: 0.1 }); engine.lm.createSession('test-id'); engine.lm.startSession();
        expect(engine.getStatus()).toBe('ACTIVE');
        
        const state = engine.getCurrentState();
        expect(state.bankroll?.initial).toBe(1000);
        expect(state.bankroll?.stopLossLimit).toBe(850);
        expect(state.bankroll?.stopWinLimit).toBe(1300);
    });

    it('should trigger stop loss and finish session', () => {
        engine.startSession(1000, { provider: 'Pragmatic', minimumChipValue: 0.1 }); engine.lm.createSession('test-id'); engine.lm.startSession();
        
        engine.reportShadowTradeResult(-150);
        expect(engine.getStatus()).toBe('FINISHED');
        
        const state = engine.getCurrentState();
        expect(state.bankroll?.current).toBe(850);
        
        const hist = history.getHistory();
        expect(hist.length).toBe(1);
        expect(hist[0].stopReason).toBe('STOP_LOSS');
    });

    it('should trigger stop win and finish session', () => {
        engine.startSession(1000, { provider: 'Pragmatic', minimumChipValue: 0.1 }); engine.lm.createSession('test-id'); engine.lm.startSession();
        
        engine.reportShadowTradeResult(300);
        expect(engine.getStatus()).toBe('FINISHED');
        
        const hist = history.getHistory();
        expect(hist.length).toBe(1);
        expect(hist[0].stopReason).toBe('STOP_WIN');
    });

    it('should apply table configuration limits to stakes', () => {
        engine.startSession(1000, { provider: 'Evolution', minimumChipValue: 0.5 }); engine.lm.createSession('test-id'); engine.lm.startSession();
        
        const rec = engine.handleRecommendationGenerated({ suggestedStake: 0.2 });
        expect(rec.stake).toBe(0.5);

        const rec2 = engine.handleRecommendationGenerated({ suggestedStake: 1.2 });
        expect(rec2.stake).toBe(1.5);
    });
});
