import { SessionLifecycleSnapshot } from './SessionLifecycleSnapshot';

export class SessionLifecycleHistory {
    private readonly MAX_HISTORY = 500;
    private readonly records: SessionLifecycleSnapshot[] = [];

    public append(snapshot: SessionLifecycleSnapshot): void {
        this.records.push(snapshot);
        if (this.records.length > this.MAX_HISTORY) {
            this.records.shift();
        }
    }

    public getHistory(): ReadonlyArray<SessionLifecycleSnapshot> {
        return this.records;
    }
}
