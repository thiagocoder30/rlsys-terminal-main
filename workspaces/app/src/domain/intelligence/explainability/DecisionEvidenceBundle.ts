export interface DecisionEvidenceBundle {
  readonly markovReferences: Record<string, unknown>;
  readonly shannonReferences: Record<string, unknown>;
  readonly vixReferences: Record<string, unknown>;
  readonly zScoreReferences: Record<string, unknown>;
  readonly strategyRankingReferences: Record<string, unknown>;
}
