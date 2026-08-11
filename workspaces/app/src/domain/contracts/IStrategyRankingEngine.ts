import { DecisionContext } from '../intelligence/DecisionContext';
import { StrategyRanking } from '../intelligence/strategy/StrategyRanking';

export interface IStrategyRankingEngine {
  rankStrategies(context: DecisionContext): StrategyRanking;
}
