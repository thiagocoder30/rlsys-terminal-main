export type AdaptiveConfidenceBand =
  | 'BLOCKED'
  | 'LOW'
  | 'MODERATE'
  | 'STRONG'
  | 'VERY_STRONG';

export interface StrategyPerformanceWindow {
  readonly hitRatePercent: number;
  readonly roiPercent: number;
  readonly sampleSize: number;
  readonly maxConsecutiveLosses?: number;
}

export interface AdaptiveStrategySignalInput {
  readonly strategyId: string;
  readonly baseConfidenceScore: number;
  readonly riskScore: number;
  readonly evidenceScore?: number;
  readonly blockers?: readonly string[];
  readonly warnings?: readonly string[];
  readonly reasons?: readonly string[];
  readonly allTime?: StrategyPerformanceWindow;
  readonly last30Days?: StrategyPerformanceWindow;
  readonly last7Days?: StrategyPerformanceWindow;
}

export interface AdaptiveConsensusConfidencePolicy {
  readonly minSampleSizeForPerformanceTrust: number;
  readonly minFinalConfidenceForPaper: number;
  readonly maxFinalRiskForPaper: number;
  readonly drawdownPenaltyThresholdPercent: number;
  readonly recentPerformanceWeight: number;
  readonly paperOnly: true;
  readonly liveMoneyAuthorized: false;
  readonly productionMoneyAllowed: false;
}

export interface AdaptiveStrategyConfidenceAssessment {
  readonly strategyId: string;
  readonly accepted: boolean;
  readonly baseConfidenceScore: number;
  readonly finalConfidenceScore: number;
  readonly finalRiskScore: number;
  readonly performanceScore: number;
  readonly recentMomentumScore: number;
  readonly decayPenaltyScore: number;
  readonly drawdownPenaltyScore: number;
  readonly sampleTrustScore: number;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly reasons: readonly string[];
}

export interface AdaptiveConsensusConfidenceResult {
  readonly strategyAssessments: readonly AdaptiveStrategyConfidenceAssessment[];
  readonly acceptedStrategyIds: readonly string[];
  readonly finalConfidenceScore: number;
  readonly finalRiskScore: number;
  readonly confidenceBand: AdaptiveConfidenceBand;
  readonly paperEligible: boolean;
  readonly paperOnly: true;
  readonly liveMoneyAuthorized: false;
  readonly productionMoneyAllowed: false;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly reasons: readonly string[];
  readonly hudSummary: string;
}

const DEFAULT_POLICY: AdaptiveConsensusConfidencePolicy = Object.freeze({
  minSampleSizeForPerformanceTrust: 20,
  minFinalConfidenceForPaper: 0.7,
  maxFinalRiskForPaper: 0.35,
  drawdownPenaltyThresholdPercent: 4,
  recentPerformanceWeight: 0.55,
  paperOnly: true,
  liveMoneyAuthorized: false,
  productionMoneyAllowed: false,
});

export class AdaptiveConsensusConfidenceEngine {
  public evaluate(
    strategies: readonly AdaptiveStrategySignalInput[],
    input: {
      readonly currentDrawdownPercent?: number;
      readonly consensusRiskScore?: number;
      readonly consensusScore?: number;
    } = {},
    policyInput: Partial<AdaptiveConsensusConfidencePolicy> = {},
  ): AdaptiveConsensusConfidenceResult {
    const policy = this.normalizePolicy(policyInput);
    const currentDrawdownPercent = Math.max(0, this.percent(input.currentDrawdownPercent ?? 0));
    const drawdownPenaltyScore = currentDrawdownPercent >= policy.drawdownPenaltyThresholdPercent
      ? this.score(Math.min(35, currentDrawdownPercent * 4))
      : 0;

    const assessments = Object.freeze(strategies.map((strategy) => this.assessStrategy(strategy, drawdownPenaltyScore, policy)));
    const accepted = assessments.filter((assessment) => assessment.accepted);
    const acceptedStrategyIds = Object.freeze(accepted.map((assessment) => assessment.strategyId));

    const finalConfidenceScore = this.ratioAverage(
      accepted.map((assessment) => assessment.finalConfidenceScore),
      0,
    );

    const strategyRiskAverage = this.ratioAverage(
      accepted.map((assessment) => assessment.finalRiskScore),
      1,
    );

    const consensusRiskScore = this.clampRatio(input.consensusRiskScore ?? strategyRiskAverage);
    const finalRiskScore = this.clampRatio((strategyRiskAverage * 0.65) + (consensusRiskScore * 0.35));

    const confidenceBand = this.band(finalConfidenceScore, finalRiskScore, accepted.length);
    const blockers = this.collectBlockers({
      strategies,
      acceptedCount: accepted.length,
      finalConfidenceScore,
      finalRiskScore,
      confidenceBand,
      policy,
    });

    const paperEligible = blockers.length === 0;

    const warnings = this.collectWarnings(assessments, drawdownPenaltyScore);
    const reasons = Object.freeze([
      `ADAPTIVE_ACCEPTED:${accepted.length}`,
      `ADAPTIVE_CONFIDENCE:${finalConfidenceScore}`,
      `ADAPTIVE_RISK:${finalRiskScore}`,
      `ADAPTIVE_BAND:${confidenceBand}`,
      `ADAPTIVE_DRAWDOWN_PENALTY:${drawdownPenaltyScore}`,
    ]);

    return Object.freeze({
      strategyAssessments: assessments,
      acceptedStrategyIds,
      finalConfidenceScore,
      finalRiskScore,
      confidenceBand,
      paperEligible,
      paperOnly: true,
      liveMoneyAuthorized: false,
      productionMoneyAllowed: false,
      operatorDecisionRequired: true,
      supervisedRecommendationOnly: true,
      blockers: Object.freeze(blockers),
      warnings,
      reasons,
      hudSummary: this.hudSummary({
        finalConfidenceScore,
        finalRiskScore,
        confidenceBand,
        acceptedCount: accepted.length,
        paperEligible,
      }),
    });
  }

  private assessStrategy(
    strategy: AdaptiveStrategySignalInput,
    globalDrawdownPenaltyScore: number,
    policy: AdaptiveConsensusConfidencePolicy,
  ): AdaptiveStrategyConfidenceAssessment {
    const blockers = [...(strategy.blockers ?? [])];
    const warnings = [...(strategy.warnings ?? [])];
    const reasons = [...(strategy.reasons ?? [])];

    const baseConfidenceScore = this.clampRatio(strategy.baseConfidenceScore);
    const baseRiskScore = this.clampRatio(strategy.riskScore);
    const evidenceScore = this.score(
      typeof strategy.evidenceScore === 'number'
        ? strategy.evidenceScore
        : baseConfidenceScore * 100,
    );

    const sampleTrustScore = this.sampleTrust(strategy, policy);
    const performanceScore = this.performanceScore(strategy, sampleTrustScore, policy);
    const recentMomentumScore = this.recentMomentumScore(strategy);
    const decayPenaltyScore = this.decayPenalty(strategy);
    const drawdownPenaltyScore = globalDrawdownPenaltyScore;

    const rawConfidence =
      (baseConfidenceScore * 0.36) +
      ((evidenceScore / 100) * 0.22) +
      ((performanceScore / 100) * 0.22) +
      ((recentMomentumScore / 100) * 0.12) +
      ((sampleTrustScore / 100) * 0.08) -
      ((decayPenaltyScore / 100) * 0.10) -
      ((drawdownPenaltyScore / 100) * 0.08);

    const finalConfidenceScore = this.clampRatio(rawConfidence);

    const riskPenalty =
      (baseRiskScore * 0.55) +
      ((decayPenaltyScore / 100) * 0.18) +
      ((drawdownPenaltyScore / 100) * 0.17) +
      (((100 - performanceScore) / 100) * 0.10);

    const finalRiskScore = this.clampRatio(riskPenalty);

    if (sampleTrustScore < 35) {
      warnings.push('ADAPTIVE_SAMPLE_LOW_TRUST');
    }

    if (decayPenaltyScore > 0) {
      warnings.push('ADAPTIVE_RECENT_DECAY_ACTIVE');
    }

    if (drawdownPenaltyScore > 0) {
      warnings.push('ADAPTIVE_DRAWDOWN_PENALTY_ACTIVE');
    }

    if (baseConfidenceScore <= 0) {
      blockers.push('ADAPTIVE_BASE_CONFIDENCE_INVALID');
    }

    if (finalConfidenceScore < 0.5) {
      blockers.push('ADAPTIVE_STRATEGY_CONFIDENCE_TOO_LOW');
    }

    if (finalRiskScore > 0.7) {
      blockers.push('ADAPTIVE_STRATEGY_RISK_TOO_HIGH');
    }

    reasons.push(`ADAPTIVE_STRATEGY_PERFORMANCE:${performanceScore}`);
    reasons.push(`ADAPTIVE_STRATEGY_MOMENTUM:${recentMomentumScore}`);
    reasons.push(`ADAPTIVE_STRATEGY_DECAY:${decayPenaltyScore}`);
    reasons.push(`ADAPTIVE_STRATEGY_SAMPLE_TRUST:${sampleTrustScore}`);

    return Object.freeze({
      strategyId: strategy.strategyId,
      accepted: blockers.length === 0,
      baseConfidenceScore,
      finalConfidenceScore,
      finalRiskScore,
      performanceScore,
      recentMomentumScore,
      decayPenaltyScore,
      drawdownPenaltyScore,
      sampleTrustScore,
      blockers: Object.freeze(blockers),
      warnings: Object.freeze(warnings),
      reasons: Object.freeze(reasons),
    });
  }

  private sampleTrust(
    strategy: AdaptiveStrategySignalInput,
    policy: AdaptiveConsensusConfidencePolicy,
  ): number {
    const sampleSize =
      (strategy.allTime?.sampleSize ?? 0) +
      (strategy.last30Days?.sampleSize ?? 0) +
      (strategy.last7Days?.sampleSize ?? 0);

    return this.score(Math.min(100, (sampleSize / Math.max(1, policy.minSampleSizeForPerformanceTrust * 2)) * 100));
  }

  private performanceScore(
    strategy: AdaptiveStrategySignalInput,
    sampleTrustScore: number,
    policy: AdaptiveConsensusConfidencePolicy,
  ): number {
    const allTime = this.windowScore(strategy.allTime);
    const last30 = this.windowScore(strategy.last30Days);
    const last7 = this.windowScore(strategy.last7Days);

    const recentWeight = this.clampRatio(policy.recentPerformanceWeight);
    const longWeight = 1 - recentWeight;

    const blended =
      (last7 * recentWeight * 0.6) +
      (last30 * recentWeight * 0.4) +
      (allTime * longWeight);

    const neutralized = sampleTrustScore < 35
      ? (blended * 0.4) + 30
      : blended;

    return this.score(neutralized);
  }

  private recentMomentumScore(strategy: AdaptiveStrategySignalInput): number {
    const last7 = this.windowScore(strategy.last7Days);
    const last30 = this.windowScore(strategy.last30Days);
    const allTime = this.windowScore(strategy.allTime);

    return this.score((last7 * 0.5) + (last30 * 0.3) + (allTime * 0.2));
  }

  private decayPenalty(strategy: AdaptiveStrategySignalInput): number {
    const allTimeHit = strategy.allTime?.hitRatePercent ?? 50;
    const last7Hit = strategy.last7Days?.hitRatePercent ?? allTimeHit;
    const maxConsecutiveLosses = Math.max(
      strategy.allTime?.maxConsecutiveLosses ?? 0,
      strategy.last30Days?.maxConsecutiveLosses ?? 0,
      strategy.last7Days?.maxConsecutiveLosses ?? 0,
    );

    const hitRateDecay = Math.max(0, allTimeHit - last7Hit);
    const lossStreakPenalty = Math.max(0, maxConsecutiveLosses - 2) * 7;

    return this.score(Math.min(45, hitRateDecay + lossStreakPenalty));
  }

  private windowScore(window: StrategyPerformanceWindow | undefined): number {
    if (!window || window.sampleSize <= 0) {
      return 50;
    }

    const hitRateComponent = this.score(window.hitRatePercent);
    const roiComponent = this.score(50 + Math.max(-30, Math.min(30, window.roiPercent)));
    const sampleComponent = this.score(Math.min(100, window.sampleSize * 5));

    return this.score((hitRateComponent * 0.55) + (roiComponent * 0.30) + (sampleComponent * 0.15));
  }

  private collectBlockers(input: {
    readonly strategies: readonly AdaptiveStrategySignalInput[];
    readonly acceptedCount: number;
    readonly finalConfidenceScore: number;
    readonly finalRiskScore: number;
    readonly confidenceBand: AdaptiveConfidenceBand;
    readonly policy: AdaptiveConsensusConfidencePolicy;
  }): string[] {
    const blockers: string[] = [];

    if (input.strategies.length === 0) {
      blockers.push('ADAPTIVE_NO_STRATEGIES');
    }

    if (input.acceptedCount < 2) {
      blockers.push('ADAPTIVE_REQUIRES_AT_LEAST_TWO_ACCEPTED_STRATEGIES');
    }

    if (input.finalConfidenceScore < input.policy.minFinalConfidenceForPaper) {
      blockers.push('ADAPTIVE_FINAL_CONFIDENCE_BELOW_PAPER_THRESHOLD');
    }

    if (input.finalRiskScore > input.policy.maxFinalRiskForPaper) {
      blockers.push('ADAPTIVE_FINAL_RISK_ABOVE_PAPER_THRESHOLD');
    }

    if (input.confidenceBand === 'BLOCKED' || input.confidenceBand === 'LOW') {
      blockers.push('ADAPTIVE_CONFIDENCE_BAND_NOT_ELIGIBLE');
    }

    return blockers;
  }

  private collectWarnings(
    assessments: readonly AdaptiveStrategyConfidenceAssessment[],
    drawdownPenaltyScore: number,
  ): readonly string[] {
    const warnings = new Set<string>();

    for (const assessment of assessments) {
      for (const warning of assessment.warnings) {
        warnings.add(`${assessment.strategyId}:${warning}`);
      }
    }

    if (drawdownPenaltyScore > 0) {
      warnings.add('ADAPTIVE_GLOBAL_DRAWDOWN_PROTECTION_ACTIVE');
    }

    return Object.freeze([...warnings]);
  }

  private band(
    confidence: number,
    risk: number,
    acceptedCount: number,
  ): AdaptiveConfidenceBand {
    if (acceptedCount === 0 || confidence <= 0 || risk >= 0.75) {
      return 'BLOCKED';
    }

    if (confidence >= 0.85 && risk <= 0.25 && acceptedCount >= 2) {
      return 'VERY_STRONG';
    }

    if (confidence >= 0.75 && risk <= 0.35 && acceptedCount >= 2) {
      return 'STRONG';
    }

    if (confidence >= 0.62 && risk <= 0.5) {
      return 'MODERATE';
    }

    return 'LOW';
  }

  private hudSummary(input: {
    readonly finalConfidenceScore: number;
    readonly finalRiskScore: number;
    readonly confidenceBand: AdaptiveConfidenceBand;
    readonly acceptedCount: number;
    readonly paperEligible: boolean;
  }): string {
    return [
      `adaptiveConfidence=${input.finalConfidenceScore}`,
      `adaptiveRisk=${input.finalRiskScore}`,
      `band=${input.confidenceBand}`,
      `accepted=${input.acceptedCount}`,
      `paperEligible=${input.paperEligible}`,
      'paperOnly=true',
      'liveMoneyAuthorized=false',
    ].join(' | ');
  }

  private ratioAverage(values: readonly number[], fallback: number): number {
    if (values.length === 0) {
      return fallback;
    }

    return this.clampRatio(values.reduce((sum, value) => sum + this.clampRatio(value), 0) / values.length);
  }

  private normalizePolicy(policy: Partial<AdaptiveConsensusConfidencePolicy>): AdaptiveConsensusConfidencePolicy {
    return Object.freeze({
      minSampleSizeForPerformanceTrust: this.positiveIntegerOrDefault(
        policy.minSampleSizeForPerformanceTrust,
        DEFAULT_POLICY.minSampleSizeForPerformanceTrust,
      ),
      minFinalConfidenceForPaper: this.clampRatio(
        typeof policy.minFinalConfidenceForPaper === 'number'
          ? policy.minFinalConfidenceForPaper
          : DEFAULT_POLICY.minFinalConfidenceForPaper,
      ),
      maxFinalRiskForPaper: this.clampRatio(
        typeof policy.maxFinalRiskForPaper === 'number'
          ? policy.maxFinalRiskForPaper
          : DEFAULT_POLICY.maxFinalRiskForPaper,
      ),
      drawdownPenaltyThresholdPercent: this.positiveNumberOrDefault(
        policy.drawdownPenaltyThresholdPercent,
        DEFAULT_POLICY.drawdownPenaltyThresholdPercent,
      ),
      recentPerformanceWeight: this.clampRatio(
        typeof policy.recentPerformanceWeight === 'number'
          ? policy.recentPerformanceWeight
          : DEFAULT_POLICY.recentPerformanceWeight,
      ),
      paperOnly: true,
      liveMoneyAuthorized: false,
      productionMoneyAllowed: false,
    });
  }

  private positiveIntegerOrDefault(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
  }

  private positiveNumberOrDefault(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private score(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private percent(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(value * 100) / 100;
  }

  private clampRatio(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
  }
}
