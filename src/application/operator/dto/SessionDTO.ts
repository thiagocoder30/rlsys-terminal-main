export interface SessionDTO {
    sessionId: string;
    status: 'CREATED' | 'ACTIVE' | 'PAUSED' | 'LOCKED' | 'FINISHED' | 'RECOVERED';
    heartbeatStatus: 'ALIVE' | 'DEAD' | 'UNKNOWN';
    executionTimeMs: number;
    lastSnapshotTimeUtc: string | null;
    lastDecisionTimeUtc: string | null;
}
