import { describe, it, expect, beforeEach } from 'vitest';
import { SessionStartupWizard } from '../../src/application/session-startup/SessionStartupWizard';
import { StartupProgress } from '../../src/application/session-startup/StartupProgress';
import { StartupHistory } from '../../src/application/session-startup/StartupHistory';
import { SessionControlEngine } from '../../src/application/session-control/SessionControlEngine';
import { OperationalTerminal } from '../../src/application/terminal/OperationalTerminal';
import { ObservabilityEventBus } from '../../src/application/runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../../src/application/runtime/observability/ObservableDecisionLedger';
import { CommandParser } from '../../src/application/terminal/CommandParser';
import { CommandDispatcher } from '../../src/application/terminal/CommandDispatcher';
import { TerminalHistory } from '../../src/application/terminal/TerminalHistory';

describe('StartupWizard', () => {
    let wizard: SessionStartupWizard;
    let terminal: OperationalTerminal;
    
    beforeEach(() => {
        const progress = new StartupProgress();
        const history = new StartupHistory();
        const bus = new ObservabilityEventBus();
        const ledger = new ObservableDecisionLedger();
        
        const mockLifecycleManager = {
            getCurrentState: () => 'INACTIVE',
            startSession: () => {},
            finishSession: () => {},
            existsActiveSession: () => false
        };

        const sessionHistory = { append: () => {} };
        const sessionControl = new SessionControlEngine(bus, ledger, sessionHistory as any, mockLifecycleManager as any);
        terminal = new OperationalTerminal(CommandParser as any, new CommandDispatcher({} as any), new TerminalHistory(), bus, ledger);
        wizard = new SessionStartupWizard(progress, history, sessionControl as any, terminal, bus, ledger);
    });

    it('should be completely server-driven', async () => {
        wizard.startFlow();
        expect(wizard.getCurrentState()).toBe('SELECTING_TABLE');
        
        wizard.selectTable('Pragmatic');
        expect(wizard.getCurrentState()).toBe('CONFIGURING_BANKROLL');
        
        wizard.configureBankroll(1000);
        expect(wizard.getCurrentState()).toBe('SYNCING_HISTORY');
    });

    it('should block if sync fails', async () => {
        wizard.startFlow();
        wizard.selectTable('Pragmatic');
        wizard.configureBankroll(1000);
        
        // Pass empty array to simulate failure
        const success = await wizard.executeSync([]);
        expect(success).toBe(false);
        // It should remain on SYNCING_HISTORY
        expect(wizard.getCurrentState()).toBe('SYNCING_HISTORY');
    });

    it('should advance if sync passes', async () => {
        wizard.startFlow();
        wizard.selectTable('Pragmatic');
        wizard.configureBankroll(1000);
        
        // Pass 200 items to pass
        const arr = new Array(200).fill(0);
        const success = await wizard.executeSync(arr);
        expect(success).toBe(true);
        expect(wizard.getCurrentState()).toBe('RUNNING_WARMUP');
    });
});
