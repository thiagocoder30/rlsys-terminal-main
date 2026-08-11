export interface RuntimeMetrics {
    runtimeUptimeMs: number;
    cpuTimeMs: number;
    memoryUsageBytes: number;
    averageDecisionTimeMs: number;
    averagePipelineTimeMs: number;
    decisionCount: number;
    snapshotsCreated: number;
    recoveries: number;
    heartbeatCount: number;
    runtimeErrors: number;
    warnings: number;
    telemetryEvents: number;
    sessionsCreated: number;
    sessionsActive: number;
    sessionsFinished: number;
    sessionsLocked: number;
    sessionsRecovered: number;
}
