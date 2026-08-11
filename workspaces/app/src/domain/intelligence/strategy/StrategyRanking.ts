import { StrategyScore } from './StrategyScore';
import { StrategyCandidate } from './StrategyCandidate';

export interface StrategyRanking {
  orderedStrategies: StrategyScore[];
  bestCandidate: StrategyCandidate | null;
  scoreBreakdown: Record<string, StrategyScore>;
  rankingMetadata: {
    timestamp: string;
    sampleSize: number;
    evaluatedCount: number;
  };
}
