export type PatternDiscoveryStatus =
  | 'PATTERN_SUPPORTS_PAPER'
  | 'PATTERN_NEUTRAL'
  | 'PATTERN_DEGRADED'
  | 'PATTERN_BLOCKED';

export type PatternDiscoveryTrend =
  | 'IMPROVING'
  | 'STABLE'
  | 'DEGRADING'
  | 'UNKNOWN';

export type PatternDiscoveryReason =
  | 'PAPER_ONLY_POLICY_LOCK'
  | 'NO_PATTERNS'
  | 'LOW_SAMPLE_SIZE'
  | 'RECURRING_PATTERN'
  | 'SUPPORTIVE_PATTERN'
  | 'NEUTRAL_PATTERN'
  | 'DEGRADED_PATTERN'
  | 'BLOCKED_PATTERN'
  | 'EXCESSIVE_BLOCK_RATE'
  | 'EXCESSIVE_RISK'
  | 'WEAK_OPERATOR_CONTEXT'
  | 'POLICY_LOCK_ACTIVE';

export interface PatternDiscoverySample {
  readonly sampleId: string;
  readonly patternKey: string;
  readonly strategyId: string;
  readonly tableId: string;
  readonly occurredAtEpochMs: number;
  readonly memoryScore: number;
  readonly similarityScore: number;
  readonly correlationScore: number;
  readonly outcomeScore: number;
  readonly riskScore: number;
  readonly operatorScore: number;
  readonly blocked: boolean;
}

export interface PatternDiscoveryPolicy {
  readonly minimumSamples: number;
  readonly minimumSupportScore: number;
  readonly minimumNeutralScore: number;
  readonly maximumBlockRate: number;
  readonly maximumAverageRiskScore: number;
  readonly minimumAverageOperatorScore: number;
  readonly productionMoneyAllowed: boolean;
  readonly liveMoneyAuthorization: boolean;
}

export interface InstitutionalPatternReport {
  readonly patternKey: string;
  readonly strategyId: string;
  readonly tableId: string;
  readonly status: PatternDiscoveryStatus;
  readonly trend: PatternDiscoveryTrend;
  readonly patternScore: number;
  readonly sampleCount: number;
  readonly blockRate: number;
  readonly averageMemoryScore: number;
  readonly averageSimilarityScore: number;
  readonly averageCorrelationScore: number;
  readonly averageOutcomeScore: number;
  readonly averageRiskScore: number;
  readonly averageOperatorScore: number;
  readonly reasons: readonly PatternDiscoveryReason[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly paperOnly: true;
}

export interface PatternDiscoveryReport {
  readonly status: PatternDiscoveryStatus;
  readonly totalSamples: number;
  readonly totalPatterns: number;
  readonly patterns: readonly InstitutionalPatternReport[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly paperOnly: true;
}

export interface PatternDiscoveryFailure {
  readonly code: 'INVALID_PATTERN_DISCOVERY_INPUT';
  readonly message: string;
}

export type PatternDiscoveryResult =
  | {
      readonly ok: true;
      readonly value: PatternDiscoveryReport;
    }
  | {
      readonly ok: false;
      readonly error: PatternDiscoveryFailure;
    };

interface PatternAccumulator {
  patternKey: string;
  strategyId: string;
  tableId: string;
  sampleCount: number;
  blockedCount: number;
  memoryScoreSum: number;
  similarityScoreSum: number;
  correlationScoreSum: number;
  outcomeScoreSum: number;
  riskScoreSum: number;
  operatorScoreSum: number;
  firstScore: number;
  lastScore: number;
  firstEpochMs: number;
  lastEpochMs: number;
}

const DEFAULT_POLICY: PatternDiscoveryPolicy = Object.freeze({
  minimumSamples: 3,
  minimumSupportScore: 0.72,
  minimumNeutralScore: 0.48,
  maximumBlockRate: 0.35,
  maximumAverageRiskScore: 0.58,
  minimumAverageOperatorScore: 0.58,
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

const clamp01 = (value: number): number => {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const safeRatio = (numerator: number, denominator: number): number => {
  if (denominator <= 0) return 0;
  return numerator / denominator;
};

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

export class InstitutionalPatternDiscoveryEngine {
  private readonly policy: PatternDiscoveryPolicy;

  public constructor(policy: PatternDiscoveryPolicy = DEFAULT_POLICY) {
    this.policy = Object.freeze({
      minimumSamples: policy.minimumSamples,
      minimumSupportScore: policy.minimumSupportScore,
      minimumNeutralScore: policy.minimumNeutralScore,
      maximumBlockRate: policy.maximumBlockRate,
      maximumAverageRiskScore: policy.maximumAverageRiskScore,
      minimumAverageOperatorScore: policy.minimumAverageOperatorScore,
      productionMoneyAllowed: policy.productionMoneyAllowed,
      liveMoneyAuthorization: policy.liveMoneyAuthorization,
    });
  }

  /**
   * Discovers recurring institutional PAPER patterns.
   * Complexity: O(n + k log k), where n is sample count and k is pattern count.
   * Memory: O(k). The engine is pure, deterministic and PAPER-only.
   */
  public discover(
    samples: readonly PatternDiscoverySample[],
  ): PatternDiscoveryResult {
    const validationFailure = this.validate(samples);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const accumulators = this.aggregate(samples);
    const patterns: InstitutionalPatternReport[] = [];

    for (const accumulator of accumulators.values()) {
      patterns.push(this.toPatternReport(accumulator));
    }

    patterns.sort((left, right) => {
      const scoreDelta = right.patternScore - left.patternScore;

      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return left.patternKey.localeCompare(right.patternKey);
    });

    return {
      ok: true,
      value: Object.freeze({
        status: this.resolveGlobalStatus(patterns),
        totalSamples: samples.length,
        totalPatterns: patterns.length,
        patterns: Object.freeze(patterns),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        paperOnly: true,
      }),
    };
  }

  private aggregate(
    samples: readonly PatternDiscoverySample[],
  ): Map<string, PatternAccumulator> {
    const accumulators = new Map<string, PatternAccumulator>();

    for (const sample of samples) {
      const sampleScore = this.calculateSampleScore(sample);
      const current = accumulators.get(sample.patternKey);

      if (current === undefined) {
        accumulators.set(sample.patternKey, {
          patternKey: sample.patternKey,
          strategyId: sample.strategyId,
          tableId: sample.tableId,
          sampleCount: 1,
          blockedCount: sample.blocked ? 1 : 0,
          memoryScoreSum: sample.memoryScore,
          similarityScoreSum: sample.similarityScore,
          correlationScoreSum: sample.correlationScore,
          outcomeScoreSum: sample.outcomeScore,
          riskScoreSum: sample.riskScore,
          operatorScoreSum: sample.operatorScore,
          firstScore: sampleScore,
          lastScore: sampleScore,
          firstEpochMs: sample.occurredAtEpochMs,
          lastEpochMs: sample.occurredAtEpochMs,
        });
      } else {
        current.sampleCount += 1;
        current.blockedCount += sample.blocked ? 1 : 0;
        current.memoryScoreSum += sample.memoryScore;
        current.similarityScoreSum += sample.similarityScore;
        current.correlationScoreSum += sample.correlationScore;
        current.outcomeScoreSum += sample.outcomeScore;
        current.riskScoreSum += sample.riskScore;
        current.operatorScoreSum += sample.operatorScore;

        if (sample.occurredAtEpochMs < current.firstEpochMs) {
          current.firstEpochMs = sample.occurredAtEpochMs;
          current.firstScore = sampleScore;
        }

        if (sample.occurredAtEpochMs >= current.lastEpochMs) {
          current.lastEpochMs = sample.occurredAtEpochMs;
          current.lastScore = sampleScore;
        }
      }
    }

    return accumulators;
  }

  private toPatternReport(
    accumulator: PatternAccumulator,
  ): InstitutionalPatternReport {
    const blockRate = safeRatio(accumulator.blockedCount, accumulator.sampleCount);
    const averageMemoryScore = safeRatio(
      accumulator.memoryScoreSum,
      accumulator.sampleCount,
    );
    const averageSimilarityScore = safeRatio(
      accumulator.similarityScoreSum,
      accumulator.sampleCount,
    );
    const averageCorrelationScore = safeRatio(
      accumulator.correlationScoreSum,
      accumulator.sampleCount,
    );
    const averageOutcomeScore = safeRatio(
      accumulator.outcomeScoreSum,
      accumulator.sampleCount,
    );
    const averageRiskScore = safeRatio(
      accumulator.riskScoreSum,
      accumulator.sampleCount,
    );
    const averageOperatorScore = safeRatio(
      accumulator.operatorScoreSum,
      accumulator.sampleCount,
    );

    const blockPenalty = blockRate * 0.2;
    const riskPenalty =
      averageRiskScore > this.policy.maximumAverageRiskScore ? 0.2 : 0;
    const operatorPenalty =
      averageOperatorScore < this.policy.minimumAverageOperatorScore ? 0.2 : 0;

    const patternScore = round4(
      clamp01(
        averageMemoryScore * 0.18 +
          averageSimilarityScore * 0.18 +
          averageCorrelationScore * 0.2 +
          averageOutcomeScore * 0.22 +
          (1 - averageRiskScore) * 0.12 +
          averageOperatorScore * 0.1 -
          blockPenalty -
          riskPenalty -
          operatorPenalty,
      ),
    );

    const trend = this.resolveTrend(accumulator.firstScore, accumulator.lastScore);
    const status = this.resolveStatus(
      accumulator.sampleCount,
      blockRate,
      averageRiskScore,
      averageOperatorScore,
      patternScore,
      trend,
    );
    const reasons = this.resolveReasons(
      accumulator.sampleCount,
      blockRate,
      averageRiskScore,
      averageOperatorScore,
      patternScore,
      status,
    );

    return Object.freeze({
      patternKey: accumulator.patternKey,
      strategyId: accumulator.strategyId,
      tableId: accumulator.tableId,
      status,
      trend,
      patternScore,
      sampleCount: accumulator.sampleCount,
      blockRate,
      averageMemoryScore,
      averageSimilarityScore,
      averageCorrelationScore,
      averageOutcomeScore,
      averageRiskScore,
      averageOperatorScore,
      reasons: Object.freeze(reasons),
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
      paperOnly: true,
    });
  }

  private calculateSampleScore(sample: PatternDiscoverySample): number {
    return clamp01(
      sample.memoryScore * 0.2 +
        sample.similarityScore * 0.2 +
        sample.correlationScore * 0.22 +
        sample.outcomeScore * 0.22 +
        (1 - sample.riskScore) * 0.08 +
        sample.operatorScore * 0.08 -
        (sample.blocked ? 0.25 : 0),
    );
  }

  private resolveTrend(
    firstScore: number,
    lastScore: number,
  ): PatternDiscoveryTrend {
    const delta = lastScore - firstScore;

    if (delta >= 0.08) {
      return 'IMPROVING';
    }

    if (delta <= -0.08) {
      return 'DEGRADING';
    }

    return 'STABLE';
  }

  private resolveStatus(
    sampleCount: number,
    blockRate: number,
    averageRiskScore: number,
    averageOperatorScore: number,
    patternScore: number,
    trend: PatternDiscoveryTrend,
  ): PatternDiscoveryStatus {
    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      return 'PATTERN_BLOCKED';
    }

    if (sampleCount < this.policy.minimumSamples) {
      return 'PATTERN_NEUTRAL';
    }

    if (blockRate > this.policy.maximumBlockRate) {
      return 'PATTERN_BLOCKED';
    }

    if (averageRiskScore > this.policy.maximumAverageRiskScore) {
      return 'PATTERN_BLOCKED';
    }

    if (averageOperatorScore < this.policy.minimumAverageOperatorScore) {
      return 'PATTERN_BLOCKED';
    }

    if (trend === 'DEGRADING' && patternScore < this.policy.minimumSupportScore) {
      return 'PATTERN_DEGRADED';
    }

    if (patternScore >= this.policy.minimumSupportScore) {
      return 'PATTERN_SUPPORTS_PAPER';
    }

    if (patternScore >= this.policy.minimumNeutralScore) {
      return 'PATTERN_NEUTRAL';
    }

    return 'PATTERN_DEGRADED';
  }

  private resolveGlobalStatus(
    patterns: readonly InstitutionalPatternReport[],
  ): PatternDiscoveryStatus {
    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      return 'PATTERN_BLOCKED';
    }

    if (patterns.length === 0) {
      return 'PATTERN_NEUTRAL';
    }

    if (patterns.some((pattern) => pattern.status === 'PATTERN_BLOCKED')) {
      return 'PATTERN_BLOCKED';
    }

    if (
      patterns.some((pattern) => pattern.status === 'PATTERN_SUPPORTS_PAPER')
    ) {
      return 'PATTERN_SUPPORTS_PAPER';
    }

    if (patterns.some((pattern) => pattern.status === 'PATTERN_DEGRADED')) {
      return 'PATTERN_DEGRADED';
    }

    return 'PATTERN_NEUTRAL';
  }

  private resolveReasons(
    sampleCount: number,
    blockRate: number,
    averageRiskScore: number,
    averageOperatorScore: number,
    patternScore: number,
    status: PatternDiscoveryStatus,
  ): readonly PatternDiscoveryReason[] {
    const reasons: PatternDiscoveryReason[] = ['PAPER_ONLY_POLICY_LOCK'];

    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      reasons.push('POLICY_LOCK_ACTIVE');
    }

    if (sampleCount < this.policy.minimumSamples) {
      reasons.push('LOW_SAMPLE_SIZE');
    } else {
      reasons.push('RECURRING_PATTERN');
    }

    if (blockRate > this.policy.maximumBlockRate) {
      reasons.push('EXCESSIVE_BLOCK_RATE');
    }

    if (averageRiskScore > this.policy.maximumAverageRiskScore) {
      reasons.push('EXCESSIVE_RISK');
    }

    if (averageOperatorScore < this.policy.minimumAverageOperatorScore) {
      reasons.push('WEAK_OPERATOR_CONTEXT');
    }

    if (status === 'PATTERN_BLOCKED') {
      reasons.push('BLOCKED_PATTERN');
    } else if (patternScore >= this.policy.minimumSupportScore) {
      reasons.push('SUPPORTIVE_PATTERN');
    } else if (patternScore >= this.policy.minimumNeutralScore) {
      reasons.push('NEUTRAL_PATTERN');
    } else {
      reasons.push('DEGRADED_PATTERN');
    }

    return reasons;
  }

  private validate(
    samples: readonly PatternDiscoverySample[],
  ): PatternDiscoveryFailure | null {
    if (this.policy.minimumSamples <= 0) {
      return {
        code: 'INVALID_PATTERN_DISCOVERY_INPUT',
        message: 'minimumSamples must be greater than zero',
      };
    }

    if (this.policy.maximumBlockRate < 0 || this.policy.maximumBlockRate > 1) {
      return {
        code: 'INVALID_PATTERN_DISCOVERY_INPUT',
        message: 'maximumBlockRate must be between 0 and 1',
      };
    }

    for (const sample of samples) {
      if (sample.sampleId.trim().length === 0) {
        return {
          code: 'INVALID_PATTERN_DISCOVERY_INPUT',
          message: 'sampleId must not be empty',
        };
      }

      if (sample.patternKey.trim().length === 0) {
        return {
          code: 'INVALID_PATTERN_DISCOVERY_INPUT',
          message: 'patternKey must not be empty',
        };
      }

      if (sample.strategyId.trim().length === 0) {
        return {
          code: 'INVALID_PATTERN_DISCOVERY_INPUT',
          message: 'strategyId must not be empty',
        };
      }

      if (sample.tableId.trim().length === 0) {
        return {
          code: 'INVALID_PATTERN_DISCOVERY_INPUT',
          message: 'tableId must not be empty',
        };
      }

      if (!Number.isFinite(sample.occurredAtEpochMs) || sample.occurredAtEpochMs < 0) {
        return {
          code: 'INVALID_PATTERN_DISCOVERY_INPUT',
          message: 'occurredAtEpochMs must be a valid non-negative timestamp',
        };
      }

      const scores = [
        sample.memoryScore,
        sample.similarityScore,
        sample.correlationScore,
        sample.outcomeScore,
        sample.riskScore,
        sample.operatorScore,
      ];

      if (scores.some((score) => score < 0 || score > 1 || !Number.isFinite(score))) {
        return {
          code: 'INVALID_PATTERN_DISCOVERY_INPUT',
          message: 'all normalized scores must be between 0 and 1',
        };
      }
    }

    return null;
  }
}
