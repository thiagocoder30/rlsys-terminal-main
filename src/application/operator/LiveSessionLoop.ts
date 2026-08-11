export type LiveSessionState =
    | 'NOT_INITIALIZED'
    | 'SYNCING'
    | 'BURN_IN'
    | 'PREFLIGHT'
    | 'READY'
    | 'WAITING_SPIN'
    | 'PROCESSING'
    | 'DECISION_READY'
    | 'LOCKED'
    | 'FINISHED';

export interface LiveSessionStateTransitionEvent {
    from: LiveSessionState;
    to: LiveSessionState;
    timestampUtc: string;
    reason?: string;
}

const ALLOWED_TRANSITIONS: Record<LiveSessionState, LiveSessionState[]> = {
    'NOT_INITIALIZED': ['SYNCING', 'LOCKED', 'FINISHED'],
    'SYNCING': ['BURN_IN', 'LOCKED', 'FINISHED'],
    'BURN_IN': ['PREFLIGHT', 'LOCKED', 'FINISHED'],
    'PREFLIGHT': ['READY', 'WAITING_SPIN', 'LOCKED', 'FINISHED'],
    'READY': ['WAITING_SPIN', 'PROCESSING', 'LOCKED', 'FINISHED'],
    'WAITING_SPIN': ['PROCESSING', 'LOCKED', 'FINISHED'],
    'PROCESSING': ['DECISION_READY', 'LOCKED', 'FINISHED'],
    'DECISION_READY': ['WAITING_SPIN', 'READY', 'PROCESSING', 'LOCKED', 'FINISHED'],
    'LOCKED': ['READY', 'FINISHED'], // Allow recovery to READY if unlocked
    'FINISHED': []
};

export class LiveSessionLoop {
    private currentState: LiveSessionState = 'NOT_INITIALIZED';
    private readonly sessionId: string;
    private readonly startedAtUtc: string;
    private lastUpdatedUtc: string;
    private lockReason: string | null = null;
    private transitionHistory: LiveSessionStateTransitionEvent[] = [];

    constructor(sessionId: string) {
        this.sessionId = sessionId;
        this.startedAtUtc = new Date().toISOString();
        this.lastUpdatedUtc = this.startedAtUtc;
    }

    public getState(): LiveSessionState {
        return this.currentState;
    }

    public getSessionId(): string {
        return this.sessionId;
    }

    public getLockReason(): string | null {
        return this.lockReason;
    }

    public getUptimeSeconds(): number {
        return Math.floor((Date.now() - new Date(this.startedAtUtc).getTime()) / 1000);
    }

    public canTransitionTo(nextState: LiveSessionState): boolean {
        if (this.currentState === nextState) return true;
        const allowed = ALLOWED_TRANSITIONS[this.currentState] || [];
        return allowed.includes(nextState);
    }

    public transitionTo(nextState: LiveSessionState, reason?: string): void {
        if (this.currentState === nextState) return;

        if (!this.canTransitionTo(nextState)) {
            throw new Error(`Invalid FSM transition in LiveSessionLoop from ${this.currentState} to ${nextState}`);
        }

        const transitionEvent: LiveSessionStateTransitionEvent = {
            from: this.currentState,
            to: nextState,
            timestampUtc: new Date().toISOString(),
            reason
        };

        this.transitionHistory.push(transitionEvent);
        this.currentState = nextState;
        this.lastUpdatedUtc = transitionEvent.timestampUtc;

        if (nextState === 'LOCKED' && reason) {
            this.lockReason = reason;
        } else if (nextState === 'READY') {
            this.lockReason = null;
        }
    }

    public startSync(): void {
        if (this.currentState === 'NOT_INITIALIZED' || this.currentState === 'FINISHED') {
            this.currentState = 'NOT_INITIALIZED';
        }
        this.transitionTo('SYNCING', 'Sync initiated by operator');
        this.transitionTo('BURN_IN', 'Processing tape burn-in');
        this.transitionTo('PREFLIGHT', 'Evaluating preflight gate');
    }

    public completePreflight(approved: boolean, reason?: string): LiveSessionState {
        if (approved) {
            this.transitionTo('READY', 'PreFlight passed');
            this.transitionTo('WAITING_SPIN', 'Awaiting operator spin input');
            return this.currentState;
        } else {
            this.transitionTo('LOCKED', reason || 'PreFlight gate rejected session');
            return this.currentState;
        }
    }

    public startSpinProcessing(): void {
        if (this.currentState === 'READY' || this.currentState === 'WAITING_SPIN' || this.currentState === 'DECISION_READY') {
            this.transitionTo('PROCESSING', 'Processing new live spin');
        } else {
            throw new Error(`Cannot process spin while session is in state ${this.currentState}`);
        }
    }

    public completeSpinProcessing(): void {
        this.transitionTo('DECISION_READY', 'Recommendation generated');
        this.transitionTo('WAITING_SPIN', 'Ready for next spin input');
    }

    public lockSession(reason: string): void {
        this.transitionTo('LOCKED', reason);
    }

    public finishSession(): void {
        this.transitionTo('FINISHED', 'Session terminated by operator');
    }

    public getHistory(): readonly LiveSessionStateTransitionEvent[] {
        return Object.freeze([...this.transitionHistory]);
    }
}
