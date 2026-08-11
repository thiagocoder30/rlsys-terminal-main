import { randomUUID, createHash } from 'crypto';
import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../runtime/DecisionLedger';
import { RegimeClassifier } from './RegimeClassifier';
import { RegimeTransitionDetector } from './RegimeTransitionDetector';
import { StrategyEligibilityMatrix } from './StrategyEligibilityMatrix';
import { RegimeSnapshot, MarketRegimeType } from './RegimeSnapshot';

export class MarketRegimeEngine {
    private readonly classifier = new RegimeClassifier();
    private readonly transitionDetector = new RegimeTransitionDetector();
    private readonly eligibilityMatrix = new StrategyEligibilityMatrix();

    private readonly snapshots: RegimeSnapshot[] = [];
    private sampleCount = 0;

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

        this.eventBus.subscribe('SESSION_UPDATED', (event) => {
            const payload = event.payload || {};
            const sessionId = event.sessionId || 'SESSION-000';
            this.handleSessionUpdated(sessionId, payload);
        });
    }

    public handleRoundProcessed(sessionId: string, payload: Record<string, unknown>): void {
        this.sampleCount++;
        const vix = (payload.vix as number) || (payload.operationalVix as number) || 25;
        const entropy = (payload.entropy as number) || 0.95;
        const confidence = (payload.confidence as number) || 0.5;
        const consensus = (payload.consensus as number) || 0.5;

        this.evaluateAndEmitSnapshot(sessionId, { vix, entropy, confidence, consensus });
    }

    public handleSessionUpdated(sessionId: string, payload: Record<string, unknown>): void {
        const latest = this.getLatestSnapshot(sessionId);
        this.evaluateAndEmitSnapshot(sessionId, {
            vix: latest.indicatorsUsed.vix,
            entropy: latest.indicatorsUsed.entropy,
            confidence: latest.indicatorsUsed.confidence,
            consensus: latest.indicatorsUsed.consensus
        });
    }

    public evaluateAndEmitSnapshot(
        sessionId: string = 'SESSION-000',
        indicators: { vix: number; entropy: number; confidence: number; consensus: number } = { vix: 25, entropy: 0.95, confidence: 0.5, consensus: 0.5 }
    ): RegimeSnapshot {
        const { regime, confidenceScore } = this.classifier.classify({
            ...indicators,
            sampleCount: this.sampleCount
        });

        const transitionResult = this.transitionDetector.update(regime);
        const eligibleFamilies = this.eligibilityMatrix.getEligibleFamilies(regime);

        const snapshotId = randomUUID();
        const timestampUtc = new Date().toISOString();

        const rawData = `${snapshotId}:${sessionId}:${regime}:${transitionResult.stabilityIndex}:${confidenceScore}`;
        const snapshotHash = createHash('sha256').update(rawData).digest('hex');

        const snapshot: RegimeSnapshot = Object.freeze({
            snapshotId,
            sessionId,
            timestampUtc,
            currentRegime: regime,
            previousRegime: transitionResult.previous,
            stabilityIndex: transitionResult.stabilityIndex,
            confidenceScore,
            persistenceCount: transitionResult.persistenceCount,
            transitionCount: transitionResult.transitionCount,
            eligibleStrategyFamilies: eligibleFamilies,
            indicatorsUsed: Object.freeze({ ...indicators }),
            snapshotHash
        });

        this.snapshots.push(snapshot);
        if (this.snapshots.length > 500) {
            this.snapshots.shift();
        }

        if (this.eventBus) {
            this.eventBus.publish('MARKET_REGIME_UPDATED', '5.0.0', randomUUID(), sessionId, { snapshot });
        }

        if (this.ledger) {
            if (transitionResult.changed) {
                this.ledger.append(sessionId, '5.0.0', 'MARKET_REGIME_CHANGED', `Market regime transitioned from ${transitionResult.previous} to ${regime}`);
            }
            this.ledger.append(sessionId, '5.0.0', 'REGIME_SNAPSHOT_CREATED', JSON.stringify({
                regime,
                stabilityIndex: transitionResult.stabilityIndex,
                confidenceScore,
                snapshotHash
            }));
        }

        return snapshot;
    }

    public getLatestSnapshot(sessionId: string = 'SESSION-000'): RegimeSnapshot {
        if (this.snapshots.length === 0) {
            return this.evaluateAndEmitSnapshot(sessionId);
        }
        return this.snapshots[this.snapshots.length - 1];
    }

    public getSnapshotHistory(sessionId: string = 'SESSION-000'): ReadonlyArray<RegimeSnapshot> {
        return this.snapshots.filter(s => s.sessionId === sessionId || s.sessionId === 'SESSION-000');
    }

    public getCurrentRegimeInfo(sessionId: string = 'SESSION-000'): {
        currentRegime: MarketRegimeType;
        stabilityIndex: number;
        confidenceScore: number;
        persistenceCount: number;
        eligibleStrategyFamilies: ReadonlyArray<string>;
    } {
        const latest = this.getLatestSnapshot(sessionId);
        return {
            currentRegime: latest.currentRegime,
            stabilityIndex: latest.stabilityIndex,
            confidenceScore: latest.confidenceScore,
            persistenceCount: latest.persistenceCount,
            eligibleStrategyFamilies: latest.eligibleStrategyFamilies
        };
    }
}
