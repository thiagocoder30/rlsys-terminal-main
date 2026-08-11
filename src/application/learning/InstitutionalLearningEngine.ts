import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../runtime/DecisionLedger';
import { LearningSnapshot } from './LearningSnapshot';
import { LearningAggregator } from './LearningAggregator';
import { LearningIndexCalculator } from './LearningIndexCalculator';
import { LearningHistory } from './LearningHistory';
import { createHash, randomUUID } from 'crypto';

export class InstitutionalLearningEngine {
    private readonly aggregator = new LearningAggregator();
    private readonly calculator = new LearningIndexCalculator();
    private readonly history = new LearningHistory();

    constructor(
        private readonly eventBus: ObservabilityEventBus,
        private readonly ledger: DecisionLedger
    ) {
        this.setupSubscriptions();
    }

    private setupSubscriptions(): void {
        this.eventBus.subscribe('SESSION_PERFORMANCE_UPDATED', (event) => {
            this.aggregator.updatePerformanceScore(event.payload);
            this.generateSnapshot(event.sessionId || 'SESSION-000');
        });
        
        this.eventBus.subscribe('MARKET_REGIME_UPDATED', (event) => {
            this.aggregator.updateRegimeScore(event.payload);
            this.generateSnapshot(event.sessionId || 'SESSION-000');
        });
        
        this.eventBus.subscribe('STRATEGY_WEIGHT_UPDATED', (event) => {
            this.aggregator.updateCalibrationScore(event.payload);
            this.generateSnapshot(event.sessionId || 'SESSION-000');
        });
        
        this.eventBus.subscribe('SHADOW_PERFORMANCE_UPDATED', (event) => {
            this.aggregator.updateShadowScore(event.payload);
            this.generateSnapshot(event.sessionId || 'SESSION-000');
        });
        
        this.eventBus.subscribe('FEEDBACK_APPROVED', (event) => {
            this.aggregator.updateFeedbackScore(event.payload);
            this.generateSnapshot(event.sessionId || 'SESSION-000');
        });
        
        this.eventBus.subscribe('REPLAY_COMPLETED', (event) => {
            this.aggregator.updateReplayScore(event.payload);
            this.generateSnapshot(event.sessionId || 'SESSION-000');
        });
        
        this.eventBus.subscribe('KNOWLEDGE_UPDATED', (event) => {
            this.aggregator.updateKnowledgeScore(event.payload);
            this.generateSnapshot(event.sessionId || 'SESSION-000');
        });
    }

    private generateSnapshot(sessionId: string): void {
        const timestamp = new Date().toISOString();
        const snapshotId = randomUUID();
        const scores = this.aggregator.getScores();

        const overallLearningIndex = this.calculator.calculateOverallIndex(
            scores.performanceScore,
            scores.knowledgeScore,
            scores.feedbackScore,
            scores.shadowScore,
            scores.replayScore,
            scores.regimeScore,
            scores.calibrationScore
        );
        const learningStability = this.calculator.calculateStability(overallLearningIndex);
        const institutionalConfidence = this.calculator.calculateInstitutionalConfidence(
            scores.knowledgeScore,
            scores.feedbackScore,
            scores.shadowScore
        );

        const raw = `${snapshotId}:${sessionId}:${timestamp}:${overallLearningIndex}:${institutionalConfidence}`;
        const hash = createHash('sha256').update(raw).digest('hex');

        const snapshot: LearningSnapshot = Object.freeze({
            snapshotId,
            timestamp,
            sessionId,
            ...scores,
            overallLearningIndex,
            learningStability,
            institutionalConfidence,
            hash
        });

        this.history.addSnapshot(snapshot);

        this.ledger.append(sessionId, '5.0.0', 'LEARNING_SNAPSHOT_CREATED', JSON.stringify({ snapshotId, hash, overallLearningIndex }));
        this.ledger.append(sessionId, '5.0.0', 'INSTITUTIONAL_LEARNING_UPDATED', JSON.stringify({ snapshotId, timestamp }));
        this.ledger.append(sessionId, '5.0.0', 'LEARNING_SUMMARY_UPDATED', JSON.stringify({ overallLearningIndex, learningStability, institutionalConfidence }));
    }

    public getHistory(): LearningHistory {
        return this.history;
    }
}
