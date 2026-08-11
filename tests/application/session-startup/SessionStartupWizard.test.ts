import { SessionLifecycleManager } from '../../../src/application/session-lifecycle/SessionLifecycleManager';
import { SessionLifecycleHistory } from '../../../src/application/session-lifecycle/SessionLifecycleHistory';
import { describe, it, expect } from 'vitest';
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

describe('SessionStartupWizard', () => {
    it('should execute full startup flow successfully', async () => {
        const eventBus = new ObservabilityEventBus();
        const ledger = new ObservableDecisionLedger(eventBus);
        const progress = new StartupProgress();
        const history = new StartupHistory();
        const sessionHistory = new SessionHistory();
        const lm = new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger); const sessionControlEngine = new SessionControlEngine(eventBus, ledger, sessionHistory, lm); sessionControlEngine.lm = lm;

        const terminalHistory = new TerminalHistory();
        const dispatcher = new CommandDispatcher(sessionControlEngine, undefined, undefined, terminalHistory);
        const terminal = new OperationalTerminal(CommandParser, dispatcher, terminalHistory, eventBus, ledger);

        const wizard = new SessionStartupWizard(progress, history, sessionControlEngine, terminal, eventBus, ledger);

        wizard.startFlow('OP-001');
        expect(wizard.getCurrentState()).toBe('SELECTING_TABLE');

        wizard.selectTable('Pragmatic', 'OP-001');
        expect(wizard.getSelectedTable()).toBe('Pragmatic');

        wizard.configureBankroll(1000, 'OP-001');
        expect(wizard.getConfiguredBankroll()).toBe(1000);

        const syncOk = await wizard.executeSync(new Array(200).fill(0), 'OP-001');
        expect(syncOk).toBe(true);

        const warmupOk = await wizard.executeWarmup('OP-001');
        expect(warmupOk).toBe(true);

        const finishOk = wizard.validateAndFinish('OP-001');
        expect(finishOk).toBe(true);
        expect(wizard.getCurrentState()).toBe('READY');

        expect(history.getRecords().length).toBe(1);
        expect(history.getLatest()?.result).toBe('SUCCESS');
    });
});
