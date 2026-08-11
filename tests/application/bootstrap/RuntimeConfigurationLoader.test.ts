import { SessionLifecycleManager } from '../../../src/application/session-lifecycle/SessionLifecycleManager';
import { SessionLifecycleHistory } from '../../../src/application/session-lifecycle/SessionLifecycleHistory';
import { describe, it, expect, beforeEach } from 'vitest';
import { RuntimeConfigurationLoader } from '../../../src/application/bootstrap/RuntimeConfigurationLoader';
import { ConfigurationEngine } from '../../../src/application/configuration/ConfigurationEngine';
import { ConfigurationHistory } from '../../../src/application/configuration/ConfigurationHistory';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../../../src/application/runtime/observability/ObservableDecisionLedger';
import { SessionControlEngine } from '../../../src/application/session-control/SessionControlEngine';
import { SessionHistory } from '../../../src/application/session-control/SessionHistory';

describe('RuntimeConfigurationLoader', () => {
    let configEngine: ConfigurationEngine;
    let sessionControlEngine: SessionControlEngine;

    beforeEach(() => {
        const history = new ConfigurationHistory();
        const eventBus = new ObservabilityEventBus();
        const ledger = new ObservableDecisionLedger();
        configEngine = new ConfigurationEngine(history, eventBus, ledger);

        const sessionHistory = new SessionHistory();
        sessionControlEngine = new SessionControlEngine(eventBus, ledger, sessionHistory, new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger));
    });

    it('deve carregar estado do ConfigurationEngine', () => {
        configEngine.setProvider('EVOLUTION');
        configEngine.setBankroll(2500);

        const state = RuntimeConfigurationLoader.loadState(configEngine, sessionControlEngine);
        expect(state.provider).toBe('EVOLUTION');
        expect(state.minimumChipValue).toBe(0.50);
        expect(state.initialBankroll).toBe(2500);
        expect(state.configured).toBe(true);
    });
});
