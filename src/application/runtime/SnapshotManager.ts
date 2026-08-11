import { SessionSnapshot } from './SessionSnapshot';

export class SnapshotManager {
    private snapshots: Map<string, SessionSnapshot[]> = new Map();

    public createSnapshot(snapshot: SessionSnapshot): void {
        const existing = this.snapshots.get(snapshot.sessionId) || [];
        existing.push(Object.freeze({ ...snapshot }));
        this.snapshots.set(snapshot.sessionId, existing);
    }

    public getLatestSnapshot(sessionId: string): SessionSnapshot | null {
        const existing = this.snapshots.get(sessionId);
        if (!existing || existing.length === 0) return null;
        return existing[existing.length - 1];
    }

    public getSnapshotCount(): number {
        let count = 0;
        for (const list of this.snapshots.values()) {
            count += list.length;
        }
        return count;
    }
}
