export interface RuntimeMetrics {
    readonly runtimeUptime: number;
    readonly pipelineLatencyMs: number;
    readonly decisionCount: number;
    readonly decisionsPerMinute: number;
    readonly snapshotCount: number;
    readonly recoveryCount: number;
    readonly memoryUsageBytes: number;
    readonly cpuTimeMs: number;
    readonly averageRuntimeMs: number;
    readonly activeSessions: number;

    // ADAPTIVE INTELLIGENCE
    readonly averageConfidence: number;
    readonly confidenceTrend: string;
    readonly confidenceVolatility: number;
    readonly confidenceRecoveryCount: number;
    readonly adaptiveLearningRate: number;
    readonly strategyStability: number;
    readonly confidenceSnapshotCount: number;
}

export class RuntimeTelemetry {
    private startTime: number = Date.now();
    private pipelineLatencies: number[] = [];
    private decisionCount: number = 0;
    private recoveryCount: number = 0;
    private snapshotCount: number = 0;
    private activeSessions: number = 0;

    // ADAPTIVE STATE
    private customMetrics: Record<string, number | string> = {};

    public recordLatency(latencyMs: number): void {
        this.pipelineLatencies.push(latencyMs);
        if (this.pipelineLatencies.length > 1000) this.pipelineLatencies.shift();
    }

    public incrementDecisions(): void {
        this.decisionCount++;
    }

    public incrementRecoveries(): void {
        this.recoveryCount++;
    }

    public updateSnapshotCount(count: number): void {
        this.snapshotCount = count;
    }

    public updateActiveSessions(count: number): void {
        this.activeSessions = count;
    }

    public recordMetric(key: string, value: number | string): void {
        this.customMetrics[key] = value;
    }

    public getMetrics(): RuntimeMetrics {
        const uptimeMs = Date.now() - this.startTime;
        const uptimeMin = Math.max(1, uptimeMs / 60000);
        const avgLatency = this.pipelineLatencies.length > 0 
            ? this.pipelineLatencies.reduce((a, b) => a + b, 0) / this.pipelineLatencies.length 
            : 0;
            
        return {
            runtimeUptime: uptimeMs,
            pipelineLatencyMs: avgLatency,
            decisionCount: this.decisionCount,
            decisionsPerMinute: this.decisionCount / uptimeMin,
            snapshotCount: this.snapshotCount,
            recoveryCount: this.recoveryCount,
            memoryUsageBytes: process.memoryUsage().heapUsed,
            cpuTimeMs: process.cpuUsage().user / 1000,
            averageRuntimeMs: avgLatency,
            activeSessions: this.activeSessions,

            // ADAPTIVE
            averageConfidence: Number(this.customMetrics['adaptive.averageConfidence'] || 0),
            confidenceTrend: String(this.customMetrics['adaptive.confidenceTrend'] || 'STABLE'),
            confidenceVolatility: Number(this.customMetrics['adaptive.confidenceVolatility'] || 0),
            confidenceRecoveryCount: Number(this.customMetrics['adaptive.confidenceRecoveryCount'] || 0),
            adaptiveLearningRate: Number(this.customMetrics['adaptive.learningRate'] || 0.1),
            strategyStability: Number(this.customMetrics['adaptive.strategyStability'] || 100),
            confidenceSnapshotCount: Number(this.customMetrics['adaptive.snapshotCount'] || 0)
        };
    }
}
