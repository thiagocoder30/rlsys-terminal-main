export class ZScoreCalculator {
  // Theoretical expected values for European Roulette (0-36)
  public readonly THEORETICAL_MEAN = 18;
  public readonly THEORETICAL_VARIANCE = 114;
  public readonly THEORETICAL_STD_DEV = Math.sqrt(this.THEORETICAL_VARIANCE);

  public calculate(sequence: number[]): { mean: number; variance: number; standardDeviation: number; zScore: number } {
    const validSequence = this.filterValid(sequence);
    const n = validSequence.length;

    if (n === 0) {
      throw new Error('INSUFFICIENT_DATA: Sequence is empty.');
    }

    if (n === 1) {
      // With only 1 element, sample variance is undefined (or 0), we can't reliably compute sample stats for Z-Score.
      // But we can compute zScore against theoretical. 
      // Let's compute sample mean and use 0 for variance and std dev.
      const val = validSequence[0];
      const zScore = (val - this.THEORETICAL_MEAN) / this.THEORETICAL_STD_DEV;
      return { mean: val, variance: 0, standardDeviation: 0, zScore: this.normalizeValue(zScore) };
    }

    // Sample Mean
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += validSequence[i];
    }
    const mean = sum / n;

    // Sample Variance (Bessel's correction for unbiased sample variance: n - 1)
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      sumSq += Math.pow(validSequence[i] - mean, 2);
    }
    const variance = sumSq / (n - 1);
    
    // Sample Standard Deviation
    const standardDeviation = Math.sqrt(variance);

    // Z-Score: measures how many standard deviations the sample mean is from the expected theoretical mean.
    // Z = (Sample Mean - Theoretical Mean) / (Theoretical Std Dev / sqrt(N))
    const standardError = this.THEORETICAL_STD_DEV / Math.sqrt(n);
    let zScore = 0;
    
    if (standardError > 0) {
       zScore = (mean - this.THEORETICAL_MEAN) / standardError;
    }

    return {
      mean: this.normalizeValue(mean),
      variance: this.normalizeValue(variance),
      standardDeviation: this.normalizeValue(standardDeviation),
      zScore: this.normalizeValue(zScore)
    };
  }

  private filterValid(sequence: number[]): number[] {
    if (!Array.isArray(sequence)) return [];
    return sequence.filter(
      (n) => n != null && Number.isInteger(n) && n >= 0 && n <= 36
    );
  }

  private normalizeValue(val: number): number {
    if (Number.isNaN(val) || !Number.isFinite(val)) {
      return 0;
    }
    return val;
  }
}
