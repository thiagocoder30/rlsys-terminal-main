export type StrategyCandidateStatus = 'ACTIVE' | 'WATCHLIST' | 'LOCKED' | 'REJECTED';
export type StrategyRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type StrategyRankingDecision = 'ELIGIBLE' | 'WATCH' | 'LOCKED';

export interface StrategyRankingCandidate {
  readonly strategyId: string;
  readonly label: string;
  readonly status: StrategyCandidateStatus;
  readonly sampleSize: number;
  readonly wins: number;
  readonly losses: number;
  readonly pushes: number;
  readonly signalConfidence: number;
  readonly expectedValue: number;
  readonly maxDrawdown: number;
  readonly volatility: number;
  readonly recencyWeight: number;
  readonly riskLevel: StrategyRiskLevel;
}

export interface StrategyRankingOptions {
  readonly minSampleSize: number;
  readonly minBayesianHitRate: number;
  readonly minCompositeScore: number;
  readonly maxDrawdown: number;
  readonly maxVolatility: number;
  readonly priorAlpha: number;
  readonly priorBeta: number;
}

export interface StrategyRankingItem {
  readonly rank: number;
  readonly strategyId: string;
  readonly label: string;
  readonly decision: StrategyRankingDecision;
  readonly compositeScore: number;
  readonly bayesianHitRate: number;
  readonly evidenceScore: number;
  readonly riskPenalty: number;
  readonly confidenceDecay: number;
  readonly reasons: readonly string[];
}

export interface StrategyRankingReport {
  readonly engineVersion: 'strategy-ranking-v1';
  readonly candidateCount: number;
  readonly eligibleCount: number;
  readonly topCandidate: StrategyRankingItem | null;
  readonly rankings: readonly StrategyRankingItem[];
}

const DEFAULT_OPTIONS: StrategyRankingOptions = {
  minSampleSize: 80,
  minBayesianHitRate: 0.52,
  minCompositeScore: 0.58,
  maxDrawdown: 0.35,
  maxVolatility: 0.42,
  priorAlpha: 2,
  priorBeta: 2
};

/**
 * Ranks strategy candidates by evidence adjusted for risk and recency.
 *
 * This domain service is deterministic and side-effect free. It uses a Bayesian
 * hit-rate estimate instead of raw win rate so small samples cannot dominate the
 * live decision layer. Complexity is O(n log n) because candidates are sorted;
 * memory is O(n), bounded by the number of strategies loaded by the caller.
 */
export class StrategyRankingEngine {
  private readonly options: StrategyRankingOptions;

  public constructor(options: Partial<StrategyRankingOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.validateOptions(this.options);
  }

  public rank(candidates: readonly StrategyRankingCandidate[]): StrategyRankingReport {
    if (!Array.isArray(candidates)) throw new Error('invalid_strategy_ranking_candidates');

    const items: StrategyRankingItem[] = [];
    for (const candidate of candidates) {
      this.validateCandidate(candidate);
      items.push(this.scoreCandidate(candidate));
    }

    items.sort((left, right) => {
      const byDecision = decisionWeight(right.decision) - decisionWeight(left.decision);
      if (byDecision !== 0) return byDecision;
      const byScore = right.compositeScore - left.compositeScore;
      if (byScore !== 0) return byScore;
      return left.strategyId.localeCompare(right.strategyId);
    });

    const rankings = items.map((item, index) => ({ ...item, rank: index + 1 }));
    const eligible = rankings.filter(item => item.decision === 'ELIGIBLE');

    return {
      engineVersion: 'strategy-ranking-v1',
      candidateCount: candidates.length,
      eligibleCount: eligible.length,
      topCandidate: eligible.length > 0 ? eligible[0] : null,
      rankings
    };
  }

  private scoreCandidate(candidate: StrategyRankingCandidate): StrategyRankingItem {
    const resolved = candidate.wins + candidate.losses + candidate.pushes;
    const effectiveSample = Math.max(candidate.sampleSize, resolved);
    const bayesianHitRate = round((candidate.wins + this.options.priorAlpha) / (candidate.wins + candidate.losses + this.options.priorAlpha + this.options.priorBeta));
    const sampleAdequacy = clamp(effectiveSample / this.options.minSampleSize);
    const evScore = clamp(0.5 + candidate.expectedValue * 5);
    const confidenceDecay = round(clamp(candidate.signalConfidence * candidate.recencyWeight));
    const evidenceScore = round(clamp(bayesianHitRate * 0.42 + evScore * 0.24 + confidenceDecay * 0.24 + sampleAdequacy * 0.1));
    const riskPenalty = round(clamp(candidate.maxDrawdown * 0.45 + candidate.volatility * 0.35 + riskLevelPenalty(candidate.riskLevel) * 0.2));
    const compositeScore = round(clamp(evidenceScore * 0.74 + (1 - riskPenalty) * 0.26));
    const reasons = this.reasons(candidate, effectiveSample, bayesianHitRate, compositeScore, riskPenalty, confidenceDecay);
    const decision = this.decision(candidate, effectiveSample, bayesianHitRate, compositeScore, riskPenalty);

    return {
      rank: 0,
      strategyId: candidate.strategyId,
      label: candidate.label,
      decision,
      compositeScore,
      bayesianHitRate,
      evidenceScore,
      riskPenalty,
      confidenceDecay,
      reasons
    };
  }

  private decision(
    candidate: StrategyRankingCandidate,
    effectiveSample: number,
    bayesianHitRate: number,
    compositeScore: number,
    riskPenalty: number
  ): StrategyRankingDecision {
    if (candidate.status === 'LOCKED' || candidate.status === 'REJECTED') return 'LOCKED';
    if (effectiveSample < this.options.minSampleSize) return 'WATCH';
    if (candidate.maxDrawdown > this.options.maxDrawdown || candidate.volatility > this.options.maxVolatility) return 'LOCKED';
    if (riskPenalty >= 0.62 || candidate.riskLevel === 'CRITICAL') return 'LOCKED';
    if (bayesianHitRate < this.options.minBayesianHitRate || compositeScore < this.options.minCompositeScore) return 'WATCH';
    return 'ELIGIBLE';
  }

  private reasons(
    candidate: StrategyRankingCandidate,
    effectiveSample: number,
    bayesianHitRate: number,
    compositeScore: number,
    riskPenalty: number,
    confidenceDecay: number
  ): readonly string[] {
    const reasons: string[] = [];
    if (effectiveSample < this.options.minSampleSize) reasons.push('Amostra abaixo do mínimo para ranking operacional.');
    if (bayesianHitRate < this.options.minBayesianHitRate) reasons.push('Hit rate bayesiano abaixo do limiar mínimo.');
    if (compositeScore < this.options.minCompositeScore) reasons.push('Score composto insuficiente após ajuste de risco.');
    if (candidate.maxDrawdown > this.options.maxDrawdown) reasons.push('Drawdown excede limite do ranking.');
    if (candidate.volatility > this.options.maxVolatility) reasons.push('Volatilidade excede limite do ranking.');
    if (confidenceDecay < 0.45) reasons.push('Confiança recente sofreu decaimento relevante.');
    if (candidate.status === 'LOCKED' || candidate.status === 'REJECTED') reasons.push('Estratégia bloqueada pelo status de origem.');
    if (riskPenalty >= 0.62 || candidate.riskLevel === 'CRITICAL') reasons.push('Penalidade de risco bloqueia candidatura.');
    if (reasons.length === 0) reasons.push('Estratégia elegível por evidência bayesiana, risco controlado e confiança recente.');
    return reasons;
  }

  private validateOptions(options: StrategyRankingOptions): void {
    if (!isPositive(options.minSampleSize)) throw new Error('invalid_strategy_ranking_min_sample_size');
    if (!isUnit(options.minBayesianHitRate)) throw new Error('invalid_strategy_ranking_min_bayesian_hit_rate');
    if (!isUnit(options.minCompositeScore)) throw new Error('invalid_strategy_ranking_min_composite_score');
    if (!isUnit(options.maxDrawdown)) throw new Error('invalid_strategy_ranking_max_drawdown');
    if (!isUnit(options.maxVolatility)) throw new Error('invalid_strategy_ranking_max_volatility');
    if (!isPositive(options.priorAlpha) || !isPositive(options.priorBeta)) throw new Error('invalid_strategy_ranking_prior');
  }

  private validateCandidate(candidate: StrategyRankingCandidate): void {
    if (!candidate.strategyId.trim()) throw new Error('invalid_strategy_candidate_id');
    if (!candidate.label.trim()) throw new Error('invalid_strategy_candidate_label');
    if (!isNonNegativeInteger(candidate.sampleSize)) throw new Error('invalid_strategy_candidate_sample_size');
    if (!isNonNegativeInteger(candidate.wins) || !isNonNegativeInteger(candidate.losses) || !isNonNegativeInteger(candidate.pushes)) {
      throw new Error('invalid_strategy_candidate_outcomes');
    }
    if (candidate.wins + candidate.losses + candidate.pushes > candidate.sampleSize) throw new Error('invalid_strategy_candidate_outcome_total');
    if (!isUnit(candidate.signalConfidence)) throw new Error('invalid_strategy_candidate_signal_confidence');
    if (!Number.isFinite(candidate.expectedValue)) throw new Error('invalid_strategy_candidate_expected_value');
    if (!isUnit(candidate.maxDrawdown)) throw new Error('invalid_strategy_candidate_max_drawdown');
    if (!isUnit(candidate.volatility)) throw new Error('invalid_strategy_candidate_volatility');
    if (!isUnit(candidate.recencyWeight)) throw new Error('invalid_strategy_candidate_recency_weight');
  }
}

function decisionWeight(decision: StrategyRankingDecision): number {
  if (decision === 'ELIGIBLE') return 3;
  if (decision === 'WATCH') return 2;
  return 1;
}

function riskLevelPenalty(level: StrategyRiskLevel): number {
  if (level === 'LOW') return 0.12;
  if (level === 'MEDIUM') return 0.34;
  if (level === 'HIGH') return 0.66;
  return 0.92;
}

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isUnit(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Number(value.toFixed(6));
}
