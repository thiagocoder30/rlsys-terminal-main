import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';

export interface InstitutionalEvidence {
    knowledgeCoverage: number;
    learningIndex: number;
    evolutionIndex: number;
    portfolioHealth: number;
    portfolioDiversification: number;
    predictionConfidence: number;
    strategyMaturity: number;
    shadowAccuracy: number;
    replayConsistency: number;
}

export class InstitutionalDecisionAggregator {
    private currentEvidence: InstitutionalEvidence = {
        knowledgeCoverage: 0.5,
        learningIndex: 0.5,
        evolutionIndex: 0.5,
        portfolioHealth: 0.5,
        portfolioDiversification: 0.5,
        predictionConfidence: 0.5,
        strategyMaturity: 0.5,
        shadowAccuracy: 0.5,
        replayConsistency: 0.5
    };

    constructor(private readonly eventBus: ObservabilityEventBus) {
        this.setupSubscriptions();
    }

    private setupSubscriptions(): void {
        this.eventBus.subscribe('LEARNING_SNAPSHOT_CREATED', (event) => {
            this.currentEvidence.learningIndex = event.payload?.overallLearningIndex as number ?? this.currentEvidence.learningIndex;
        });

        this.eventBus.subscribe('EVOLUTION_SNAPSHOT_CREATED', (event) => {
            this.currentEvidence.evolutionIndex = event.payload?.institutionalIntelligenceIndex as number ?? this.currentEvidence.evolutionIndex;
        });

        this.eventBus.subscribe('KNOWLEDGE_UPDATED', (event) => {
            this.currentEvidence.knowledgeCoverage = event.payload?.coverage as number ?? this.currentEvidence.knowledgeCoverage;
        });

        this.eventBus.subscribe('PREDICTIVE_SCENARIO_CREATED', (event) => {
            this.currentEvidence.predictionConfidence = event.payload?.confidenceIndex as number ?? this.currentEvidence.predictionConfidence;
        });

        this.eventBus.subscribe('PORTFOLIO_UPDATED', (event) => {
            this.currentEvidence.portfolioHealth = event.payload?.portfolioHealth as number ?? this.currentEvidence.portfolioHealth;
            this.currentEvidence.portfolioDiversification = event.payload?.diversificationIndex as number ?? this.currentEvidence.portfolioDiversification;
        });

        this.eventBus.subscribe('STRATEGY_EVOLUTION_UPDATED', (event) => {
            this.currentEvidence.strategyMaturity = event.payload?.averageMaturity as number ?? this.currentEvidence.strategyMaturity;
        });

        this.eventBus.subscribe('SHADOW_PERFORMANCE_UPDATED', (event) => {
            this.currentEvidence.shadowAccuracy = event.payload?.accuracy as number ?? this.currentEvidence.shadowAccuracy;
        });
    }

    public getEvidence(): InstitutionalEvidence {
        return { ...this.currentEvidence };
    }
}
