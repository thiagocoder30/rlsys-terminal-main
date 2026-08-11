export type RecommendationAction = 'OBSERVE' | 'ENTER' | 'ABORT';

export interface DecisionRecommendation {
  readonly action: RecommendationAction;
  readonly targetNumbers?: number[];
  readonly confidenceLevel: number;
  readonly rationale: string;
}
