export interface TerminalCommand {
    rawCommand: string;
    commandName: string;
    args: string[];
    timestamp: number;
}

export interface TerminalExecutionResult {
    commandName: string;
    success: boolean;
    output: string;
    executionTimeMs: number;
    timestamp: number;
}
