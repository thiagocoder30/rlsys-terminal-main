import { SessionLifecycleManager } from '../../../src/application/session-lifecycle/SessionLifecycleManager';
import { SessionLifecycleHistory } from '../../../src/application/session-lifecycle/SessionLifecycleHistory';
import { describe, it, expect } from 'vitest';
import { SessionStartupReportService } from '../../../src/application/session-startup/SessionStartupReportService';
import { SessionStartupWizard } from '../../../src/application/session-startup/SessionStartupWizard';
import { StartupProgress } from '../../../src/application/session-startup/StartupProgress';
import { StartupHistory } from '../../../src/application/session-startup/StartupHistory';
import { SessionControlEngine } from '../../../src/application/session-control/SessionControlEngine';
import { OperationalTerminal } from '../../../src/application/terminal/OperationalTerminal';
import { CommandParser } from '../../../src/application/terminal/CommandParser';
import { CommandDispatcher } from '../../../src/application/terminal/CommandDispatcher';
import { TerminalHistory } from '../../../src/application/terminal/TerminalHistory';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../../../src/application/runtime/observability/ObservableDecisionLedger';
import { SessionHistory } from '../../../src/application/session-control/SessionHistory';

describe('SessionStartupReportService', () => {
    it('should provide startup status summary and history', () => {
        const eventBus = new ObservabilityEventBus();
        const ledger = new ObservableDecisionLedger(eventBus);
        const progress = new StartupProgress();
        const history = new StartupHistory();
        const sessionControlEngine = new SessionControlEngine(eventBus, ledger, new SessionHistory(), new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger));
        const terminalHistory = new TerminalHistory();
        const dispatcher = new CommandDispatcher(sessionControlEngine, undefined, undefined, terminalHistory);
        const terminal = new OperationalTerminal(CommandParser, dispatcher, terminalHistory, eventBus, ledger);
        const wizard = new SessionStartupWizard(progress, history, sessionControlEngine, terminal, eventBus, ledger);

        const service = new SessionStartupReportService(wizard, progress, history);

        wizard.startFlow();
        wizard.selectTable('Evolution');

        const summary = service.getStartupStatus();
        expect(summary.tableProvider).toBe('Evolution');
        expect(summary.percentage).toBe(20);
        expect(summary.stepsList.length).toBe(5);

        expect(service.getStartupHistory()).toEqual([]);
    });
});
