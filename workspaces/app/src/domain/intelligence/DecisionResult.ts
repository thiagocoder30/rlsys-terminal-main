import { DecisionRecommendation } from './DecisionRecommendation';
import { StrategyRanking } from './strategy/StrategyRanking';

export interface IndicatorMetrics {
  readonly probabilityData: Record<string, unknown>;
  readonly entropyValue: number;
  readonly zScoreValue: number;
  readonly vixValue: number;
  readonly strategyRankings: StrategyRanking | Record<string, number>;
}

export interface DecisionResult {
  readonly contextId: string;
  readonly timestamp: string;
  readonly recommendation: DecisionRecommendation;
  readonly metrics: IndicatorMetrics;
}
