import { RuntimeSessionManager } from './RuntimeSessionManager';

export class HeartbeatManager {
    private lastHeartbeats: Map<string, number> = new Map();
    private readonly timeoutMs = 30000; // 30 seconds

    constructor(private sessionManager: RuntimeSessionManager) {}

    public heartbeat(sessionId: string): void {
        const session = this.sessionManager.getSession(sessionId);
        if (session && (session.status === 'ACTIVE' || session.status === 'CREATED' || session.status === 'RECOVERED')) {
            this.lastHeartbeats.set(sessionId, Date.now());
            if (session.status !== 'ACTIVE') {
                this.sessionManager.updateSession(sessionId, { status: 'ACTIVE' });
            }
        }
    }

    public checkTimeouts(): void {
        const now = Date.now();
        for (const [sessionId, lastTime] of this.lastHeartbeats.entries()) {
            if (now - lastTime > this.timeoutMs) {
                const session = this.sessionManager.getSession(sessionId);
                if (session && session.status === 'ACTIVE') {
                    this.sessionManager.updateSession(sessionId, { status: 'LOCKED', runtimeState: 'TIMEOUT' });
                }
                this.lastHeartbeats.delete(sessionId);
            }
        }
    }
}
