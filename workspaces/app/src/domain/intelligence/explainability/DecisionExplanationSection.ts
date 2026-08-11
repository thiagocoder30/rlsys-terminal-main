export interface DecisionExplanationSection {
  readonly title: string;
  readonly description: string;
  readonly sourceEngine: string;
  readonly confidence: number;
  readonly evidenceReferences: string[];
}
