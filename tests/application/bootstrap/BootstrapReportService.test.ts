import { SessionLifecycleManager } from '../../../src/application/session-lifecycle/SessionLifecycleManager';
import { SessionLifecycleHistory } from '../../../src/application/session-lifecycle/SessionLifecycleHistory';
import { describe, it, expect, beforeEach } from 'vitest';
import { ApplicationBootstrap } from '../../../src/application/bootstrap/ApplicationBootstrap';
import { BootstrapReportService } from '../../../src/application/bootstrap/BootstrapReportService';
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

describe('BootstrapReportService', () => {
    let bootstrap: ApplicationBootstrap;
    let reportService: BootstrapReportService;

    beforeEach(() => {
        const history = new ConfigurationHistory();
        const eventBus = new ObservabilityEventBus();
        const ledger = new ObservableDecisionLedger();
        const configEngine = new ConfigurationEngine(history, eventBus, ledger);

        const sessionHistory = new SessionHistory();
        const lm = new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger); const sessionControlEngine = new SessionControlEngine(eventBus, ledger, sessionHistory, lm); sessionControlEngine.lm = lm;
        const terminalHistory = new TerminalHistory();
        const dispatcher = new CommandDispatcher(sessionControlEngine, undefined, undefined, terminalHistory);
        const terminal = new OperationalTerminal(CommandParser, dispatcher, terminalHistory, eventBus, ledger);

        const wizard = new SessionStartupWizard(
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

        reportService = new BootstrapReportService(bootstrap);
    });

    it('deve gerar relatório do status de bootstrap', () => {
        bootstrap.bootstrap();
        const report = reportService.getReport();
        expect(report.currentState).toBeDefined();
        expect(report.decision).toBeDefined();
        expect(report.timestamp).toBeGreaterThan(0);
    });
});
