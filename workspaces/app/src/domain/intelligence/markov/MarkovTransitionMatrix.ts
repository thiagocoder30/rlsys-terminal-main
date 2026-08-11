export class MarkovTransitionMatrix {
  private matrix: number[][];
  private rowSums: number[];

  constructor() {
    this.matrix = Array.from({ length: 37 }, () => Array(37).fill(0));
    this.rowSums = Array(37).fill(0);
  }

  public registerTransition(from: number, to: number): void {
    if (this.isValidState(from) && this.isValidState(to)) {
      this.matrix[from][to]++;
      this.rowSums[from]++;
    }
  }

  public getProbability(from: number, to: number): number {
    if (!this.isValidState(from) || !this.isValidState(to)) {
      return 0;
    }
    const totalTransitions = this.rowSums[from];
    if (totalTransitions === 0) {
      return 0;
    }
    return this.matrix[from][to] / totalTransitions;
  }

  public buildFromSequence(sequence: number[]): void {
    // Reset matrix
    this.matrix = Array.from({ length: 37 }, () => Array(37).fill(0));
    this.rowSums = Array(37).fill(0);

    const validSequence = sequence.filter(state => this.isValidState(state));

    if (validSequence.length < 2) {
      throw new Error("INSUFFICIENT_DATA: Sequence must contain at least 2 valid states to build transitions.");
    }

    for (let i = 0; i < validSequence.length - 1; i++) {
      this.registerTransition(validSequence[i], validSequence[i + 1]);
    }
  }

  public getMostProbableNextStates(from: number, limit: number = 5): Array<{ state: number, probability: number }> {
    if (!this.isValidState(from) || this.rowSums[from] === 0) {
      return [];
    }

    const probabilities = this.matrix[from].map((count, to) => ({
      state: to,
      probability: count / this.rowSums[from]
    }));

    return probabilities
      .filter(p => p.probability > 0)
      .sort((a, b) => b.probability - a.probability)
      .slice(0, limit);
  }

  private isValidState(state: number): boolean {
    return Number.isInteger(state) && state >= 0 && state <= 36;
  }
}
