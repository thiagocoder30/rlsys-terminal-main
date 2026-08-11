export class OperationalVixCalculator {
  public calculate(
    normalizedEntropy: number,
    entropyConfidence: number,
    markovProbabilities: number[],
    sampleSize: number
  ): { vixScore: number; marketRegime: 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME'; riskLevel: string } {
    
    // Base penalty for small sample size
    let stabilityPenalty = 0;
    if (sampleSize < 10) {
      stabilityPenalty = 20;
    } else if (sampleSize < 37) {
      stabilityPenalty = 20 * (1 - (sampleSize / 37));
    }

    // High entropy -> higher VIX
    const entropyContribution = normalizedEntropy * 50;

    // Markov dispersion
    // If maximum probability is low, it means states are dispersed -> high VIX
    let markovDispersion = 0;
    if (markovProbabilities.length > 0) {
      const maxProb = Math.max(...markovProbabilities);
      markovDispersion = (1 - maxProb) * 30;
    } else {
      markovDispersion = 30; // Max dispersion if no valid states
    }

    // Low confidence penalty
    const confidencePenalty = (1 - entropyConfidence) * 10;

    let rawScore = entropyContribution + markovDispersion + stabilityPenalty + confidencePenalty;
    
    // Normalize to 0-100
    let vixScore = Math.max(0, Math.min(100, rawScore));

    if (Number.isNaN(vixScore) || !Number.isFinite(vixScore)) {
      vixScore = 50; // Fallback for invalid states
    }

    const marketRegime = this.classifyRegime(vixScore);
    const riskLevel = this.classifyRiskLevel(marketRegime);

    return { vixScore, marketRegime, riskLevel };
  }

  private classifyRegime(vixScore: number): 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME' {
    if (vixScore < 30) return 'LOW';
    if (vixScore < 60) return 'NORMAL';
    if (vixScore < 85) return 'HIGH';
    return 'EXTREME';
  }

  private classifyRiskLevel(regime: 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME'): string {
    switch (regime) {
      case 'LOW': return 'LOW_RISK';
      case 'NORMAL': return 'MODERATE_RISK';
      case 'HIGH': return 'HIGH_RISK';
      case 'EXTREME': return 'CRITICAL_RISK';
      default: return 'UNKNOWN';
    }
  }
}
