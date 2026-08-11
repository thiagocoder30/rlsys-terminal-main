import { randomUUID } from 'crypto';
import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../runtime/DecisionLedger';
import { StrategyPerformanceTracker } from './StrategyPerformanceTracker';
import { SessionHealthEvaluator } from './SessionHealthEvaluator';
import { AdaptiveCalibrationMonitor } from './AdaptiveCalibrationMonitor';
import { PerformanceSnapshot, SessionHealthStatus } from './PerformanceSnapshot';

export class SessionPerformanceEngine {
    private readonly tracker = new StrategyPerformanceTracker();
    private readonly evaluator = new SessionHealthEvaluator();
    private readonly calibrationMonitor = new AdaptiveCalibrationMonitor();

    private readonly snapshots: PerformanceSnapshot[] = [];
    private currentHealth: SessionHealthStatus = 'STABLE';
    private startTime = Date.now();
    private drawdownPercent = 0;
    private averageStake = 10;

    constructor(
        private readonly eventBus?: ObservabilityEventBus,
        private readonly ledger?: DecisionLedger
    ) {
        if (this.eventBus) {
            this.setupSubscriptions();
        }
    }

    private setupSubscriptions(): void {
        if (!this.eventBus) return;

        this.eventBus.subscribe('ROUND_PROCESSED', (event) => {
            const payload = event.payload || {};
            const sessionId = event.sessionId || 'SESSION-000';
            this.handleRoundProcessed(sessionId, payload);
        });

        this.eventBus.subscribe('RECOMMENDATION_GENERATED', (event) => {
            const payload = event.payload || {};
            const sessionId = event.sessionId || 'SESSION-000';
            this.handleRecommendationGenerated(sessionId, payload);
        });

        this.eventBus.subscribe('SESSION_UPDATED', (event) => {
            const payload = event.payload || {};
            const sessionId = event.sessionId || 'SESSION-000';
            this.handleSessionUpdated(sessionId, payload);
        });
    }

    public handleRoundProcessed(sessionId: string, payload: Record<string, unknown>): void {
        const vix = (payload.vix as number) || (payload.operationalVix as number) || 25;
        const entropy = (payload.entropy as number) || 0.95;
        const status = (payload.status as string) || 'HOLD';
        const confidence = (payload.confidence as number) || 0.5;
        const consensus = (payload.consensus as number) || 0.5;
        const stake = (payload.stake as number) || 0;
        const strategyId = (payload.suggestedStrategy as string) || (payload.strategy as string) || null;

        this.tracker.recordRecommendation(status, confidence, consensus, vix, entropy, stake, strategyId);
        this.calibrationMonitor.recordObservation(confidence, consensus);

        this.evaluateAndEmitSnapshot(sessionId);
    }

    public handleRecommendationGenerated(sessionId: string, payload: Record<string, unknown>): void {
        const rec = (payload.recommendation as any) || payload;
        if (rec) {
            if (rec.stake) this.averageStake = rec.stake;
            this.tracker.recordRecommendation(
                rec.stake > 0 ? 'RECOMMENDATION' : 'HOLD',
                rec.confidence || 0.5,
                rec.consensus || 0.5,
                rec.vix || 25,
                0.95,
                rec.stake || 0,
                rec.strategy || null
            );
        }
        this.evaluateAndEmitSnapshot(sessionId);
    }

    public handleSessionUpdated(sessionId: string, payload: Record<string, unknown>): void {
        if (typeof payload.drawdown === 'number') {
            this.drawdownPercent = payload.drawdown;
        }
        this.evaluateAndEmitSnapshot(sessionId);
    }

    public evaluateAndEmitSnapshot(sessionId: string = 'SESSION-000'): PerformanceSnapshot {
        const totalReqs = this.tracker.getIssuedCount() + this.tracker.getBlockedCount() + this.tracker.getHoldCount();
        const blockRatio = totalReqs > 0 ? this.tracker.getBlockedCount() / totalReqs : 0;

        const newHealth = this.evaluator.evaluate({
            drawdownPercent: this.drawdownPercent,
            blockRatio,
            averageConfidence: this.tracker.getAverageConfidence(),
            averageConsensus: this.tracker.getAverageConsensus(),
            averageVix: this.tracker.getAverageVix(),
            accuracyPercent: this.tracker.getAccuracy()
        });

        const prevHealth = this.currentHealth;
        this.currentHealth = newHealth;

        const stabilityIdx = this.calibrationMonitor.getConfidenceStabilityIndex();
        const qualityScore = Math.min(100, Math.max(0,
            (this.tracker.getAverageConfidence() * 40) +
            (this.tracker.getAverageConsensus() * 30) +
            (stabilityIdx * 30) -
            (this.drawdownPercent * 2)
        ));

        const uptimeSec = Math.floor((Date.now() - this.startTime) / 1000);

        const snapshot: PerformanceSnapshot = Object.freeze({
            snapshotId: randomUUID(),
            sessionId,
            timestampUtc: new Date().toISOString(),
            sessionHealth: newHealth,
            confidenceTrend: this.calibrationMonitor.getConfidenceTrend(),
            consensusTrend: this.calibrationMonitor.getConsensusTrend(),
            averageRecommendationScore: this.tracker.getAverageConfidence(),
            averageStake: this.averageStake,
            averageVix: this.tracker.getAverageVix() || 25,
            averageEntropy: this.tracker.getAverageEntropy() || 0.95,
            shadowPnL: this.tracker.getShadowPnL(),
            drawdown: this.drawdownPercent,
            runtimeUptimeSeconds: uptimeSec,
            recommendationAccuracy: this.tracker.getAccuracy(),
            strategyRanking: this.tracker.getStrategyRankings(),
            sessionQualityScore: Math.round(qualityScore),
            operationalStabilityIndex: Math.round(stabilityIdx * 100) / 100
        });

        this.snapshots.push(snapshot);
        if (this.snapshots.length > 500) {
            this.snapshots.shift();
        }

        if (this.eventBus) {
            this.eventBus.publish('PERFORMANCE_UPDATED', '5.0.0', randomUUID(), sessionId, { snapshot });
            if (prevHealth !== newHealth) {
                this.eventBus.publish('SESSION_HEALTH_UPDATED', '5.0.0', randomUUID(), sessionId, {
                    previousHealth: prevHealth,
                    currentHealth: newHealth
                });
            }
        }

        if (this.ledger) {
            this.ledger.append(sessionId, '5.0.0', 'PERFORMANCE_SNAPSHOT', JSON.stringify({
                health: snapshot.sessionHealth,
                qualityScore: snapshot.sessionQualityScore,
                confidenceTrend: snapshot.confidenceTrend,
                consensusTrend: snapshot.consensusTrend
            }));
            if (prevHealth !== newHealth) {
                this.ledger.append(sessionId, '5.0.0', 'SESSION_HEALTH_CHANGED', `Health transitioned from ${prevHealth} to ${newHealth}`);
            }
        }

        return snapshot;
    }

    public getLatestSnapshot(sessionId: string = 'SESSION-000'): PerformanceSnapshot {
        if (this.snapshots.length === 0) {
            return this.evaluateAndEmitSnapshot(sessionId);
        }
        return this.snapshots[this.snapshots.length - 1];
    }

    public getSnapshotHistory(sessionId: string = 'SESSION-000'): ReadonlyArray<PerformanceSnapshot> {
        return this.snapshots.filter(s => s.sessionId === sessionId || s.sessionId === 'SESSION-000');
    }

    public getSessionHealth(sessionId: string = 'SESSION-000'): { health: SessionHealthStatus; qualityScore: number; stabilityIndex: number } {
        const latest = this.getLatestSnapshot(sessionId);
        return {
            health: latest.sessionHealth,
            qualityScore: latest.sessionQualityScore,
            stabilityIndex: latest.operationalStabilityIndex
        };
    }
}
