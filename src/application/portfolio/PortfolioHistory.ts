import { PortfolioSnapshot } from './PortfolioSnapshot';

export class PortfolioHistory {
    private readonly snapshots: PortfolioSnapshot[] = [];
    private readonly MAX_HISTORY = 100;

    public addSnapshot(snapshot: PortfolioSnapshot): void {
        this.snapshots.push(snapshot);
        if (this.snapshots.length > this.MAX_HISTORY) {
            this.snapshots.shift();
        }
    }

    public getLatestSnapshot(): PortfolioSnapshot | null {
        if (this.snapshots.length === 0) return null;
        return this.snapshots[this.snapshots.length - 1];
    }

    public getHistory(): ReadonlyArray<PortfolioSnapshot> {
        return Object.freeze([...this.snapshots]);
    }
}
