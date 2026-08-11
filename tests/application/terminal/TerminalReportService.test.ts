import { describe, it, expect } from 'vitest';
import { TerminalReportService } from '../../../src/application/terminal/TerminalReportService';
import { TerminalHistory } from '../../../src/application/terminal/TerminalHistory';

describe('TerminalReportService', () => {
    it('should provide available commands and status summary', () => {
        const history = new TerminalHistory();
        history.append({
            commandName: 'sync',
            success: true,
            output: '[SYNC] Complete',
            executionTimeMs: 5,
            timestamp: Date.now()
        });

        const service = new TerminalReportService(history);
        expect(service.getAvailableCommands().length).toBe(8);

        const summary = service.getTerminalStatusSummary();
        expect(summary.totalExecuted).toBe(1);
        expect(summary.successful).toBe(1);
        expect(summary.latestCommand).toBe('sync');
    });
});
