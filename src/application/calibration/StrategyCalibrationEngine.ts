import { randomUUID, createHash } from 'crypto';
import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../runtime/DecisionLedger';
import { StrategyWeightTracker } from './StrategyWeightTracker';
import { StrategyDecayCalculator } from './StrategyDecayCalculator';
import { StrategyWeightNormalizer } from './StrategyWeightNormalizer';
import { StrategyWeightHistory } from './StrategyWeightHistory';
import { StrategyWeightSnapshot, StrategyWeightItem } from './StrategyWeightSnapshot';

export class StrategyCalibrationEngine {
    private readonly tracker = new StrategyWeightTracker();
    private readonly decayCalculator = new StrategyDecayCalculator(0.85);
    private readonly normalizer = new StrategyWeightNormalizer();
    private readonly history = new StrategyWeightHistory();

    private currentRegime: string = 'LOW_INFORMATION';
    private sessionQuality: number = 75;
    private drawdownPercent: number = 0;

    private readonly KNOWN_STRATEGIES = [
        'MARKOV_TREND',
        'MEAN_REVERSION_ZSCORE',
        'DOZEN_COLUMN_FLOW',
        'ENTROPY_OPTIMIZED',
        'PERSISTENT_SECTOR'
    ];

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

        this.eventBus.subscribe('MARKET_REGIME_UPDATED', (event) => {
            const payload = event.payload || {};
            const snapshot = payload.snapshot as any;
            if (snapshot && snapshot.currentRegime) {
                this.currentRegime = snapshot.currentRegime;
            }
        });

        this.eventBus.subscribe('PERFORMANCE_UPDATED', (event) => {
            const payload = event.payload || {};
            const snapshot = payload.snapshot as any;
            if (snapshot) {
                if (typeof snapshot.sessionQualityScore === 'number') {
                    this.sessionQuality = snapshot.sessionQualityScore;
                }
                if (typeof snapshot.drawdown === 'number') {
                    this.drawdownPercent = snapshot.drawdown;
                }
            }
        });
    }

    public handleRoundProcessed(sessionId: string, payload: Record<string, unknown>): void {
        const strategyId = (payload.suggestedStrategy as string) || (payload.strategy as string) || 'MARKOV_TREND';
        const confidence = (payload.confidence as number) || 0.5;
        const consensus = (payload.consensus as number) || 0.5;
        const status = (payload.status as 'RECOMMENDATION' | 'BLOCK' | 'HOLD') || 'HOLD';
        const pnlDelta = (payload.pnlDelta as number) || 0;
        const isWin = payload.isWin as boolean | undefined;

        this.tracker.recordStrategyObservation(strategyId, status, confidence, consensus, pnlDelta, isWin);

        this.calibrateAndEmitSnapshot(sessionId);
    }

    public calibrateAndEmitSnapshot(sessionId: string = 'SESSION-000'): StrategyWeightSnapshot {
        const rawWeights: Record<string, number> = {};

        for (const stratId of this.KNOWN_STRATEGIES) {
            const record = this.tracker.getRecord(stratId);
            let rawScore = 1.0;

            if (record && record.sampleCount > 0) {
                const avgConf = record.totalConfidence / record.sampleCount;
                const avgCons = record.totalConsensus / record.sampleCount;
                const winRate = record.totalExecutions > 0 ? record.wins / record.totalExecutions : 0.5;
                rawScore = (avgConf * 0.4) + (avgCons * 0.3) + (winRate * 0.3);
            }

            // Regime alignment bonus
            if (this.currentRegime === 'TRENDING' && stratId.includes('TREND')) rawScore *= 1.3;
            if (this.currentRegime === 'MEAN_REVERSION' && stratId.includes('REVERSION')) rawScore *= 1.3;
            if (this.currentRegime === 'CHAOTIC') rawScore *= 0.7;

            const prevWeight = record ? record.currentWeight : 1.0;
            const decayed = this.decayCalculator.calculateDecayedWeight(prevWeight, rawScore);
            rawWeights[stratId] = decayed;
        }

        const normalizedUnits = this.normalizer.normalizeToUnit(rawWeights);

        const items: StrategyWeightItem[] = [];

        for (const stratId of this.KNOWN_STRATEGIES) {
            const finalWeight = normalizedUnits[stratId] || 0;
            this.tracker.updateWeight(stratId, finalWeight);

            const record = this.tracker.getRecord(stratId);
            const prevWeight = record ? record.previousWeight : finalWeight;

            let trend: 'UPWARD' | 'STABLE' | 'DOWNWARD' = 'STABLE';
            if (finalWeight - prevWeight > 0.01) trend = 'UPWARD';
            else if (finalWeight - prevWeight < -0.01) trend = 'DOWNWARD';

            const sampleCount = record ? record.sampleCount : 0;
            const avgConf = sampleCount > 0 ? record!.totalConfidence / sampleCount : 0.5;
            const avgCons = sampleCount > 0 ? record!.totalConsensus / sampleCount : 0.5;
            const shadowPnL = record ? record.shadowPnL : 0;
            const totalExec = record ? record.totalExecutions : 0;
            const wins = record ? record.wins : 0;
            const winRate = totalExec > 0 ? (wins / totalExec) * 100 : 50;

            items.push({
                strategyId: stratId,
                dynamicWeight: Math.round(finalWeight * 10000) / 10000,
                confidence: Math.round(avgConf * 100) / 100,
                consensus: Math.round(avgCons * 100) / 100,
                shadowPnL,
                winRate: Math.round(winRate * 10) / 10,
                totalExecutions: totalExec,
                trend
            });
        }

        const snapshotId = randomUUID();
        const timestampUtc = new Date().toISOString();
        const rawContent = `${snapshotId}:${sessionId}:${this.currentRegime}:${JSON.stringify(items)}`;
        const snapshotHash = createHash('sha256').update(rawContent).digest('hex');

        const snapshot: StrategyWeightSnapshot = Object.freeze({
            snapshotId,
            sessionId,
            timestampUtc,
            weights: Object.freeze(items),
            marketRegime: this.currentRegime,
            sessionQuality: this.sessionQuality,
            drawdown: this.drawdownPercent,
            snapshotHash
        });

        this.history.push(snapshot);

        if (this.ledger) {
            this.ledger.append(sessionId, '5.0.0', 'STRATEGY_WEIGHT_UPDATED', `Dynamic weights updated for ${items.length} strategies`);
            this.ledger.append(sessionId, '5.0.0', 'CALIBRATION_SNAPSHOT_CREATED', JSON.stringify({
                snapshotId,
                regime: this.currentRegime,
                snapshotHash
            }));
            this.ledger.append(sessionId, '5.0.0', 'CALIBRATION_DECAY_APPLIED', `Exponential decay factor lambda=${this.decayCalculator.getLambda()} applied`);
        }

        if (this.eventBus) {
            this.eventBus.publish('STRATEGY_WEIGHTS_CALIBRATED', '5.0.0', randomUUID(), sessionId, { snapshot });
        }

        return snapshot;
    }

    public getLatestSnapshot(sessionId: string = 'SESSION-000'): StrategyWeightSnapshot {
        const latest = this.history.getLatest(sessionId);
        if (!latest) {
            return this.calibrateAndEmitSnapshot(sessionId);
        }
        return latest;
    }

    public getCalibrationHistory(sessionId: string = 'SESSION-000'): ReadonlyArray<StrategyWeightSnapshot> {
        return this.history.getAll(sessionId);
    }

    public getStrategyWeights(sessionId: string = 'SESSION-000'): ReadonlyArray<StrategyWeightItem> {
        const snapshot = this.getLatestSnapshot(sessionId);
        return snapshot.weights;
    }
}
