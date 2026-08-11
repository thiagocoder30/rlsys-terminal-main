export interface DecisionEvidence {
  readonly metricId: string;
  readonly value: unknown;
  readonly confidence: number;
  readonly timestamp: string;
}
