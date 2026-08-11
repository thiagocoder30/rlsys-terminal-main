import { TableProvider } from './StartupFlow';

export interface StartupRecord {
    timestamp: number;
    tableProvider: TableProvider | null;
    bankroll: number;
    executionTimeMs: number;
    result: 'SUCCESS' | 'FAILED';
    failureReason?: string;
}

export class StartupHistory {
    private readonly records: StartupRecord[] = [];
    private readonly MAX_CAPACITY = 200;

    public append(record: StartupRecord): void {
        this.records.push(record);
        if (this.records.length > this.MAX_CAPACITY) {
            this.records.shift();
        }
    }

    public getRecords(): readonly StartupRecord[] {
        return [...this.records];
    }

    public getLatest(): StartupRecord | undefined {
        if (this.records.length === 0) return undefined;
        return this.records[this.records.length - 1];
    }
}
