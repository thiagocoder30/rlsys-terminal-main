import { InstitutionalDecisionSnapshot } from './InstitutionalDecisionSnapshot';

export class InstitutionalDecisionHistory {
    private readonly snapshots: InstitutionalDecisionSnapshot[] = [];
    private readonly MAX_HISTORY = 100;

    public addSnapshot(snapshot: InstitutionalDecisionSnapshot): void {
        this.snapshots.push(snapshot);
        if (this.snapshots.length > this.MAX_HISTORY) {
            this.snapshots.shift();
        }
    }

    public getLatestSnapshot(): InstitutionalDecisionSnapshot | null {
        if (this.snapshots.length === 0) return null;
        return this.snapshots[this.snapshots.length - 1];
    }

    public getHistory(): ReadonlyArray<InstitutionalDecisionSnapshot> {
        return Object.freeze([...this.snapshots]);
    }
}
