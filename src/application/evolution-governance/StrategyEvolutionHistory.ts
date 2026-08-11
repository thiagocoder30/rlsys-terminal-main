import { StrategyEvolutionSnapshot } from './StrategyEvolutionSnapshot';

export class StrategyEvolutionHistory {
    private readonly snapshots: StrategyEvolutionSnapshot[] = [];
    private readonly MAX_HISTORY = 100;

    public addSnapshot(snapshot: StrategyEvolutionSnapshot): void {
        this.snapshots.push(snapshot);
        if (this.snapshots.length > this.MAX_HISTORY) {
            this.snapshots.shift();
        }
    }

    public getLatestSnapshot(): StrategyEvolutionSnapshot | null {
        if (this.snapshots.length === 0) return null;
        return this.snapshots[this.snapshots.length - 1];
    }

    public getHistory(): ReadonlyArray<StrategyEvolutionSnapshot> {
        return Object.freeze([...this.snapshots]);
    }
}
