import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../runtime/DecisionLedger';
import { ScenarioSnapshot } from './ScenarioSnapshot';
import { ScenarioGenerator } from './ScenarioGenerator';
import { ScenarioHistory } from './ScenarioHistory';
import { createHash, randomUUID } from 'crypto';
import { ScenarioProbabilityCalculator } from './ScenarioProbabilityCalculator';

export class PredictiveScenarioEngine {
    private readonly calculator = new ScenarioProbabilityCalculator();
    private readonly generator = new ScenarioGenerator(this.calculator);
    private readonly history = new ScenarioHistory();

    private currentRegime = 'UNKNOWN';
    private currentPerformanceScore = 0.5;
    private currentKnowledgeVersion = '1.0.0';
    private currentLearningIndex = 0.5;
    private currentEvolutionIndex = 0.5;

    constructor(
        private readonly eventBus: ObservabilityEventBus,
        private readonly ledger: DecisionLedger
    ) {
        this.setupSubscriptions();
    }

    private setupSubscriptions(): void {
        this.eventBus.subscribe('MARKET_REGIME_UPDATED', (event) => {
            this.currentRegime = event.payload?.regime as string || this.currentRegime;
            this.evaluateScenarios(event.sessionId || 'SESSION-000');
        });

        this.eventBus.subscribe('SESSION_PERFORMANCE_UPDATED', (event) => {
            this.currentPerformanceScore = event.payload?.performanceScore as number ?? this.currentPerformanceScore;
            this.evaluateScenarios(event.sessionId || 'SESSION-000');
        });

        this.eventBus.subscribe('KNOWLEDGE_UPDATED', (event) => {
            this.currentKnowledgeVersion = event.payload?.version as string || this.currentKnowledgeVersion;
            this.evaluateScenarios(event.sessionId || 'SESSION-000');
        });

        this.eventBus.subscribe('LEARNING_SNAPSHOT_CREATED', (event) => {
            this.currentLearningIndex = event.payload?.overallLearningIndex as number ?? this.currentLearningIndex;
            this.evaluateScenarios(event.sessionId || 'SESSION-000');
        });

        this.eventBus.subscribe('EVOLUTION_SNAPSHOT_CREATED', (event) => {
            this.currentEvolutionIndex = event.payload?.institutionalIntelligenceIndex as number ?? this.currentEvolutionIndex;
            this.evaluateScenarios(event.sessionId || 'SESSION-000');
        });
        
        this.eventBus.subscribe('ROUND_PROCESSED', (event) => {
            this.evaluateScenarios(event.sessionId || 'SESSION-000');
        });
    }

    private evaluateScenarios(sessionId: string): void {
        const scenarios = this.generator.generateScenarios(
            this.currentRegime,
            this.currentPerformanceScore,
            this.currentLearningIndex,
            this.currentEvolutionIndex
        );

        if (scenarios.length === 0) return;

        const dominantScenario = scenarios[0];
        const probabilityDistribution: Record<string, number> = {};
        for (const s of scenarios) {
            probabilityDistribution[s.expectedOutcome] = s.probability;
        }

        const timestamp = new Date().toISOString();
        const snapshotId = randomUUID();

        const raw = `${snapshotId}:${sessionId}:${timestamp}:${dominantScenario.expectedOutcome}:${dominantScenario.confidence}`;
        const hash = createHash('sha256').update(raw).digest('hex');

        const snapshot: ScenarioSnapshot = Object.freeze({
            snapshotId,
            timestamp,
            sessionId,
            dominantScenario: dominantScenario.expectedOutcome,
            confidence: dominantScenario.confidence,
            probabilityDistribution,
            knowledgeVersion: this.currentKnowledgeVersion,
            learningIndex: this.currentLearningIndex,
            evolutionIndex: this.currentEvolutionIndex,
            hash
        });

        this.history.addSnapshot(snapshot);

        this.ledger.append(sessionId, '5.0.0', 'PREDICTIVE_SCENARIO_CREATED', JSON.stringify({ 
            scenarioId: dominantScenario.scenarioId, 
            confidence: dominantScenario.confidence,
            dominantScenario: dominantScenario.expectedOutcome 
        }));
        
        this.ledger.append(sessionId, '5.0.0', 'SCENARIO_SNAPSHOT_CREATED', JSON.stringify({ 
            snapshotId, 
            timestamp,
            hash 
        }));
        
        this.ledger.append(sessionId, '5.0.0', 'SCENARIO_CONFIDENCE_UPDATED', JSON.stringify({ 
            snapshotId,
            confidence: dominantScenario.confidence 
        }));
    }

    public getHistory(): ScenarioHistory {
        return this.history;
    }
}
