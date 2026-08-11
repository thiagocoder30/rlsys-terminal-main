import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../runtime/DecisionLedger';
import { EvolutionSnapshot } from './EvolutionSnapshot';
import { EvolutionAggregator } from './EvolutionAggregator';
import { EvolutionIndexCalculator } from './EvolutionIndexCalculator';
import { EvolutionHistory } from './EvolutionHistory';
import { createHash, randomUUID } from 'crypto';

export class InstitutionalEvolutionEngine {
    private readonly aggregator = new EvolutionAggregator();
    private readonly calculator = new EvolutionIndexCalculator();
    private readonly history = new EvolutionHistory();

    constructor(
        private readonly eventBus: ObservabilityEventBus,
        private readonly ledger: DecisionLedger
    ) {
        this.setupSubscriptions();
    }

    private setupSubscriptions(): void {
        this.eventBus.subscribe('SESSION_PERFORMANCE_UPDATED', (event) => {
            this.aggregator.updatePerformance(event.payload);
            this.generateSnapshot(event.sessionId || 'SESSION-000');
        });
        
        this.eventBus.subscribe('MARKET_REGIME_UPDATED', (event) => {
            this.aggregator.updateRegime(event.payload);
            this.generateSnapshot(event.sessionId || 'SESSION-000');
        });
        
        this.eventBus.subscribe('STRATEGY_WEIGHT_UPDATED', (event) => {
            this.aggregator.updateCalibration(event.payload);
            this.generateSnapshot(event.sessionId || 'SESSION-000');
        });
        
        this.eventBus.subscribe('SHADOW_PERFORMANCE_UPDATED', (event) => {
            this.aggregator.updateShadow(event.payload);
            this.generateSnapshot(event.sessionId || 'SESSION-000');
        });
        
        this.eventBus.subscribe('FEEDBACK_APPROVED', (event) => {
            this.aggregator.updateFeedback(event.payload);
            this.generateSnapshot(event.sessionId || 'SESSION-000');
        });
        
        this.eventBus.subscribe('REPLAY_COMPLETED', (event) => {
            this.aggregator.updateReplay(event.payload);
            this.generateSnapshot(event.sessionId || 'SESSION-000');
        });
        
        this.eventBus.subscribe('KNOWLEDGE_UPDATED', (event) => {
            this.aggregator.updateKnowledge(event.payload);
            this.generateSnapshot(event.sessionId || 'SESSION-000');
        });

        this.eventBus.subscribe('LEARNING_SNAPSHOT_CREATED', (event) => {
            this.aggregator.updateLearning(event.payload);
            this.generateSnapshot(event.sessionId || 'SESSION-000');
        });
    }

    private generateSnapshot(sessionId: string): void {
        const timestamp = new Date().toISOString();
        const snapshotId = randomUUID();
        const scores = this.aggregator.getScores();

        const calculated = this.calculator.calculateEvolution(
            scores.learningScore,
            scores.knowledgeScore,
            scores.feedbackScore,
            scores.shadowScore,
            scores.performanceScore,
            scores.regimeScore,
            scores.calibrationScore,
            scores.replayScore
        );

        const raw = `${snapshotId}:${sessionId}:${timestamp}:${calculated.institutionalIntelligenceIndex}:${calculated.operationalEvolutionScore}`;
        const hash = createHash('sha256').update(raw).digest('hex');

        const snapshot: EvolutionSnapshot = Object.freeze({
            snapshotId,
            timestamp,
            sessionId,
            ...calculated,
            hash
        });

        this.history.addSnapshot(snapshot);

        this.ledger.append(sessionId, '5.0.0', 'EVOLUTION_SNAPSHOT_CREATED', JSON.stringify({ snapshotId, hash, institutionalIntelligenceIndex: calculated.institutionalIntelligenceIndex }));
        this.ledger.append(sessionId, '5.0.0', 'EVOLUTION_INDEX_UPDATED', JSON.stringify({ snapshotId, operationalEvolutionScore: calculated.operationalEvolutionScore }));
        this.ledger.append(sessionId, '5.0.0', 'INSTITUTIONAL_EVOLUTION_UPDATED', JSON.stringify({ snapshotId, timestamp }));
    }

    public getHistory(): EvolutionHistory {
        return this.history;
    }
}
