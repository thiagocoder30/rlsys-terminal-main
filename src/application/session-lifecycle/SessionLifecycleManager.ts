import { SessionLifecycleState } from './SessionLifecycleState';
import { SessionLifecycleHistory } from './SessionLifecycleHistory';
import { SessionLifecycleSnapshot } from './SessionLifecycleSnapshot';
import { SessionLifecycleValidator } from './SessionLifecycleValidator';
import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../runtime/observability/ObservableDecisionLedger';

export class SessionLifecycleManager {
    private currentState: SessionLifecycleState = 'NONE';
    private currentSessionId: string | null = null;

    constructor(
        private readonly history: SessionLifecycleHistory,
        private readonly eventBus: ObservabilityEventBus,
        private readonly ledger: ObservableDecisionLedger
    ) {}

    public getCurrentState(): SessionLifecycleState {
        return this.currentState;
    }

    public getCurrentSessionId(): string | null {
        return this.currentSessionId;
    }

    public existsActiveSession(): boolean {
        return ['CREATED', 'STARTING', 'ACTIVE', 'PAUSED', 'RESUMING', 'FINISHING'].includes(this.currentState);
    }

    private transitionTo(newState: SessionLifecycleState, reason: string, sessionId?: string): void {
        SessionLifecycleValidator.assertTransition(this.currentState, newState);
        const previousState = this.currentState;
        this.currentState = newState;
        
        if (sessionId && !this.currentSessionId) {
            this.currentSessionId = sessionId;
        }

        const activeSessionId = this.currentSessionId || 'UNKNOWN';

        const snapshot = new SessionLifecycleSnapshot({
            sessionId: activeSessionId,
            previousState,
            currentState: newState,
            reason,
            timestamp: new Date().toISOString()
        });

        this.history.append(snapshot);

        if (newState === 'CREATED') {
            this.publishAndLog('SESSION_CREATED', activeSessionId, reason);
        } else if (newState === 'ACTIVE' && previousState === 'STARTING') {
            this.publishAndLog('SESSION_STARTED', activeSessionId, reason);
        } else if (newState === 'PAUSED') {
            this.publishAndLog('SESSION_PAUSED', activeSessionId, reason);
        } else if (newState === 'ACTIVE' && previousState === 'RESUMING') {
            this.publishAndLog('SESSION_RESUMED', activeSessionId, reason);
        } else if (newState === 'FINISHED') {
            this.publishAndLog('SESSION_FINISHED', activeSessionId, reason);
        } else if (newState === 'ARCHIVED') {
            this.publishAndLog('SESSION_ARCHIVED', activeSessionId, reason);
            this.currentSessionId = null;
        } else if (newState === 'NONE') {
            this.publishAndLog('SESSION_RUNTIME_CLEARED', activeSessionId, reason);
            this.currentSessionId = null;
        }
    }

    private publishAndLog(eventType: string, sessionId: string, reason: string): void {
        const payload = { sessionId, reason, timestamp: new Date().toISOString() };
        this.eventBus.publish(eventType, '5.0.0', 'uuid', sessionId, payload);
        this.ledger.append(sessionId, '5.0.0', eventType, JSON.stringify(payload));
    }

    public createSession(sessionId: string): void {
        this.transitionTo('CREATED', 'Manual Creation', sessionId);
    }

    public startSession(): void {
        if (this.currentState === 'FINISHED' || this.currentState === 'ARCHIVED') {
            this.clearRuntime();
        }
        if (this.currentState === 'NONE') {
            const sessionId = `SESS-${Date.now()}`;
            this.createSession(sessionId);
        }
        this.transitionTo('STARTING', 'Starting session');
        this.transitionTo('ACTIVE', 'Session started successfully');
    }

    public pauseSession(reason: string = 'Operator Pause'): void {
        this.transitionTo('PAUSED', reason);
    }

    public resumeSession(): void {
        this.transitionTo('RESUMING', 'Resuming session');
        this.transitionTo('ACTIVE', 'Session resumed successfully');
    }

    public finishSession(reason: string = 'MANUAL'): void {
        this.transitionTo('FINISHING', `Finishing session: ${reason}`);
        this.transitionTo('FINISHED', `Session finished: ${reason}`);
    }

    public archiveSession(): void {
        this.transitionTo('ARCHIVED', 'Archiving session');
    }

    public clearRuntime(): void {
        this.transitionTo('NONE', 'Runtime cleared');
    }
}
