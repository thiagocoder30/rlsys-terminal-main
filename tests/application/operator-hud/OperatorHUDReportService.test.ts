import { SessionLifecycleManager } from '../../../src/application/session-lifecycle/SessionLifecycleManager';
import { SessionLifecycleHistory } from '../../../src/application/session-lifecycle/SessionLifecycleHistory';
import { describe, it, expect } from 'vitest';
import { OperatorHUDReportService } from '../../../src/application/operator-hud/OperatorHUDReportService';
import { OperatorHUDBuilder } from '../../../src/application/operator-hud/OperatorHUDBuilder';
import { SessionControlEngine } from '../../../src/application/session-control/SessionControlEngine';
import { SessionHistory } from '../../../src/application/session-control/SessionHistory';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../../../src/application/runtime/observability/ObservableDecisionLedger';

describe('OperatorHUDReportService', () => {
    it('should return snapshot', () => {
        const eventBus = new ObservabilityEventBus();
        const ledger = new ObservableDecisionLedger(eventBus);
        const sessionHistory = new SessionHistory();
        const sessionControlEngine = new SessionControlEngine(eventBus, ledger, sessionHistory, new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger));
        const builder = new OperatorHUDBuilder(sessionControlEngine);
        const service = new OperatorHUDReportService(builder);

        sessionControlEngine.startSession(1000, { provider: 'Pragmatic', minimumChipValue: 0.1 });

        service.updateSnapshot('Dozen 1', 'HIGH', 10, 0.5, 'Dozen 1');
        const snapshot = service.getCurrentSnapshot();
        
        expect(snapshot).toBeDefined();
        expect(snapshot?.data.strategySuggestion).toBe('Dozen 1');
    });
});
