import { TerminalExecutionResult } from './TerminalCommand';

export class TerminalHistory {
    private readonly records: TerminalExecutionResult[] = [];
    private readonly MAX_CAPACITY = 500;

    public append(result: TerminalExecutionResult): void {
        this.records.push(result);
        if (this.records.length > this.MAX_CAPACITY) {
            this.records.shift();
        }
    }

    public getRecords(): readonly TerminalExecutionResult[] {
        return [...this.records];
    }

    public getLatest(): TerminalExecutionResult | undefined {
        if (this.records.length === 0) return undefined;
        return this.records[this.records.length - 1];
    }

    public clear(): void {
        // UI presentation view clearing can happen separately, but history structure holds records.
    }
}
