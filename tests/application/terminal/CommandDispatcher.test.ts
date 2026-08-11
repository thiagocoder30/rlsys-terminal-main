import { describe, it, expect } from 'vitest';
import { CommandDispatcher } from '../../../src/application/terminal/CommandDispatcher';
import { CommandParser } from '../../../src/application/terminal/CommandParser';
import { TerminalHistory } from '../../../src/application/terminal/TerminalHistory';

describe('CommandDispatcher', () => {
    it('should dispatch help command and return available commands output', async () => {
        const dispatcher = new CommandDispatcher();
        const cmd = CommandParser.parse('help');
        const res = await dispatcher.dispatch(cmd);

        expect(res.success).toBe(true);
        expect(res.output).toContain('[AJUDA - COMANDOS INSTITUCIONAIS]');
    });

    it('should dispatch sync command successfully', async () => {
        const dispatcher = new CommandDispatcher();
        const cmd = CommandParser.parse('sync');
        const res = await dispatcher.dispatch(cmd);

        expect(res.success).toBe(true);
        expect(res.output).toContain('[SYNC]');
    });

    it('should dispatch status command successfully', async () => {
        const dispatcher = new CommandDispatcher();
        const cmd = CommandParser.parse('status');
        const res = await dispatcher.dispatch(cmd);

        expect(res.success).toBe(true);
        expect(res.output).toContain('[STATUS INSTITUCIONAL]');
    });

    it('should dispatch history command successfully', async () => {
        const history = new TerminalHistory();
        const dispatcher = new CommandDispatcher(undefined, undefined, undefined, history);
        const cmd = CommandParser.parse('history');
        const res = await dispatcher.dispatch(cmd);

        expect(res.success).toBe(true);
        expect(res.output).toContain('[HISTORY]');
    });
});
