import { SessionLifecycleManager } from '../../../src/application/session-lifecycle/SessionLifecycleManager';
import { SessionLifecycleHistory } from '../../../src/application/session-lifecycle/SessionLifecycleHistory';
import { describe, it, expect } from 'vitest';
import { SessionReportService } from '../../../src/application/session-control/SessionReportService';
import { SessionControlEngine } from '../../../src/application/session-control/SessionControlEngine';
import { SessionHistory } from '../../../src/application/session-control/SessionHistory';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../../../src/application/runtime/observability/ObservableDecisionLedger';

describe('SessionReportService', () => {
    it('should return current state and history', () => {
        const eventBus = new ObservabilityEventBus();
        const ledger = new ObservableDecisionLedger(eventBus);
        const history = new SessionHistory();
        const lm = new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger); const engine = new SessionControlEngine(eventBus, ledger, history, lm); engine.lm = lm;
        const service = new SessionReportService(engine, history);

        engine.startSession(1000, { provider: 'Pragmatic', minimumChipValue: 0.1 }); engine.lm.createSession('test-id'); engine.lm.startSession();
        
        const state = service.getCurrentSessionState();
        expect(state.bankroll?.initial).toBe(1000);

        engine.finishSession('MANUAL');

        const hist = service.getSessionHistory();
        expect(hist.length).toBe(1);
    });
});
