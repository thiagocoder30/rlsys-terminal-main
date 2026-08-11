import { LearningSnapshot } from './LearningSnapshot';

export class LearningHistory {
    private readonly snapshots: LearningSnapshot[] = [];
    private readonly MAX_HISTORY = 100;

    public addSnapshot(snapshot: LearningSnapshot): void {
        this.snapshots.push(snapshot);
        if (this.snapshots.length > this.MAX_HISTORY) {
            this.snapshots.shift();
        }
    }

    public getLatestSnapshot(): LearningSnapshot | null {
        if (this.snapshots.length === 0) return null;
        return this.snapshots[this.snapshots.length - 1];
    }

    public getHistory(): ReadonlyArray<LearningSnapshot> {
        return Object.freeze([...this.snapshots]);
    }
}
