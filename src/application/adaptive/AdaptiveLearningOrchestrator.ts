import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';
import { AdaptiveConfidenceEngine } from './AdaptiveConfidenceEngine';
import { ConfidenceSnapshotManager } from './ConfidenceSnapshotManager';
import { StrategyPerformanceHistory } from './StrategyPerformanceHistory';
import { SessionSnapshot } from '../runtime/SessionSnapshot';
import { RuntimeTelemetry } from '../runtime/RuntimeTelemetry';
import { StrategyConfidenceRepository } from './StrategyConfidenceRepository';

export class AdaptiveLearningOrchestrator {
    private lastPnL: Record<string, number> = {};

    constructor(
        private readonly eventBus: ObservabilityEventBus,
        private readonly engine: AdaptiveConfidenceEngine,
        private readonly snapshotManager: ConfidenceSnapshotManager,
        private readonly performanceHistory: StrategyPerformanceHistory,
        private readonly telemetry: RuntimeTelemetry,
        private readonly repository: StrategyConfidenceRepository
    ) {
        this.eventBus.subscribe('SnapshotCreated', (event) => {
            const snapshot = event.payload?.snapshot as SessionSnapshot;
            if (!snapshot || !snapshot.shadowPnL) return;

            for (const [strategyId, currentPnl] of Object.entries(snapshot.shadowPnL)) {
                const prevPnl = this.lastPnL[strategyId] || 0;
                const pnlDiff = currentPnl - prevPnl;
                
                if (pnlDiff !== 0 || currentPnl !== 0) { 
                    const isWin = pnlDiff > 0;
                    this.performanceHistory.recordExecution(
                        strategyId, 
                        isWin, 
                        pnlDiff, 
                        pnlDiff < 0 ? Math.abs(pnlDiff) : 0, 
                        event.payload?.snapshotTimeMs as number || 1
                    );
                }

                this.lastPnL[strategyId] = currentPnl;

                const confidence = this.engine.evaluateConfidence(strategyId);
                this.snapshotManager.createSnapshot(confidence);
            }

            this.updateTelemetry();
        });
    }

    private updateTelemetry() {
        const metrics = this.engine.getAggregateMetrics();
        this.telemetry.recordMetric('adaptive.averageConfidence', metrics.averageConfidence);
        this.telemetry.recordMetric('adaptive.confidenceTrend', metrics.trend);
        this.telemetry.recordMetric('adaptive.confidenceVolatility', metrics.volatility);
        this.telemetry.recordMetric('adaptive.confidenceRecoveryCount', metrics.recoveryCount);
        this.telemetry.recordMetric('adaptive.strategyStability', metrics.stability);
        this.telemetry.recordMetric('adaptive.snapshotCount', this.repository.getCount());
        this.telemetry.recordMetric('adaptive.learningRate', 0.15); // fixed learning rate for now
    }
}
