import { StrategyRankingService, StrategyPerformanceMetrics } from './StrategyRankingService';
import { StakeRecommendationService, StakeRecommendationInput } from './StakeRecommendationService';
import { DecisionExplanationService, DecisionContextInput } from './DecisionExplanationService';
import { OperationalDecisionDTO, StrategyRankingDTO } from './dto/OperationalDecisionDTO';

export interface RecommendationEngineInput {
    readonly bankroll: number;
    readonly preFlightStatus: 'APPROVED' | 'REJECTED';
    readonly lockReason: string | null;
    readonly consensusLevel: number; 
    readonly confidenceLevel: number; 
    readonly riskLevel: number;
    readonly adaptiveScore: number;
    readonly availableStrategies: StrategyPerformanceMetrics[];
}

const STRATEGY_COVERAGE_MAP: Record<string, number> = {
    "ZONE_VOISINS": 9,
    "ZONE_TIERS": 6,
    "ZONE_ORPHELINS": 5,
    "SECTOR_ZERO_GAME": 4,
    "SECTOR_POTINHO": 6,
    "CROSS_TERMINAL_7": 3,
    "CROSS_TERMINAL_9": 3,
    "FUSION_REDUZIDA": 8
};

export class StrategyRecommendationEngine {
    constructor(
        private readonly rankingService = new StrategyRankingService(),
        private readonly stakeService = new StakeRecommendationService(),
        private readonly explainerService = new DecisionExplanationService()
    ) {}

    public generateRecommendation(input: RecommendationEngineInput): OperationalDecisionDTO {
        const ranking = this.rankingService.rank(input.availableStrategies);
        
        let selectedStrategy = null;
        let stake = 0;
        let isOpportunity = false;
        let bankrollInsufficient = false;

        const maxAllowedStake = input.bankroll * 0.05;
        
        if (input.preFlightStatus === 'APPROVED' && ranking.length > 0) {
            for (const strat of ranking) {
                if (strat.score >= 50 && input.consensusLevel >= 0.3 && input.confidenceLevel >= 0.4) {
                    const coverage = STRATEGY_COVERAGE_MAP[strat.strategyId] || 1;
                    const calculatedStake = this.stakeService.calculateStake({
                        bankroll: input.bankroll,
                        confidence: input.confidenceLevel,
                        consensusLevel: input.consensusLevel,
                        riskLevel: input.riskLevel,
                        adaptiveScore: input.adaptiveScore,
                        minChipValue: 0.50,
                        strategyCoverage: coverage
                    });

                    if (calculatedStake > 0 && calculatedStake <= maxAllowedStake) {
                        isOpportunity = true;
                        selectedStrategy = strat.strategyId;
                        stake = calculatedStake;
                        break;
                    } else {
                        bankrollInsufficient = true;
                    }
                }
            }
        }
        
        if (stake <= 0) {
            isOpportunity = false;
            selectedStrategy = null;
            stake = 0;
        }

        const explanation = this.explainerService.generateExplanation({
            isOpportunity,
            strategy: selectedStrategy,
            confidence: input.confidenceLevel,
            consensus: input.consensusLevel,
            riskLevel: input.riskLevel,
            preFlightStatus: input.preFlightStatus,
            lockReason: input.lockReason,
            adaptiveScore: input.adaptiveScore,
            bankrollInsufficient
        });

        const normConfidence = Math.min(0.999, input.confidenceLevel > 1 ? input.confidenceLevel / 100 : input.confidenceLevel);
        const normConsensus = Math.min(0.999, input.consensusLevel > 1 ? input.consensusLevel / 100 : input.consensusLevel);

        return {
            isOpportunity,
            strategy: selectedStrategy,
            ranking,
            confidence: normConfidence,
            consensus: normConsensus,
            risk: input.riskLevel,
            stake,
            bankroll: input.bankroll,
            adaptiveScore: input.adaptiveScore,
            ensembleScore: normConsensus * 100,
            preFlightStatus: input.preFlightStatus,
            explanation,
            lockReason: input.lockReason,
            generatedAt: new Date().toISOString()
        };
    }
}

