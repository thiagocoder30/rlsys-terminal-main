import { RuntimeMetricsCollector } from './RuntimeMetricsCollector';
import { ObservabilityEventBus } from './ObservabilityEventBus';

export interface RuntimeDiagnosticsReport {
    runtimeStatus: string;
    pipelineStatus: string;
    sessionStatus: string;
    telemetryStatus: string;
    ledgerStatus: string;
    snapshotStatus: string;
    healthSummary: string;
    warnings: number;
    errors: number;
    buildVersion: string;
}

export class RuntimeDiagnostics {
    private readonly buildVersion = '5.0.0'; // Hardcoded as per institutional version

    constructor(
        private readonly metricsCollector: RuntimeMetricsCollector,
        private readonly eventBus: ObservabilityEventBus
    ) {}

    public getDiagnostics(): RuntimeDiagnosticsReport {
        const metrics = this.metricsCollector.getMetrics();
        
        const runtimeStatus = metrics.runtimeErrors > 0 ? 'DEGRADED' : 'OPERATIONAL';
        const pipelineStatus = metrics.averagePipelineTimeMs > 100 ? 'SLOW' : 'OPTIMAL';
        const sessionStatus = metrics.sessionsLocked > 0 ? 'ATTENTION_REQUIRED' : 'HEALTHY';
        const telemetryStatus = metrics.telemetryEvents > 0 ? 'ACTIVE' : 'IDLE';
        const snapshotStatus = metrics.snapshotsCreated > 0 ? 'ACTIVE' : 'IDLE';
        const ledgerStatus = 'OPERATIONAL'; // Could be tied to specific events if needed
        
        const healthSummary = metrics.runtimeErrors === 0 && metrics.warnings === 0 
            ? 'ALL_SYSTEMS_NOMINAL' 
            : 'SYSTEMS_DEGRADED';

        return {
            runtimeStatus,
            pipelineStatus,
            sessionStatus,
            telemetryStatus,
            ledgerStatus,
            snapshotStatus,
            healthSummary,
            warnings: metrics.warnings,
            errors: metrics.runtimeErrors,
            buildVersion: this.buildVersion
        };
    }
}
