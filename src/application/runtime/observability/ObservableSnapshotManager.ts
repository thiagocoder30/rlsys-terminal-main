import { SnapshotManager } from '../SnapshotManager';
import { SessionSnapshot } from '../SessionSnapshot';
import { ObservabilityEventBus } from './ObservabilityEventBus';
import { randomUUID } from 'crypto';

export class ObservableSnapshotManager extends SnapshotManager {
    constructor(private readonly eventBus: ObservabilityEventBus) {
        super();
    }

    public createSnapshot(snapshot: SessionSnapshot): void {
        const start = Date.now();
        super.createSnapshot(snapshot);
        const snapshotTimeMs = Date.now() - start;
        
        this.eventBus.publish('SnapshotCreated', snapshot.runtimeVersion, randomUUID(), snapshot.sessionId, { 
            snapshot,
            snapshotTimeMs 
        });
    }
}
