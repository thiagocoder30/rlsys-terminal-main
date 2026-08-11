import { SessionLifecycleManager } from './SessionLifecycleManager';

export interface SessionLifecycleDTO {
    currentState: string;
    hasActiveSession: boolean;
    sessionId: string | null;
}

export class SessionLifecycleReportService {
    constructor(private readonly manager: SessionLifecycleManager) {}

    public getLifecycleState(): SessionLifecycleDTO {
        return {
            currentState: this.manager.getCurrentState(),
            hasActiveSession: this.manager.existsActiveSession(),
            sessionId: this.manager.getCurrentSessionId()
        };
    }
}
