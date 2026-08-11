import { GlobalSessionSnapshot } from './GlobalSessionSnapshot';

export class MultiSessionHistory {
    private readonly snapshots: GlobalSessionSnapshot[] = [];
    private readonly MAX_HISTORY = 100;

    public addSnapshot(snapshot: GlobalSessionSnapshot): void {
        this.snapshots.push(snapshot);
        if (this.snapshots.length > this.MAX_HISTORY) {
            this.snapshots.shift();
        }
    }

    public getLatestSnapshot(): GlobalSessionSnapshot | null {
        if (this.snapshots.length === 0) return null;
        return this.snapshots[this.snapshots.length - 1];
    }

    public getHistory(): ReadonlyArray<GlobalSessionSnapshot> {
        return Object.freeze([...this.snapshots]);
    }
}
