import { randomUUID } from 'crypto';
import { ObservabilityEventBus } from './ObservabilityEventBus';
import { RuntimeAlert } from './RuntimeAlert';
import { RuntimeMetricsCollector } from './RuntimeMetricsCollector';
import { RuntimePerformanceMonitor } from './RuntimePerformanceMonitor';

export class RuntimeAlertManager {
    private readonly activeAlerts: RuntimeAlert[] = [];
    private consecutiveErrors = 0;
    
    constructor(
        private readonly eventBus: ObservabilityEventBus,
        private readonly metricsCollector: RuntimeMetricsCollector,
        private readonly performanceMonitor: RuntimePerformanceMonitor
    ) {
        this.setupListeners();
    }

    private generateAlert(type: string, severity: 'INFO' | 'WARNING' | 'CRITICAL', message: string): void {
        const alert: RuntimeAlert = Object.freeze({
            alertId: randomUUID(),
            type,
            severity,
            message,
            timestampUtc: new Date().toISOString()
        });
        
        this.activeAlerts.push(alert);
        if (this.activeAlerts.length > 1000) {
            this.activeAlerts.shift();
        }
        
        // Publish alert generated event
        this.eventBus.publish('RuntimeWarning', '5.0.0', randomUUID(), undefined, { alert });
    }

    private setupListeners(): void {
        this.eventBus.subscribe('DecisionExecuted', () => {
            this.consecutiveErrors = 0; // Reset on successful decision
            this.checkPerformanceAlerts();
        });

        this.eventBus.subscribe('HeartbeatTimeout', () => {
            this.generateAlert('HEARTBEAT_LOST', 'CRITICAL', 'Heartbeat timeout detected on session');
        });

        this.eventBus.subscribe('SessionRecovered', () => {
            const metrics = this.metricsCollector.getMetrics();
            if (metrics.recoveries > 10) {
                this.generateAlert('EXCESSIVE_RECOVERY', 'WARNING', 'High number of session recoveries detected');
            }
        });

        this.eventBus.subscribe('RuntimeError', () => {
            this.consecutiveErrors++;
            if (this.consecutiveErrors >= 3) {
                this.generateAlert('CONSECUTIVE_ERRORS', 'CRITICAL', 'Multiple consecutive runtime errors detected');
            }
        });

        this.eventBus.subscribe('SessionLocked', () => {
            this.generateAlert('SESSION_LOCKED', 'WARNING', 'A session has been locked for safety or compliance reasons');
        });
        
        // General checks interval or event-driven
        setInterval(() => this.checkSystemAlerts(), 60000).unref();
    }

    private checkPerformanceAlerts(): void {
        const perf = this.performanceMonitor.getPerformanceReport();
        if (perf.pipeline.p95 > 250) {
            this.generateAlert('SLOW_PIPELINE', 'WARNING', `Pipeline p95 latency is high: ${perf.pipeline.p95}ms`);
        }
        if (perf.decision.p95 > 100) {
            this.generateAlert('HIGH_LATENCY', 'WARNING', `Decision p95 latency is high: ${perf.decision.p95}ms`);
        }
    }

    private checkSystemAlerts(): void {
        const metrics = this.metricsCollector.getMetrics();
        const memUsageMB = metrics.memoryUsageBytes / 1024 / 1024;
        
        if (memUsageMB > 500) { // arbitrary threshold
            this.generateAlert('HIGH_MEMORY_USAGE', 'CRITICAL', `Memory usage exceeded threshold: ${memUsageMB.toFixed(2)} MB`);
        }
        
        // Assuming some external way to trigger ledger inconsistency or snapshot invalidation, 
        // they would come via eventBus.
        this.eventBus.subscribe('LedgerInconsistent', () => {
            this.generateAlert('LEDGER_INCONSISTENT', 'CRITICAL', 'Decision Ledger inconsistency detected');
        });

        this.eventBus.subscribe('SnapshotInvalid', () => {
            this.generateAlert('INVALID_SNAPSHOT', 'CRITICAL', 'Invalid session snapshot detected');
        });
    }

    public getActiveAlerts(): ReadonlyArray<RuntimeAlert> {
        return [...this.activeAlerts];
    }
}
