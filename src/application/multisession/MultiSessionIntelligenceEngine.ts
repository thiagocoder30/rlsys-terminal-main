import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../runtime/DecisionLedger';
import { GlobalSessionSnapshot } from './GlobalSessionSnapshot';
import { SessionCorrelationEngine } from './SessionCorrelationEngine';
import { HistoricalPatternDetector } from './HistoricalPatternDetector';
import { MultiSessionHistory } from './MultiSessionHistory';
import { createHash, randomUUID } from 'crypto';

export class MultiSessionIntelligenceEngine {
    private readonly correlationEngine = new SessionCorrelationEngine();
    private readonly patternDetector = new HistoricalPatternDetector();
    private readonly history = new MultiSessionHistory();

    private currentRegime = 'UNKNOWN';
    private currentPerformanceScore = 0.5;
    private currentLearningIndex = 0.5;
    private currentEvolutionIndex = 0.5;
    
    // Simulating historical averages
    private historicalPerformanceAvg = 0.5;
    private historicalEvolutionAvg = 0.5;
    private sessionCount = 0;

    constructor(
        private readonly eventBus: ObservabilityEventBus,
        private readonly ledger: DecisionLedger
    ) {
        this.setupSubscriptions();
    }

    private setupSubscriptions(): void {
        this.eventBus.subscribe('MARKET_REGIME_UPDATED', (event) => {
            this.currentRegime = event.payload?.regime as string || this.currentRegime;
        });

        this.eventBus.subscribe('SESSION_PERFORMANCE_UPDATED', (event) => {
            this.currentPerformanceScore = event.payload?.performanceScore as number ?? this.currentPerformanceScore;
        });

        this.eventBus.subscribe('LEARNING_SNAPSHOT_CREATED', (event) => {
            this.currentLearningIndex = event.payload?.overallLearningIndex as number ?? this.currentLearningIndex;
        });

        this.eventBus.subscribe('EVOLUTION_SNAPSHOT_CREATED', (event) => {
            this.currentEvolutionIndex = event.payload?.institutionalIntelligenceIndex as number ?? this.currentEvolutionIndex;
        });
        
        this.eventBus.subscribe('PREDICTIVE_SCENARIO_CREATED', (event) => {
            // Also triggers evaluation, demonstrating cross-layer correlation
            this.evaluateMultiSession(event.sessionId || 'GLOBAL-000');
        });

        this.eventBus.subscribe('SESSION_FINISHED', (event) => {
            this.sessionCount++;
            // Update "historical" averages slightly
            this.historicalPerformanceAvg = (this.historicalPerformanceAvg * 0.9) + (this.currentPerformanceScore * 0.1);
            this.historicalEvolutionAvg = (this.historicalEvolutionAvg * 0.9) + (this.currentEvolutionIndex * 0.1);
            
            this.evaluateMultiSession(event.sessionId || 'GLOBAL-000');
        });
    }

    private evaluateMultiSession(sessionId: string): void {
        const correlationIndex = this.correlationEngine.calculateCorrelationIndex(
            this.currentPerformanceScore,
            this.historicalPerformanceAvg,
            this.currentEvolutionIndex,
            this.historicalEvolutionAvg
        );

        const recurringPatterns = this.patternDetector.detectPatterns(
            this.currentRegime,
            correlationIndex,
            this.currentLearningIndex
        );

        const seasonalityScore = this.patternDetector.calculateSeasonalityScore(this.sessionCount, correlationIndex);
        const stabilityIndex = this.patternDetector.calculateStabilityIndex(correlationIndex, this.currentEvolutionIndex);
        
        const institutionalConfidence = (stabilityIndex + correlationIndex) / 2.0;

        const timestamp = new Date().toISOString();
        const globalSessionId = randomUUID();

        const raw = `${globalSessionId}:${timestamp}:${correlationIndex}:${stabilityIndex}:${recurringPatterns.join(',')}`;
        const hash = createHash('sha256').update(raw).digest('hex');

        const snapshot: GlobalSessionSnapshot = Object.freeze({
            globalSessionId,
            timestamp,
            correlationIndex,
            stabilityIndex,
            recurringPatterns,
            seasonalityScore,
            institutionalConfidence,
            hash
        });

        this.history.addSnapshot(snapshot);

        this.ledger.append(sessionId, '5.0.0', 'MULTI_SESSION_UPDATED', JSON.stringify({ 
            globalSessionId, 
            correlationIndex 
        }));
        
        if (recurringPatterns.length > 0) {
            for (const pattern of recurringPatterns) {
                this.ledger.append(sessionId, '5.0.0', 'GLOBAL_PATTERN_DETECTED', JSON.stringify({ 
                    globalSessionId, 
                    patternId: pattern,
                    correlationIndex,
                    hash
                }));
            }
        }
        
        this.ledger.append(sessionId, '5.0.0', 'GLOBAL_SESSION_SNAPSHOT_CREATED', JSON.stringify({ 
            globalSessionId, 
            timestamp,
            hash 
        }));
    }

    public getHistory(): MultiSessionHistory {
        return this.history;
    }
}
