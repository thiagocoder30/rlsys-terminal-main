import { SessionLifecycleManager } from '../../../src/application/session-lifecycle/SessionLifecycleManager';
import { SessionLifecycleHistory } from '../../../src/application/session-lifecycle/SessionLifecycleHistory';
import { describe, it, expect } from 'vitest';
import { OperatorHUDBuilder } from '../../../src/application/operator-hud/OperatorHUDBuilder';
import { SessionControlEngine } from '../../../src/application/session-control/SessionControlEngine';
import { SessionHistory } from '../../../src/application/session-control/SessionHistory';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../../../src/application/runtime/observability/ObservableDecisionLedger';

describe('OperatorHUDBuilder', () => {
    it('should build correct snapshot', () => {
        const eventBus = new ObservabilityEventBus();
        const ledger = new ObservableDecisionLedger(eventBus);
        const sessionHistory = new SessionHistory();
        const sessionControlEngine = new SessionControlEngine(eventBus, ledger, sessionHistory, new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger));
        const builder = new OperatorHUDBuilder(sessionControlEngine);

        sessionControlEngine.startSession(1000, { provider: 'Pragmatic', minimumChipValue: 0.1 });

        const snapshot = builder.buildSnapshot('Dozen 2', 'HIGH', 10, 0.5, 'Dozen 2');

        expect(snapshot.data.bankroll).toBe(1000);
        expect(snapshot.data.strategySuggestion).toBe('Dozen 2');
        expect(snapshot.data.stakeValue).toBe(10);
        expect(snapshot.data.chipValue).toBe(0.5);
        expect(snapshot.data.selectedTarget).toBe('Dozen 2');
        expect(snapshot.hash).toBeDefined();

        // Immutability
        expect(Object.isFrozen(snapshot)).toBe(true);
        expect(Object.isFrozen(snapshot.data)).toBe(true);
    });
});
