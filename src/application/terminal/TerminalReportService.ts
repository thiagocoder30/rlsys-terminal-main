import { TerminalHistory } from './TerminalHistory';
import { CommandParser } from './CommandParser';
import { TerminalExecutionResult } from './TerminalCommand';

export class TerminalReportService {
    constructor(private readonly history: TerminalHistory) {}

    public getAvailableCommands(): readonly string[] {
        return CommandParser.VALID_COMMANDS;
    }

    public getCommandHistory(): readonly TerminalExecutionResult[] {
        return this.history.getRecords();
    }

    public getTerminalStatusSummary() {
        const records = this.history.getRecords();
        const totalExecuted = records.length;
        const successful = records.filter(r => r.success).length;
        const failed = totalExecuted - successful;
        const latest = this.history.getLatest();

        return {
            totalExecuted,
            successful,
            failed,
            availableCommandsCount: CommandParser.VALID_COMMANDS.length,
            latestCommand: latest ? latest.commandName : null,
            latestOutput: latest ? latest.output : null
        };
    }
}
