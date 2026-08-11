import { SessionLifecycleState } from './SessionLifecycleState';
import { createHash } from 'crypto';

export interface SessionLifecycleSnapshotData {
    sessionId: string;
    previousState: SessionLifecycleState;
    currentState: SessionLifecycleState;
    reason: string;
    timestamp: string;
}

export class SessionLifecycleSnapshot {
    public readonly sessionId: string;
    public readonly previousState: SessionLifecycleState;
    public readonly currentState: SessionLifecycleState;
    public readonly reason: string;
    public readonly timestamp: string;
    public readonly hash: string;

    constructor(data: SessionLifecycleSnapshotData) {
        this.sessionId = data.sessionId;
        this.previousState = data.previousState;
        this.currentState = data.currentState;
        this.reason = data.reason;
        this.timestamp = data.timestamp;
        
        const content = `${this.sessionId}:${this.previousState}:${this.currentState}:${this.reason}:${this.timestamp}`;
        this.hash = createHash('sha256').update(content).digest('hex');

        Object.freeze(this);
    }
}
