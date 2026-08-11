import { ObservabilityEventBus } from './ObservabilityEventBus';

export interface PerformanceStats {
    average: number;
    median: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
}

export interface RuntimePerformanceReport {
    engine: PerformanceStats;
    pipeline: PerformanceStats;
    request: PerformanceStats;
    decision: PerformanceStats;
    snapshot: PerformanceStats;
    recovery: PerformanceStats;
    heartbeat: PerformanceStats;
}

export class RuntimePerformanceMonitor {
    private engineTimes: number[] = [];
    private pipelineTimes: number[] = [];
    private requestTimes: number[] = [];
    private decisionTimes: number[] = [];
    private snapshotTimes: number[] = [];
    private recoveryTimes: number[] = [];
    private heartbeatTimes: number[] = [];

    private readonly MAX_SAMPLES = 10000;

    constructor(private readonly eventBus: ObservabilityEventBus) {
        this.setupListeners();
    }

    private setupListeners(): void {
        this.eventBus.subscribe('DecisionExecuted', (event) => {
            if (event.payload?.engineTimeMs != null) this.addSample(this.engineTimes, event.payload.engineTimeMs as number);
            if (event.payload?.pipelineTimeMs != null) this.addSample(this.pipelineTimes, event.payload.pipelineTimeMs as number);
            if (event.payload?.requestTimeMs != null) this.addSample(this.requestTimes, event.payload.requestTimeMs as number);
            if (event.payload?.decisionTimeMs != null) this.addSample(this.decisionTimes, event.payload.decisionTimeMs as number);
        });

        this.eventBus.subscribe('SnapshotCreated', (event) => {
            if (event.payload?.snapshotTimeMs != null) this.addSample(this.snapshotTimes, event.payload.snapshotTimeMs as number);
        });

        this.eventBus.subscribe('SnapshotRecovered', (event) => {
            if (event.payload?.recoveryTimeMs != null) this.addSample(this.recoveryTimes, event.payload.recoveryTimeMs as number);
        });

        this.eventBus.subscribe('HeartbeatTimeout', (event) => {
            if (event.payload?.heartbeatTimeMs != null) this.addSample(this.heartbeatTimes, event.payload.heartbeatTimeMs as number);
        });
    }

    private addSample(array: number[], value: number): void {
        array.push(value);
        if (array.length > this.MAX_SAMPLES) {
            array.shift();
        }
    }

    private calculateStats(samples: number[]): PerformanceStats {
        if (samples.length === 0) {
            return { average: 0, median: 0, min: 0, max: 0, p95: 0, p99: 0 };
        }

        const sorted = [...samples].sort((a, b) => a - b);
        const sum = sorted.reduce((acc, val) => acc + val, 0);
        const average = sum / sorted.length;
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const median = sorted[Math.floor(sorted.length / 2)];
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        const p99 = sorted[Math.floor(sorted.length * 0.99)];

        return { average, median, min, max, p95, p99 };
    }

    public getPerformanceReport(): RuntimePerformanceReport {
        return {
            engine: this.calculateStats(this.engineTimes),
            pipeline: this.calculateStats(this.pipelineTimes),
            request: this.calculateStats(this.requestTimes),
            decision: this.calculateStats(this.decisionTimes),
            snapshot: this.calculateStats(this.snapshotTimes),
            recovery: this.calculateStats(this.recoveryTimes),
            heartbeat: this.calculateStats(this.heartbeatTimes)
        };
    }
}
