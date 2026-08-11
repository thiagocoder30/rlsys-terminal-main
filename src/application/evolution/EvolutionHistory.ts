import { EvolutionSnapshot } from './EvolutionSnapshot';

export class EvolutionHistory {
    private readonly snapshots: EvolutionSnapshot[] = [];
    private readonly MAX_HISTORY = 100;

    public addSnapshot(snapshot: EvolutionSnapshot): void {
        this.snapshots.push(snapshot);
        if (this.snapshots.length > this.MAX_HISTORY) {
            this.snapshots.shift();
        }
    }

    public getLatestSnapshot(): EvolutionSnapshot | null {
        if (this.snapshots.length === 0) return null;
        return this.snapshots[this.snapshots.length - 1];
    }

    public getHistory(): ReadonlyArray<EvolutionSnapshot> {
        return Object.freeze([...this.snapshots]);
    }
}
