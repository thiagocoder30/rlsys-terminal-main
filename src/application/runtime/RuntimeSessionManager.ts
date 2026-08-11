import { SessionStatus } from './SessionStatus';

export interface RuntimeSession {
    readonly sessionId: string;
    readonly createdAtUtc: string;
    readonly updatedAtUtc: string;
    readonly runtimeVersion: string;
    readonly status: SessionStatus;
    readonly currentBankroll: number;
    readonly peakBankroll: number;
    readonly drawdown: number;
    readonly provider: 'EVOLUTION' | 'PRAGMATIC';
    readonly strategy: string | null;
    readonly burnIn: number;
    readonly cooldown: number;
    readonly runtimeState: string;
    readonly snapshotVersion: number;
}

export class RuntimeSessionManager {
    private sessions: Map<string, RuntimeSession> = new Map();
    private activeCount = 0;

    public createSession(sessionId: string, initialBankroll: number, provider: 'EVOLUTION' | 'PRAGMATIC'): RuntimeSession {
        const session: RuntimeSession = Object.freeze({
            sessionId,
            createdAtUtc: new Date().toISOString(),
            updatedAtUtc: new Date().toISOString(),
            runtimeVersion: '5.0.0',
            status: 'CREATED',
            currentBankroll: initialBankroll,
            peakBankroll: initialBankroll,
            drawdown: 0,
            provider,
            strategy: null,
            burnIn: 15,
            cooldown: 0,
            runtimeState: 'INITIALIZING',
            snapshotVersion: 0
        });
        
        this.sessions.set(session.sessionId, session);
        this.updateActiveCount();
        return session;
    }

    public getSession(sessionId: string): RuntimeSession | null {
        return this.sessions.get(sessionId) || null;
    }

    public updateSession(sessionId: string, updates: Partial<RuntimeSession>): RuntimeSession {
        const current = this.getSession(sessionId);
        if (!current) throw new Error("Session not found");

        const updated = Object.freeze({
            ...current,
            ...updates,
            updatedAtUtc: new Date().toISOString()
        });

        this.sessions.set(sessionId, updated);
        this.updateActiveCount();
        return updated;
    }

    public finishSession(sessionId: string): void {
        this.updateSession(sessionId, { status: 'FINISHED' });
    }

    public lockSession(sessionId: string): void {
        this.updateSession(sessionId, { status: 'LOCKED' });
    }

    public getActiveSessionsCount(): number {
        return this.activeCount;
    }

    private updateActiveCount(): void {
        let count = 0;
        for (const session of this.sessions.values()) {
            if (session.status === 'ACTIVE' || session.status === 'CREATED' || session.status === 'RECOVERED') {
                count++;
            }
        }
        this.activeCount = count;
    }
}
