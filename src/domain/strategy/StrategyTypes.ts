export type StrategyName =
  | 'TRIPLICACAO'
  | 'FUSION_REDUZIDA';

export interface StrategyResult {
  score: number;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface IStrategy {
  name: StrategyName;
  analyze(input: unknown): StrategyResult;
  explain(input: unknown): string;
  confidence(input: unknown): number;
}
