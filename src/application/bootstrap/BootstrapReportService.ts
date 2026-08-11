import { ApplicationBootstrap } from './ApplicationBootstrap';

export interface BootstrapReport {
    timestamp: number;
    currentState: string;
    decision: string;
    errors: string[];
    runtimeState: any | null;
}

export class BootstrapReportService {
    constructor(private readonly bootstrap: ApplicationBootstrap) {}

    public getReport(): BootstrapReport {
        const status = this.bootstrap.getStatus();
        return {
            timestamp: Date.now(),
            currentState: status.currentState,
            decision: status.decision,
            errors: status.errors,
            runtimeState: status.state ? status.state.toJSON() : null
        };
    }
}
