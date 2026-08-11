import { RuntimeSession, RuntimeSessionManager } from '../RuntimeSessionManager';
import { ObservabilityEventBus } from './ObservabilityEventBus';
import { randomUUID } from 'crypto';

export class ObservableSessionManager extends RuntimeSessionManager {
    constructor(private readonly eventBus: ObservabilityEventBus) {
        super();
    }

    public createSession(sessionId: string, initialBankroll: number, provider: 'EVOLUTION' | 'PRAGMATIC'): RuntimeSession {
        const session = super.createSession(sessionId, initialBankroll, provider);
        this.eventBus.publish('SessionCreated', session.runtimeVersion, randomUUID(), sessionId, { session });
        return session;
    }

    public updateSession(sessionId: string, updates: Partial<RuntimeSession>): RuntimeSession {
        const oldSession = this.getSession(sessionId);
        const session = super.updateSession(sessionId, updates);
        
        if (updates.status === 'ACTIVE' && oldSession?.status !== 'ACTIVE') {
            // It could be just activated, but we mostly care about specific status transitions
        } else if (updates.status === 'FINISHED') {
            this.eventBus.publish('SessionFinished', session.runtimeVersion, randomUUID(), sessionId, { session });
        } else if (updates.status === 'LOCKED') {
            this.eventBus.publish('SessionLocked', session.runtimeVersion, randomUUID(), sessionId, { session });
            if (updates.runtimeState === 'TIMEOUT') {
                this.eventBus.publish('HeartbeatTimeout', session.runtimeVersion, randomUUID(), sessionId, { session });
            }
        } else if (updates.status === 'RECOVERED') {
            this.eventBus.publish('SessionRecovered', session.runtimeVersion, randomUUID(), sessionId, { session });
        }
        
        return session;
    }

    public finishSession(sessionId: string): void {
        super.finishSession(sessionId);
    }

    public lockSession(sessionId: string): void {
        super.lockSession(sessionId);
    }
}
