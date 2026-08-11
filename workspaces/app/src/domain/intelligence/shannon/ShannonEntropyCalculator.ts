export class ShannonEntropyCalculator {
  private readonly MAX_STATES = 37;

  public calculateEntropy(sequence: number[]): number {
    const probabilities = this.calculateProbabilities(sequence);
    if (probabilities.length === 0) return 0;
    
    let entropy = 0;
    for (const p of probabilities) {
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }
    
    if (Number.isNaN(entropy) || !Number.isFinite(entropy)) {
      return 0;
    }
    
    return entropy;
  }

  public calculateMaxEntropy(): number {
    return Math.log2(this.MAX_STATES);
  }

  public calculateNormalizedEntropy(sequence: number[]): number {
    const entropy = this.calculateEntropy(sequence);
    const max = this.calculateMaxEntropy();
    if (max <= 0) return 0;
    
    const normalized = entropy / max;
    if (Number.isNaN(normalized) || !Number.isFinite(normalized)) {
      return 0;
    }
    return normalized;
  }

  public calculateFrequencies(sequence: number[]): Map<number, number> {
    const frequencies = new Map<number, number>();
    const validSequence = this.filterValid(sequence);
    
    for (const num of validSequence) {
      frequencies.set(num, (frequencies.get(num) || 0) + 1);
    }
    
    return frequencies;
  }

  public calculateProbabilities(sequence: number[]): number[] {
    const frequencies = this.calculateFrequencies(sequence);
    const validSequence = this.filterValid(sequence);
    const total = validSequence.length;
    
    if (total === 0) return [];

    const probabilities: number[] = [];
    for (const count of frequencies.values()) {
      probabilities.push(count / total);
    }
    return probabilities;
  }

  public calculateStateOccupationPercentage(sequence: number[]): number {
    const frequencies = this.calculateFrequencies(sequence);
    return (frequencies.size / this.MAX_STATES) * 100;
  }

  public getObservedStates(sequence: number[]): number[] {
    return Array.from(this.calculateFrequencies(sequence).keys());
  }

  private filterValid(sequence: number[]): number[] {
    if (!Array.isArray(sequence)) return [];
    return sequence.filter(
      (n) => n != null && Number.isInteger(n) && n >= 0 && n < this.MAX_STATES
    );
  }
}
