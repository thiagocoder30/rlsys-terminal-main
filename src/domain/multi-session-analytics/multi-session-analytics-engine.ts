export type MultiSessionAnalyticsStatus =
  | 'STABLE_PAPER_PROGRESS'
  | 'NEUTRAL_PAPER_PROGRESS'
  | 'DEGRADED_PAPER_PROGRESS'
  | 'BLOCKED_PAPER_PROGRESS';

export type MultiSessionAnalyticsTrend =
  | 'IMPROVING'
  | 'STABLE'
  | 'DEGRADING';

export type MultiSessionAnalyticsReason =
  | 'PAPER_ONLY_POLICY_LOCK'
  | 'LOW_SESSION_COUNT'
  | 'POSITIVE_MULTI_SESSION_CONSISTENCY'
  | 'NEUTRAL_MULTI_SESSION_CONSISTENCY'
  | 'NEGATIVE_MULTI_SESSION_CONSISTENCY'
  | 'EXCESSIVE_DRAWDOWN'
  | 'EXCESSIVE_OPERATOR_VIOLATIONS'
  | 'EXCESSIVE_CERTIFICATION_FAILURES'
  | 'LOW_AVERAGE_CONFIDENCE'
  | 'LOW_AVERAGE_CONSENSUS'
  | 'DEGRADING_TREND'
  | 'IMPROVING_TREND';

export interface MultiSessionAnalyticsSample {
  readonly sessionId: string;
  readonly startedAtEpochMs: number;
  readonly paperSignals: number;
  readonly favorableSignals: number;
  readonly blockedSignals: number;
  readonly wins: number;
  readonly losses: number;
  readonly neutralOutcomes: number;
  readonly averageConfidenceScore: number;
  readonly averageConsensusScore: number;
  readonly maxDrawdownUnits: number;
  readonly operatorViolationCount: number;
  readonly certificationFailureCount: number;
}

export interface MultiSessionAnalyticsPolicy {
  readonly minimumSessions: number;
  readonly minimumStableScore: number;
  readonly minimumNeutralScore: number;
  readonly minimumAverageConfidence: number;
  readonly minimumAverageConsensus: number;
  readonly maximumDrawdownUnits: number;
  readonly maximumOperatorViolations: number;
  readonly maximumCertificationFailures: number;
  readonly productionMoneyAllowed: boolean;
  readonly liveMoneyAuthorization: boolean;
}

export interface MultiSessionAnalyticsReport {
  readonly status: MultiSessionAnalyticsStatus;
  readonly trend: MultiSessionAnalyticsTrend;
  readonly analyticsScore: number;
  readonly sessionCount: number;
  readonly paperSignals: number;
  readonly winRate: number;
  readonly blockRate: number;
  readonly favorableRate: number;
  readonly averageConfidenceScore: number;
  readonly averageConsensusScore: number;
  readonly maxDrawdownUnits: number;
  readonly operatorViolationCount: number;
  readonly certificationFailureCount: number;
  readonly reasons: readonly MultiSessionAnalyticsReason[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly paperOnly: true;
}

export interface MultiSessionAnalyticsFailure {
  readonly code: 'INVALID_MULTI_SESSION_ANALYTICS_INPUT';
  readonly message: string;
}

export type MultiSessionAnalyticsResult =
  | {
      readonly ok: true;
      readonly value: MultiSessionAnalyticsReport;
    }
  | {
      readonly ok: false;
      readonly error: MultiSessionAnalyticsFailure;
    };

interface MultiSessionAccumulator {
  sessionCount: number;
  paperSignals: number;
  favorableSignals: number;
  blockedSignals: number;
  wins: number;
  losses: number;
  neutralOutcomes: number;
  confidenceScoreSum: number;
  consensusScoreSum: number;
  maxDrawdownUnits: number;
  operatorViolationCount: number;
  certificationFailureCount: number;
  firstSessionScore: number;
  lastSessionScore: number;
}

const DEFAULT_POLICY: MultiSessionAnalyticsPolicy = Object.freeze({
  minimumSessions: 3,
  minimumStableScore: 0.72,
  minimumNeutralScore: 0.48,
  minimumAverageConfidence: 0.55,
  minimumAverageConsensus: 0.55,
  maximumDrawdownUnits: 8,
  maximumOperatorViolations: 0,
  maximumCertificationFailures: 0,
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

const clamp01 = (value: number): number => {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
};

const safeRatio = (numerator: number, denominator: number): number => {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
};

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

export class MultiSessionAnalyticsEngine {
  private readonly policy: MultiSessionAnalyticsPolicy;

  public constructor(policy: MultiSessionAnalyticsPolicy = DEFAULT_POLICY) {
    this.policy = Object.freeze({
      minimumSessions: policy.minimumSessions,
      minimumStableScore: policy.minimumStableScore,
      minimumNeutralScore: policy.minimumNeutralScore,
      minimumAverageConfidence: policy.minimumAverageConfidence,
      minimumAverageConsensus: policy.minimumAverageConsensus,
      maximumDrawdownUnits: policy.maximumDrawdownUnits,
      maximumOperatorViolations: policy.maximumOperatorViolations,
      maximumCertificationFailures: policy.maximumCertificationFailures,
      productionMoneyAllowed: policy.productionMoneyAllowed,
      liveMoneyAuthorization: policy.liveMoneyAuthorization,
    });
  }

  /**
   * Evaluates PAPER results across sessions in O(n log n) due chronological sorting.
   * Runtime memory remains O(n) for sorted immutable copy and O(1) for aggregation.
   */
  public evaluate(
    samples: readonly MultiSessionAnalyticsSample[],
  ): MultiSessionAnalyticsResult {
    const validationFailure = this.validate(samples);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const orderedSamples = [...samples].sort(
      (left, right) => left.startedAtEpochMs - right.startedAtEpochMs,
    );

    const accumulator = this.aggregate(orderedSamples);
    const report = this.toReport(accumulator);

    return {
      ok: true,
      value: report,
    };
  }

  private aggregate(
    samples: readonly MultiSessionAnalyticsSample[],
  ): MultiSessionAccumulator {
    let sessionCount = 0;
    let paperSignals = 0;
    let favorableSignals = 0;
    let blockedSignals = 0;
    let wins = 0;
    let losses = 0;
    let neutralOutcomes = 0;
    let confidenceScoreSum = 0;
    let consensusScoreSum = 0;
    let maxDrawdownUnits = 0;
    let operatorViolationCount = 0;
    let certificationFailureCount = 0;
    let firstSessionScore = 0;
    let lastSessionScore = 0;

    for (const sample of samples) {
      const sessionScore = this.calculateSessionScore(sample);

      if (sessionCount === 0) {
        firstSessionScore = sessionScore;
      }

      lastSessionScore = sessionScore;
      sessionCount += 1;
      paperSignals += sample.paperSignals;
      favorableSignals += sample.favorableSignals;
      blockedSignals += sample.blockedSignals;
      wins += sample.wins;
      losses += sample.losses;
      neutralOutcomes += sample.neutralOutcomes;
      confidenceScoreSum += sample.averageConfidenceScore;
      consensusScoreSum += sample.averageConsensusScore;
      maxDrawdownUnits = Math.max(maxDrawdownUnits, sample.maxDrawdownUnits);
      operatorViolationCount += sample.operatorViolationCount;
      certificationFailureCount += sample.certificationFailureCount;
    }

    return {
      sessionCount,
      paperSignals,
      favorableSignals,
      blockedSignals,
      wins,
      losses,
      neutralOutcomes,
      confidenceScoreSum,
      consensusScoreSum,
      maxDrawdownUnits,
      operatorViolationCount,
      certificationFailureCount,
      firstSessionScore,
      lastSessionScore,
    };
  }

  private toReport(
    accumulator: MultiSessionAccumulator,
  ): MultiSessionAnalyticsReport {
    const decisiveOutcomes = accumulator.wins + accumulator.losses;
    const winRate = safeRatio(accumulator.wins, decisiveOutcomes);
    const blockRate = safeRatio(accumulator.blockedSignals, accumulator.paperSignals);
    const favorableRate = safeRatio(
      accumulator.favorableSignals,
      accumulator.paperSignals,
    );
    const averageConfidenceScore = safeRatio(
      accumulator.confidenceScoreSum,
      accumulator.sessionCount,
    );
    const averageConsensusScore = safeRatio(
      accumulator.consensusScoreSum,
      accumulator.sessionCount,
    );

    const drawdownPenalty =
      accumulator.maxDrawdownUnits > this.policy.maximumDrawdownUnits ? 0.25 : 0;
    const operatorPenalty =
      accumulator.operatorViolationCount > this.policy.maximumOperatorViolations
        ? 0.2
        : 0;
    const certificationPenalty =
      accumulator.certificationFailureCount >
      this.policy.maximumCertificationFailures
        ? 0.2
        : 0;

    const analyticsScore = round4(
      clamp01(
        winRate * 0.3 +
          favorableRate * 0.18 +
          (1 - blockRate) * 0.17 +
          averageConfidenceScore * 0.18 +
          averageConsensusScore * 0.17 -
          drawdownPenalty -
          operatorPenalty -
          certificationPenalty,
      ),
    );

    const trend = this.resolveTrend(
      accumulator.firstSessionScore,
      accumulator.lastSessionScore,
    );
    const status = this.resolveStatus(accumulator, analyticsScore, trend);
    const reasons = this.resolveReasons(
      accumulator,
      analyticsScore,
      trend,
      averageConfidenceScore,
      averageConsensusScore,
    );

    return Object.freeze({
      status,
      trend,
      analyticsScore,
      sessionCount: accumulator.sessionCount,
      paperSignals: accumulator.paperSignals,
      winRate,
      blockRate,
      favorableRate,
      averageConfidenceScore,
      averageConsensusScore,
      maxDrawdownUnits: accumulator.maxDrawdownUnits,
      operatorViolationCount: accumulator.operatorViolationCount,
      certificationFailureCount: accumulator.certificationFailureCount,
      reasons,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
      paperOnly: true,
    });
  }

  private calculateSessionScore(sample: MultiSessionAnalyticsSample): number {
    const decisiveOutcomes = sample.wins + sample.losses;
    const winRate = safeRatio(sample.wins, decisiveOutcomes);
    const blockHealth = 1 - safeRatio(sample.blockedSignals, sample.paperSignals);
    const favorableRate = safeRatio(sample.favorableSignals, sample.paperSignals);

    return clamp01(
      winRate * 0.35 +
        blockHealth * 0.2 +
        favorableRate * 0.15 +
        sample.averageConfidenceScore * 0.15 +
        sample.averageConsensusScore * 0.15,
    );
  }

  private resolveTrend(
    firstSessionScore: number,
    lastSessionScore: number,
  ): MultiSessionAnalyticsTrend {
    const delta = lastSessionScore - firstSessionScore;

    if (delta >= 0.08) {
      return 'IMPROVING';
    }

    if (delta <= -0.08) {
      return 'DEGRADING';
    }

    return 'STABLE';
  }

  private resolveStatus(
    accumulator: MultiSessionAccumulator,
    analyticsScore: number,
    trend: MultiSessionAnalyticsTrend,
  ): MultiSessionAnalyticsStatus {
    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      return 'BLOCKED_PAPER_PROGRESS';
    }

    if (accumulator.sessionCount < this.policy.minimumSessions) {
      return 'NEUTRAL_PAPER_PROGRESS';
    }

    if (accumulator.maxDrawdownUnits > this.policy.maximumDrawdownUnits) {
      return 'BLOCKED_PAPER_PROGRESS';
    }

    if (
      accumulator.operatorViolationCount > this.policy.maximumOperatorViolations
    ) {
      return 'BLOCKED_PAPER_PROGRESS';
    }

    if (
      accumulator.certificationFailureCount >
      this.policy.maximumCertificationFailures
    ) {
      return 'BLOCKED_PAPER_PROGRESS';
    }

    if (trend === 'DEGRADING' && analyticsScore < this.policy.minimumStableScore) {
      return 'DEGRADED_PAPER_PROGRESS';
    }

    if (analyticsScore >= this.policy.minimumStableScore) {
      return 'STABLE_PAPER_PROGRESS';
    }

    if (analyticsScore >= this.policy.minimumNeutralScore) {
      return 'NEUTRAL_PAPER_PROGRESS';
    }

    return 'DEGRADED_PAPER_PROGRESS';
  }

  private resolveReasons(
    accumulator: MultiSessionAccumulator,
    analyticsScore: number,
    trend: MultiSessionAnalyticsTrend,
    averageConfidenceScore: number,
    averageConsensusScore: number,
  ): readonly MultiSessionAnalyticsReason[] {
    const reasons: MultiSessionAnalyticsReason[] = ['PAPER_ONLY_POLICY_LOCK'];

    if (accumulator.sessionCount < this.policy.minimumSessions) {
      reasons.push('LOW_SESSION_COUNT');
    }

    if (accumulator.maxDrawdownUnits > this.policy.maximumDrawdownUnits) {
      reasons.push('EXCESSIVE_DRAWDOWN');
    }

    if (
      accumulator.operatorViolationCount > this.policy.maximumOperatorViolations
    ) {
      reasons.push('EXCESSIVE_OPERATOR_VIOLATIONS');
    }

    if (
      accumulator.certificationFailureCount >
      this.policy.maximumCertificationFailures
    ) {
      reasons.push('EXCESSIVE_CERTIFICATION_FAILURES');
    }

    if (averageConfidenceScore < this.policy.minimumAverageConfidence) {
      reasons.push('LOW_AVERAGE_CONFIDENCE');
    }

    if (averageConsensusScore < this.policy.minimumAverageConsensus) {
      reasons.push('LOW_AVERAGE_CONSENSUS');
    }

    if (trend === 'IMPROVING') {
      reasons.push('IMPROVING_TREND');
    }

    if (trend === 'DEGRADING') {
      reasons.push('DEGRADING_TREND');
    }

    if (analyticsScore >= this.policy.minimumStableScore) {
      reasons.push('POSITIVE_MULTI_SESSION_CONSISTENCY');
    } else if (analyticsScore >= this.policy.minimumNeutralScore) {
      reasons.push('NEUTRAL_MULTI_SESSION_CONSISTENCY');
    } else {
      reasons.push('NEGATIVE_MULTI_SESSION_CONSISTENCY');
    }

    return Object.freeze(reasons);
  }

  private validate(
    samples: readonly MultiSessionAnalyticsSample[],
  ): MultiSessionAnalyticsFailure | null {
    for (const sample of samples) {
      if (sample.sessionId.trim().length === 0) {
        return {
          code: 'INVALID_MULTI_SESSION_ANALYTICS_INPUT',
          message: 'sessionId must not be empty',
        };
      }

      if (!Number.isFinite(sample.startedAtEpochMs) || sample.startedAtEpochMs < 0) {
        return {
          code: 'INVALID_MULTI_SESSION_ANALYTICS_INPUT',
          message: 'startedAtEpochMs must be a valid non-negative timestamp',
        };
      }

      const counters = [
        sample.paperSignals,
        sample.favorableSignals,
        sample.blockedSignals,
        sample.wins,
        sample.losses,
        sample.neutralOutcomes,
        sample.maxDrawdownUnits,
        sample.operatorViolationCount,
        sample.certificationFailureCount,
      ];

      if (counters.some((value) => value < 0)) {
        return {
          code: 'INVALID_MULTI_SESSION_ANALYTICS_INPUT',
          message: 'numeric counters must not be negative',
        };
      }

      if (sample.favorableSignals + sample.blockedSignals > sample.paperSignals) {
        return {
          code: 'INVALID_MULTI_SESSION_ANALYTICS_INPUT',
          message:
            'favorableSignals plus blockedSignals must not exceed paperSignals',
        };
      }

      const normalizedScores = [
        sample.averageConfidenceScore,
        sample.averageConsensusScore,
      ];

      if (normalizedScores.some((value) => value < 0 || value > 1)) {
        return {
          code: 'INVALID_MULTI_SESSION_ANALYTICS_INPUT',
          message: 'normalized scores must be between 0 and 1',
        };
      }
    }

    return null;
  }
}
