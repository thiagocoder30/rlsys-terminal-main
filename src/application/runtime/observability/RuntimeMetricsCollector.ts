import { ObservabilityEventBus } from './ObservabilityEventBus';
import { RuntimeMetrics } from './RuntimeMetrics';

export class RuntimeMetricsCollector {
    private readonly startTime = Date.now();
    
    private decisionCount = 0;
    private totalDecisionTimeMs = 0;
    private totalPipelineTimeMs = 0;
    private snapshotsCreated = 0;
    private recoveries = 0;
    private heartbeatCount = 0;
    private runtimeErrors = 0;
    private warnings = 0;
    private telemetryEvents = 0;
    private sessionsCreated = 0;
    private sessionsActive = 0;
    private sessionsFinished = 0;
    private sessionsLocked = 0;
    private sessionsRecovered = 0;

    constructor(private readonly eventBus: ObservabilityEventBus) {
        this.setupListeners();
    }

    private setupListeners(): void {
        this.eventBus.subscribe('SessionCreated', () => {
            this.sessionsCreated++;
            this.sessionsActive++;
        });

        this.eventBus.subscribe('SessionFinished', () => {
            this.sessionsFinished++;
            if (this.sessionsActive > 0) this.sessionsActive--;
        });

        this.eventBus.subscribe('SessionLocked', () => {
            this.sessionsLocked++;
            if (this.sessionsActive > 0) this.sessionsActive--;
        });

        this.eventBus.subscribe('SessionRecovered', () => {
            this.sessionsRecovered++;
            this.sessionsActive++;
        });

        this.eventBus.subscribe('DecisionExecuted', (event) => {
            this.decisionCount++;
            if (event.payload?.decisionTimeMs && typeof event.payload.decisionTimeMs === 'number') {
                this.totalDecisionTimeMs += event.payload.decisionTimeMs;
            }
            if (event.payload?.pipelineTimeMs && typeof event.payload.pipelineTimeMs === 'number') {
                this.totalPipelineTimeMs += event.payload.pipelineTimeMs;
            }
        });

        this.eventBus.subscribe('SnapshotCreated', () => this.snapshotsCreated++);
        this.eventBus.subscribe('SnapshotRecovered', () => this.recoveries++);
        this.eventBus.subscribe('TelemetryUpdated', () => this.telemetryEvents++);
        this.eventBus.subscribe('HeartbeatTimeout', () => this.heartbeatCount++);
        this.eventBus.subscribe('RuntimeWarning', () => this.warnings++);
        this.eventBus.subscribe('RuntimeError', () => this.runtimeErrors++);
    }

    public getMetrics(): RuntimeMetrics {
        return {
            runtimeUptimeMs: Date.now() - this.startTime,
            cpuTimeMs: process.cpuUsage().user / 1000,
            memoryUsageBytes: process.memoryUsage().heapUsed,
            averageDecisionTimeMs: this.decisionCount > 0 ? this.totalDecisionTimeMs / this.decisionCount : 0,
            averagePipelineTimeMs: this.decisionCount > 0 ? this.totalPipelineTimeMs / this.decisionCount : 0,
            decisionCount: this.decisionCount,
            snapshotsCreated: this.snapshotsCreated,
            recoveries: this.recoveries,
            heartbeatCount: this.heartbeatCount,
            runtimeErrors: this.runtimeErrors,
            warnings: this.warnings,
            telemetryEvents: this.telemetryEvents,
            sessionsCreated: this.sessionsCreated,
            sessionsActive: this.sessionsActive,
            sessionsFinished: this.sessionsFinished,
            sessionsLocked: this.sessionsLocked,
            sessionsRecovered: this.sessionsRecovered
        };
    }
}
