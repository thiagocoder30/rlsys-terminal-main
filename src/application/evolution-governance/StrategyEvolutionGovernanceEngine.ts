import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../runtime/DecisionLedger';
import { StrategyEvolutionRecommendation } from './StrategyEvolutionRecommendation';
import { StrategyEvolutionSnapshot } from './StrategyEvolutionSnapshot';
import { StrategyMaturityCalculator } from './StrategyMaturityCalculator';
import { StrategyLifecycleEvaluator } from './StrategyLifecycleEvaluator';
import { StrategyEvolutionHistory } from './StrategyEvolutionHistory';
import { createHash, randomUUID } from 'crypto';

export class StrategyEvolutionGovernanceEngine {
    private readonly maturityCalc = new StrategyMaturityCalculator();
    private readonly lifecycleEvaluator = new StrategyLifecycleEvaluator();
    private readonly history = new StrategyEvolutionHistory();
    
    private readonly recommendations = new Map<string, StrategyEvolutionRecommendation>();

    private currentLearningIndex = 0.5;
    private currentEvolutionIndex = 0.5;
    private currentPortfolioHealth = 0.5;
    private currentPredictiveStability = 0.5;
    
    private currentSessionId = 'SESSION-000';

    constructor(
        private readonly eventBus: ObservabilityEventBus,
        private readonly ledger: DecisionLedger
    ) {
        this.setupSubscriptions();
    }

    private setupSubscriptions(): void {
        this.eventBus.subscribe('LEARNING_SNAPSHOT_CREATED', (event) => {
            this.currentLearningIndex = event.payload?.overallLearningIndex as number ?? this.currentLearningIndex;
        });

        this.eventBus.subscribe('EVOLUTION_SNAPSHOT_CREATED', (event) => {
            this.currentEvolutionIndex = event.payload?.institutionalIntelligenceIndex as number ?? this.currentEvolutionIndex;
        });

        this.eventBus.subscribe('PORTFOLIO_HEALTH_UPDATED', (event) => {
            this.currentPortfolioHealth = event.payload?.portfolioHealth as number ?? this.currentPortfolioHealth;
        });

        this.eventBus.subscribe('PREDICTIVE_SCENARIO_CREATED', (event) => {
            this.currentPredictiveStability = event.payload?.stabilityIndex as number ?? this.currentPredictiveStability;
        });

        this.eventBus.subscribe('SESSION_PERFORMANCE_UPDATED', (event) => {
            this.currentSessionId = event.sessionId || this.currentSessionId;
            // Evaluate mock strategies based on event trigger to simulate governance cycles
            this.evaluateStrategy('STRAT-A', 0.9, 0.8, 0.2, this.currentSessionId);
            this.evaluateStrategy('STRAT-B', 0.6, 0.5, 0.6, this.currentSessionId);
            this.evaluateStrategy('STRAT-C', 0.2, 0.1, 0.8, this.currentSessionId);
            
            this.generateSnapshot();
        });
    }

    public evaluateStrategy(
        strategyId: string, 
        historicalSupport: number,
        portfolioContribution: number,
        riskScore: number,
        sessionId: string
    ): void {
        const maturity = this.maturityCalc.calculateMaturityIndex(
            historicalSupport, 
            this.currentLearningIndex, 
            this.currentEvolutionIndex, 
            this.currentPortfolioHealth // proxy for persistence in this mock
        );
        
        const recommendationStatus = this.lifecycleEvaluator.evaluateLifecycle(
            maturity,
            portfolioContribution,
            riskScore,
            this.currentPredictiveStability
        );

        const evidenceScore = (portfolioContribution + historicalSupport) / 2;
        const confidence = maturity;
        const timestamp = new Date().toISOString();
        const recommendationId = randomUUID();

        const raw = `${recommendationId}:${strategyId}:${recommendationStatus}:${confidence}:${evidenceScore}`;
        const hash = createHash('sha256').update(raw).digest('hex');

        const recommendation: StrategyEvolutionRecommendation = Object.freeze({
            recommendationId,
            strategyId,
            action: recommendationStatus,
            confidence,
            evidenceScore,
            historicalSupport,
            riskScore,
            timestamp,
            hash
        });

        this.recommendations.set(strategyId, recommendation);

        this.ledger.append(sessionId, '5.0.0', 'STRATEGY_EVOLUTION_RECOMMENDED', JSON.stringify({
            recommendationId,
            strategyId,
            action: recommendationStatus,
            confidence,
            hash
        }));

        if (recommendationStatus === 'PROMOTE') {
            this.ledger.append(sessionId, '5.0.0', 'STRATEGY_PROMOTION_SUGGESTED', JSON.stringify({ strategyId }));
        } else if (recommendationStatus === 'DEPRECATE') {
            this.ledger.append(sessionId, '5.0.0', 'STRATEGY_DEPRECATION_SUGGESTED', JSON.stringify({ strategyId }));
        } else if (recommendationStatus === 'RETIRE') {
            this.ledger.append(sessionId, '5.0.0', 'STRATEGY_RETIREMENT_SUGGESTED', JSON.stringify({ strategyId }));
        }
    }

    private generateSnapshot(): void {
        let promoted = 0;
        let watching = 0;
        let deprecated = 0;
        let retired = 0;
        let keep = 0;
        let totalMaturity = 0;
        
        const recsArray = Array.from(this.recommendations.values());

        for (const rec of recsArray) {
            totalMaturity += rec.confidence;
            if (rec.action === 'PROMOTE') promoted++;
            else if (rec.action === 'WATCH') watching++;
            else if (rec.action === 'DEPRECATE') deprecated++;
            else if (rec.action === 'RETIRE') retired++;
            else keep++;
        }

        const totalStrategies = recsArray.length;
        const averageMaturity = totalStrategies > 0 ? totalMaturity / totalStrategies : 0;
        const institutionalHealth = this.currentPortfolioHealth;
        const portfolioCoverage = (keep + promoted) / (totalStrategies || 1);

        const snapshotId = randomUUID();
        const timestamp = new Date().toISOString();

        const raw = `${snapshotId}:${totalStrategies}:${averageMaturity}:${institutionalHealth}`;
        const hash = createHash('sha256').update(raw).digest('hex');

        const snapshot: StrategyEvolutionSnapshot = Object.freeze({
            snapshotId,
            sessionId: this.currentSessionId,
            timestamp,
            totalStrategies,
            promoted,
            watching,
            deprecated,
            retired,
            institutionalHealth,
            averageMaturity,
            portfolioCoverage,
            recommendations: recsArray,
            hash
        });

        this.history.addSnapshot(snapshot);
    }

    public getHistory(): StrategyEvolutionHistory {
        return this.history;
    }
}
