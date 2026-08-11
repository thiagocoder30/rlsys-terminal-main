import { HeartbeatManager } from '../HeartbeatManager';
import { RuntimeSessionManager } from '../RuntimeSessionManager';
import { ObservabilityEventBus } from './ObservabilityEventBus';
import { randomUUID } from 'crypto';

export class ObservableHeartbeatManager extends HeartbeatManager {
    constructor(
        sessionManager: RuntimeSessionManager,
        private readonly eventBus: ObservabilityEventBus
    ) {
        super(sessionManager);
    }

    public heartbeat(sessionId: string): void {
        const start = Date.now();
        super.heartbeat(sessionId);
        const heartbeatTimeMs = Date.now() - start;
        
        // We won't publish an event for EVERY heartbeat to avoid flood, 
        // but we can publish metrics or just use the latency.
        // The instructions ask for heartbeat count and time per heartbeat.
        this.eventBus.publish('HeartbeatReceived', '5.0.0', randomUUID(), sessionId, { heartbeatTimeMs });
    }

    public checkTimeouts(): void {
        // We need to override checkTimeouts to detect if a timeout happened, but we don't have access to lastHeartbeats.
        // Wait, checkTimeouts updates session to LOCKED and runtimeState to TIMEOUT.
        // ObservableSessionManager will catch the LOCKED status.
        // To emit HeartbeatTimeout, we can just call super and let it run, 
        // but how do we know which ones timed out? 
        // We can emit HeartbeatTimeout from ObservableSessionManager when runtimeState === 'TIMEOUT'.
        super.checkTimeouts();
    }
}
