import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../runtime/DecisionLedger';
import { PortfolioSnapshot, StrategyContribution, RegimeExposure } from './PortfolioSnapshot';
import { PortfolioHealthCalculator } from './PortfolioHealthCalculator';
import { PortfolioDiversificationCalculator } from './PortfolioDiversificationCalculator';
import { PortfolioCorrelationEngine } from './PortfolioCorrelationEngine';
import { PortfolioHistory } from './PortfolioHistory';
import { createHash, randomUUID } from 'crypto';

export class PortfolioIntelligenceEngine {
    private readonly healthCalc = new PortfolioHealthCalculator();
    private readonly divCalc = new PortfolioDiversificationCalculator();
    private readonly corrEngine = new PortfolioCorrelationEngine();
    private readonly history = new PortfolioHistory();

    private currentRegime = 'UNKNOWN';
    private currentLearningIndex = 0.5;
    private currentEvolutionIndex = 0.5;
    
    // Track strategies by ID and their mock contribution score (0-1)
    private activeStrategies = new Map<string, number>();

    constructor(
        private readonly eventBus: ObservabilityEventBus,
        private readonly ledger: DecisionLedger
    ) {
        this.setupSubscriptions();
    }

    private setupSubscriptions(): void {
        this.eventBus.subscribe('MARKET_REGIME_UPDATED', (event) => {
            this.currentRegime = event.payload?.regime as string || this.currentRegime;
            this.evaluatePortfolio(event.sessionId || 'SESSION-000');
        });

        this.eventBus.subscribe('SESSION_PERFORMANCE_UPDATED', (event) => {
            // Update strategies based on some mock data if they exist
            this.evaluatePortfolio(event.sessionId || 'SESSION-000');
        });

        this.eventBus.subscribe('LEARNING_SNAPSHOT_CREATED', (event) => {
            this.currentLearningIndex = event.payload?.overallLearningIndex as number ?? this.currentLearningIndex;
        });

        this.eventBus.subscribe('EVOLUTION_SNAPSHOT_CREATED', (event) => {
            this.currentEvolutionIndex = event.payload?.institutionalIntelligenceIndex as number ?? this.currentEvolutionIndex;
        });

        this.eventBus.subscribe('MULTI_SESSION_UPDATED', (event) => {
            this.evaluatePortfolio(event.sessionId || 'SESSION-000');
        });

        // Add mock strategies for simulation
        this.activeStrategies.set('STRAT-A', 0.8);
        this.activeStrategies.set('STRAT-B', 0.6);
        this.activeStrategies.set('STRAT-C', 0.4);
    }

    private evaluatePortfolio(sessionId: string): void {
        const contributions: StrategyContribution[] = Array.from(this.activeStrategies.entries()).map(([id, score]) => ({
            strategyId: id,
            contributionScore: score
        }));

        const diversificationIndex = this.divCalc.calculateDiversification(contributions);
        const concentrationIndex = this.divCalc.calculateConcentration(contributions);
        const overallCorrelation = this.corrEngine.calculateOverallCorrelation(contributions);
        const correlationMatrix = this.corrEngine.buildCorrelationMatrix(contributions);
        
        const portfolioConfidence = (this.currentLearningIndex + this.currentEvolutionIndex) / 2.0;
        
        const portfolioHealth = this.healthCalc.calculateHealth(
            diversificationIndex,
            concentrationIndex,
            portfolioConfidence,
            overallCorrelation
        );

        const regimeExposure: RegimeExposure[] = [
            { regime: this.currentRegime, exposurePercentage: 0.8 },
            { regime: 'OTHER', exposurePercentage: 0.2 }
        ];

        const riskDistribution: Record<string, number> = {
            'LOW': 0.5,
            'MEDIUM': 0.3,
            'HIGH': 0.2
        };

        const timestamp = new Date().toISOString();
        const snapshotId = randomUUID();

        const raw = `${snapshotId}:${timestamp}:${portfolioHealth}:${diversificationIndex}:${concentrationIndex}`;
        const hash = createHash('sha256').update(raw).digest('hex');

        const snapshot: PortfolioSnapshot = Object.freeze({
            snapshotId,
            timestamp,
            sessionId,
            portfolioHealth,
            diversificationIndex,
            concentrationIndex,
            portfolioConfidence,
            correlationMatrix,
            riskDistribution,
            strategyContributions: contributions,
            regimeExposure,
            hash
        });

        this.history.addSnapshot(snapshot);

        this.ledger.append(sessionId, '5.0.0', 'PORTFOLIO_SNAPSHOT_CREATED', JSON.stringify({ 
            snapshotId, 
            portfolioHealth,
            hash
        }));
        
        this.ledger.append(sessionId, '5.0.0', 'PORTFOLIO_HEALTH_UPDATED', JSON.stringify({ 
            snapshotId, 
            portfolioHealth 
        }));

        this.ledger.append(sessionId, '5.0.0', 'PORTFOLIO_DIVERSIFICATION_UPDATED', JSON.stringify({ 
            snapshotId, 
            diversificationIndex,
            concentrationIndex 
        }));
    }

    public getHistory(): PortfolioHistory {
        return this.history;
    }
}
