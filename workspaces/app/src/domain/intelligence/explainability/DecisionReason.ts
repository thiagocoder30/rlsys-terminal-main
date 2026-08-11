export interface DecisionReason {
  readonly id: string;
  readonly category: string;
  readonly description: string;
  readonly importance: 'HIGH' | 'MEDIUM' | 'LOW';
  readonly evidence: Record<string, unknown>;
}
