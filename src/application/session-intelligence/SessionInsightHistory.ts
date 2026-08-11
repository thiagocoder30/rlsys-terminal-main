import { SessionInsightSnapshot } from './SessionInsightSnapshot';

export class SessionInsightHistory {
    private readonly records: SessionInsightSnapshot[] = [];
    private readonly MAX_CAPACITY = 500;

    public append(snapshot: SessionInsightSnapshot): void {
        this.records.push(snapshot);
        if (this.records.length > this.MAX_CAPACITY) {
            this.records.shift();
        }
    }

    public getRecords(): readonly SessionInsightSnapshot[] {
        return [...this.records];
    }

    public getLatest(): SessionInsightSnapshot | undefined {
        if (this.records.length === 0) return undefined;
        return this.records[this.records.length - 1];
    }
}
