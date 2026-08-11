export interface DecisionAnalysis<T = unknown> {
  readonly engineName: string;
  readonly status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  readonly score: number;
  readonly value: T;
  readonly messages: string[];
}
