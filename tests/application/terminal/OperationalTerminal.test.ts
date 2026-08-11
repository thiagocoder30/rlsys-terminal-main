import { describe, it, expect } from 'vitest';
import { OperationalTerminal } from '../../../src/application/terminal/OperationalTerminal';
import { CommandParser } from '../../../src/application/terminal/CommandParser';
import { CommandDispatcher } from '../../../src/application/terminal/CommandDispatcher';
import { TerminalHistory } from '../../../src/application/terminal/TerminalHistory';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../../../src/application/runtime/observability/ObservableDecisionLedger';

describe('OperationalTerminal', () => {
    it('should execute valid command, record in ledger, publish event and append to history', async () => {
        const eventBus = new ObservabilityEventBus();
        const ledger = new ObservableDecisionLedger(eventBus);
        const history = new TerminalHistory();
        const dispatcher = new CommandDispatcher(undefined, undefined, undefined, history);

        let eventFired = false;
        eventBus.subscribe('TERMINAL_COMMAND_EXECUTED', () => {
            eventFired = true;
        });

        const terminal = new OperationalTerminal(CommandParser, dispatcher, history, eventBus, ledger);
        const res = await terminal.executeCommand('sync', 'OP-001');

        expect(res.success).toBe(true);
        expect(res.commandName).toBe('sync');
        expect(eventFired).toBe(true);

        const recs = terminal.getHistory();
        expect(recs.length).toBe(1);
    });

    it('should handle invalid command gracefully without throwing unhandled error', async () => {
        const eventBus = new ObservabilityEventBus();
        const ledger = new ObservableDecisionLedger(eventBus);
        const history = new TerminalHistory();
        const dispatcher = new CommandDispatcher(undefined, undefined, undefined, history);

        const terminal = new OperationalTerminal(CommandParser, dispatcher, history, eventBus, ledger);
        const res = await terminal.executeCommand('xyz', 'OP-001');

        expect(res.success).toBe(false);
        expect(res.output).toContain('Comando desconhecido');
    });
});
