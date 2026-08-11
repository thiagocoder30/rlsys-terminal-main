import { HistoricalSessionSnapshot } from './HistoricalSessionSnapshot';

export class SessionAuditHistory {
    private readonly records: HistoricalSessionSnapshot[] = [];
    private readonly MAX_CAPACITY = 500;

    public append(snapshot: HistoricalSessionSnapshot): void {
        this.records.push(snapshot);
        if (this.records.length > this.MAX_CAPACITY) {
            this.records.shift();
        }
    }

    public getRecords(): HistoricalSessionSnapshot[] {
        return [...this.records];
    }

    public getById(sessionId: string): HistoricalSessionSnapshot | undefined {
        return this.records.find(r => r.data.sessionId === sessionId);
    }
}
