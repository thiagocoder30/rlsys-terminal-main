import { ScenarioSnapshot } from './ScenarioSnapshot';

export class ScenarioHistory {
    private readonly snapshots: ScenarioSnapshot[] = [];
    private readonly MAX_HISTORY = 100;

    public addSnapshot(snapshot: ScenarioSnapshot): void {
        this.snapshots.push(snapshot);
        if (this.snapshots.length > this.MAX_HISTORY) {
            this.snapshots.shift();
        }
    }

    public getLatestSnapshot(): ScenarioSnapshot | null {
        if (this.snapshots.length === 0) return null;
        return this.snapshots[this.snapshots.length - 1];
    }

    public getHistory(): ReadonlyArray<ScenarioSnapshot> {
        return Object.freeze([...this.snapshots]);
    }
}
