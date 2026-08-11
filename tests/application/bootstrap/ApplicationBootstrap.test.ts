import { SessionLifecycleManager } from '../../../src/application/session-lifecycle/SessionLifecycleManager';
import { SessionLifecycleHistory } from '../../../src/application/session-lifecycle/SessionLifecycleHistory';
import { describe, it, expect, beforeEach } from 'vitest';
import { ApplicationBootstrap } from '../../../src/application/bootstrap/ApplicationBootstrap';
import { ConfigurationEngine } from '../../../src/application/configuration/ConfigurationEngine';
import { ConfigurationHistory } from '../../../src/application/configuration/ConfigurationHistory';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../../../src/application/runtime/observability/ObservableDecisionLedger';
import { SessionControlEngine } from '../../../src/application/session-control/SessionControlEngine';
import { SessionHistory } from '../../../src/application/session-control/SessionHistory';
import { SessionStartupWizard } from '../../../src/application/session-startup/SessionStartupWizard';
import { StartupProgress } from '../../../src/application/session-startup/StartupProgress';
import { StartupHistory } from '../../../src/application/session-startup/StartupHistory';
import { OperationalTerminal } from '../../../src/application/terminal/OperationalTerminal';
import { TerminalHistory } from '../../../src/application/terminal/TerminalHistory';
import { CommandDispatcher } from '../../../src/application/terminal/CommandDispatcher';
import { CommandParser } from '../../../src/application/terminal/CommandParser';

describe('ApplicationBootstrap', () => {
    let configEngine: ConfigurationEngine;
    let sessionControlEngine: SessionControlEngine;
    let wizard: SessionStartupWizard;
    let eventBus: ObservabilityEventBus;
    let ledger: ObservableDecisionLedger;
    let bootstrap: ApplicationBootstrap;
    let eventsEmitted: string[];

    beforeEach(() => {
        const configHistory = new ConfigurationHistory();
        eventBus = new ObservabilityEventBus();
        ledger = new ObservableDecisionLedger();
        configEngine = new ConfigurationEngine(configHistory, eventBus, ledger);

        const sessionHistory = new SessionHistory();
        const lm = new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger); sessionControlEngine = new SessionControlEngine(eventBus, ledger, sessionHistory, lm); sessionControlEngine.lm = lm;

        const terminalHistory = new TerminalHistory();
        const dispatcher = new CommandDispatcher(sessionControlEngine, undefined, undefined, terminalHistory);
        const terminal = new OperationalTerminal(CommandParser, dispatcher, terminalHistory, eventBus, ledger);

        wizard = new SessionStartupWizard(
            new StartupProgress(),
            new StartupHistory(),
            sessionControlEngine,
            terminal,
            eventBus,
            ledger,
            configEngine
        );

        bootstrap = new ApplicationBootstrap(
            configEngine,
            sessionControlEngine,
            wizard,
            new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger),
            eventBus,
            ledger
        );

        eventsEmitted = [];
        eventBus.subscribe('BOOTSTRAP_STARTED', () => eventsEmitted.push('BOOTSTRAP_STARTED'));
        eventBus.subscribe('CONFIGURATION_LOADED', () => eventsEmitted.push('CONFIGURATION_LOADED'));
        eventBus.subscribe('CONFIGURATION_VALIDATED', () => eventsEmitted.push('CONFIGURATION_VALIDATED'));
        eventBus.subscribe('RUNTIME_CONFIGURATION_READY', () => eventsEmitted.push('RUNTIME_CONFIGURATION_READY'));
        eventBus.subscribe('BANKROLL_STATE_SYNCHRONIZED', () => eventsEmitted.push('BANKROLL_STATE_SYNCHRONIZED'));
        eventBus.subscribe('PROVIDER_STATE_SYNCHRONIZED', () => eventsEmitted.push('PROVIDER_STATE_SYNCHRONIZED'));
    });

    it('deve executar o bootstrap e emitir os eventos institucionais', () => {
        configEngine.setProvider('EVOLUTION');
        configEngine.setBankroll(2500);

        const state = bootstrap.bootstrap();
        expect(state.provider).toBe('EVOLUTION');
        expect(state.initialBankroll).toBe(2500);
        expect(bootstrap.getStatus().currentState).toBe('READY_FOR_SESSION');

        expect(eventsEmitted).toContain('BOOTSTRAP_STARTED');
        expect(eventsEmitted).toContain('CONFIGURATION_LOADED');
        expect(eventsEmitted).toContain('CONFIGURATION_VALIDATED');
        expect(eventsEmitted).toContain('BANKROLL_STATE_SYNCHRONIZED');
        expect(eventsEmitted).toContain('PROVIDER_STATE_SYNCHRONIZED');
        expect(eventsEmitted).toContain('RUNTIME_CONFIGURATION_READY');
    });

    it('deve sincronizar a banca e o provedor com o SessionControlEngine', () => {
        configEngine.setProvider('PRAGMATIC');
        configEngine.setBankroll(1500);
        sessionControlEngine.startSession(1000, { provider: 'Pragmatic', minimumChipValue: 0.10 }); sessionControlEngine.lm.createSession('test-id'); sessionControlEngine.lm.startSession();

        bootstrap.syncRuntime();
        const sessionState = sessionControlEngine.getCurrentState();
        expect(sessionState.bankroll?.current).toBe(1500);
        expect(sessionControlEngine.getTableConfig()?.provider).toBe('Pragmatic');
    });
});
