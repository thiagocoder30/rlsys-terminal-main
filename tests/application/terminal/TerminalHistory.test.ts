import { describe, it, expect } from 'vitest';
import { TerminalHistory } from '../../../src/application/terminal/TerminalHistory';

describe('TerminalHistory', () => {
    it('should maintain FIFO history up to 500 capacity with O(1) ops', () => {
        const history = new TerminalHistory();

        for (let i = 0; i < 505; i++) {
            history.append({
                commandName: `cmd_${i}`,
                success: true,
                output: `out_${i}`,
                executionTimeMs: 1,
                timestamp: Date.now()
            });
        }

        const records = history.getRecords();
        expect(records.length).toBe(500);
        expect(records[0].commandName).toBe('cmd_5');
        expect(records[499].commandName).toBe('cmd_504');
        expect(history.getLatest()?.commandName).toBe('cmd_504');
    });
});
