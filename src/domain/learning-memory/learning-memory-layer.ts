export type LearningMemoryStatus =
  | 'MEMORY_SUPPORTS_PAPER'
  | 'MEMORY_NEUTRAL'
  | 'MEMORY_DEGRADED'
  | 'MEMORY_BLOCKED';

export type LearningMemoryTrend =
  | 'IMPROVING'
  | 'STABLE'
  | 'DEGRADING'
  | 'UNKNOWN';

export type LearningMemoryReason =
  | 'PAPER_ONLY_POLICY_LOCK'
  | 'NO_MEMORY'
  | 'LOW_SAMPLE_SIZE'
  | 'POSITIVE_CONTEXT_MEMORY'
  | 'NEUTRAL_CONTEXT_MEMORY'
  | 'NEGATIVE_CONTEXT_MEMORY'
  | 'CONTEXT_RECURRING'
  | 'CONTEXT_DEGRADING'
  | 'EXCESSIVE_DRAWDOWN'
  | 'OPERATOR_MEMORY_RISK'
  | 'CERTIFICATION_MEMORY_RISK'
  | 'POLICY_LOCK_ACTIVE';

export interface LearningMemorySample {
  readonly memoryId: string;
  readonly contextKey: string;
  readonly strategyId: string;
  readonly tableId: string;
  readonly occurredAtEpochMs: number;
  readonly paperSignals: number;
  readonly favorableSignals: number;
  readonly blockedSignals: number;
  readonly wins: number;
  readonly losses: number;
  readonly neutralOutcomes: number;
  readonly confidenceScore: number;
  readonly consensusScore: number;
  readonly maxDrawdownUnits: number;
  readonly operatorViolationCount: number;
  readonly certificationFailureCount: number;
}

export interface LearningMemoryPolicy {
  readonly minimumSamples: number;
  readonly minimumSupportScore: number;
  readonly minimumNeutralScore: number;
  readonly maximumDrawdownUnits: number;
  readonly maximumOperatorViolations: number;
  readonly maximumCertificationFailures: number;
  readonly productionMoneyAllowed: boolean;
  readonly liveMoneyAuthorization: boolean;
}

export interface LearningMemoryContextReport {
  readonly contextKey: string;
  readonly strategyId: string;
  readonly tableId: string;
  readonly status: LearningMemoryStatus;
  readonly trend: LearningMemoryTrend;
  readonly memoryScore: number;
  readonly sampleCount: number;
  readonly paperSignals: number;
  readonly winRate: number;
  readonly blockRate: number;
  readonly averageConfidenceScore: number;
  readonly averageConsensusScore: number;
  readonly maxDrawdownUnits: number;
  readonly reasons: readonly LearningMemoryReason[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly paperOnly: true;
}

export interface LearningMemoryReport {
  readonly status: LearningMemoryStatus;
  readonly totalSamples: number;
  readonly totalContexts: number;
  readonly contexts: readonly LearningMemoryContextReport[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly paperOnly: true;
}

export interface LearningMemoryFailure {
  readonly code: 'INVALID_LEARNING_MEMORY_INPUT';
  readonly message: string;
}

export type LearningMemoryResult =
  | {
      readonly ok: true;
      readonly value: LearningMemoryReport;
    }
  | {
      readonly ok: false;
      readonly error: LearningMemoryFailure;
    };

interface LearningMemoryAccumulator {
  contextKey: string;
  strategyId: string;
  tableId: string;
  sampleCount: number;
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
  firstScore: number;
  lastScore: number;
  firstEpochMs: number;
  lastEpochMs: number;
}

const DEFAULT_POLICY: LearningMemoryPolicy = Object.freeze({
  minimumSamples: 3,
  minimumSupportScore: 0.72,
  minimumNeutralScore: 0.48,
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

export class LearningMemoryLayer {
  private readonly policy: LearningMemoryPolicy;

  public constructor(policy: LearningMemoryPolicy = DEFAULT_POLICY) {
    this.policy = Object.freeze({
      minimumSamples: policy.minimumSamples,
      minimumSupportScore: policy.minimumSupportScore,
      minimumNeutralScore: policy.minimumNeutralScore,
      maximumDrawdownUnits: policy.maximumDrawdownUnits,
      maximumOperatorViolations: policy.maximumOperatorViolations,
      maximumCertificationFailures: policy.maximumCertificationFailures,
      productionMoneyAllowed: policy.productionMoneyAllowed,
      liveMoneyAuthorization: policy.liveMoneyAuthorization,
    });
  }

  /**
   * Builds supervised PAPER learning memory from historical contexts.
   * Aggregation is O(n). Memory usage is O(k), where k is unique context count.
   */
  public evaluate(samples: readonly LearningMemorySample[]): LearningMemoryResult {
    const validationFailure = this.validate(samples);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const accumulators = this.aggregate(samples);
    const contexts: LearningMemoryContextReport[] = [];

    for (const accumulator of accumulators.values()) {
      contexts.push(this.toContextReport(accumulator));
    }

    contexts.sort((left, right) => left.contextKey.localeCompare(right.contextKey));

    return {
      ok: true,
      value: Object.freeze({
        status: this.resolveGlobalStatus(contexts),
        totalSamples: samples.length,
        totalContexts: contexts.length,
        contexts: Object.freeze(contexts),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        paperOnly: true,
      }),
    };
  }

  private aggregate(
    samples: readonly LearningMemorySample[],
  ): Map<string, LearningMemoryAccumulator> {
    const accumulators = new Map<string, LearningMemoryAccumulator>();

    for (const sample of samples) {
      const sampleScore = this.calculateSampleScore(sample);
      const current = accumulators.get(sample.contextKey);

      if (current === undefined) {
        accumulators.set(sample.contextKey, {
          contextKey: sample.contextKey,
          strategyId: sample.strategyId,
          tableId: sample.tableId,
          sampleCount: 1,
          paperSignals: sample.paperSignals,
          favorableSignals: sample.favorableSignals,
          blockedSignals: sample.blockedSignals,
          wins: sample.wins,
          losses: sample.losses,
          neutralOutcomes: sample.neutralOutcomes,
          confidenceScoreSum: sample.confidenceScore,
          consensusScoreSum: sample.consensusScore,
          maxDrawdownUnits: sample.maxDrawdownUnits,
          operatorViolationCount: sample.operatorViolationCount,
          certificationFailureCount: sample.certificationFailureCount,
          firstScore: sampleScore,
          lastScore: sampleScore,
          firstEpochMs: sample.occurredAtEpochMs,
          lastEpochMs: sample.occurredAtEpochMs,
        });
      } else {
        current.sampleCount += 1;
        current.paperSignals += sample.paperSignals;
        current.favorableSignals += sample.favorableSignals;
        current.blockedSignals += sample.blockedSignals;
        current.wins += sample.wins;
        current.losses += sample.losses;
        current.neutralOutcomes += sample.neutralOutcomes;
        current.confidenceScoreSum += sample.confidenceScore;
        current.consensusScoreSum += sample.consensusScore;
        current.maxDrawdownUnits = Math.max(
          current.maxDrawdownUnits,
          sample.maxDrawdownUnits,
        );
        current.operatorViolationCount += sample.operatorViolationCount;
        current.certificationFailureCount += sample.certificationFailureCount;

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

  private toContextReport(
    accumulator: LearningMemoryAccumulator,
  ): LearningMemoryContextReport {
    const decisiveOutcomes = accumulator.wins + accumulator.losses;
    const winRate = safeRatio(accumulator.wins, decisiveOutcomes);
    const blockRate = safeRatio(accumulator.blockedSignals, accumulator.paperSignals);
    const averageConfidenceScore = safeRatio(
      accumulator.confidenceScoreSum,
      accumulator.sampleCount,
    );
    const averageConsensusScore = safeRatio(
      accumulator.consensusScoreSum,
      accumulator.sampleCount,
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

    const memoryScore = round4(
      clamp01(
        winRate * 0.3 +
          (1 - blockRate) * 0.18 +
          averageConfidenceScore * 0.22 +
          averageConsensusScore * 0.2 +
          safeRatio(accumulator.favorableSignals, accumulator.paperSignals) * 0.1 -
          drawdownPenalty -
          operatorPenalty -
          certificationPenalty,
      ),
    );

    const trend = this.resolveTrend(accumulator.firstScore, accumulator.lastScore);
    const status = this.resolveStatus(accumulator, memoryScore, trend);
    const reasons = this.resolveReasons(accumulator, memoryScore, trend);

    return Object.freeze({
      contextKey: accumulator.contextKey,
      strategyId: accumulator.strategyId,
      tableId: accumulator.tableId,
      status,
      trend,
      memoryScore,
      sampleCount: accumulator.sampleCount,
      paperSignals: accumulator.paperSignals,
      winRate,
      blockRate,
      averageConfidenceScore,
      averageConsensusScore,
      maxDrawdownUnits: accumulator.maxDrawdownUnits,
      reasons: Object.freeze(reasons),
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
      paperOnly: true,
    });
  }

  private calculateSampleScore(sample: LearningMemorySample): number {
    const decisiveOutcomes = sample.wins + sample.losses;
    const winRate = safeRatio(sample.wins, decisiveOutcomes);
    const blockHealth = 1 - safeRatio(sample.blockedSignals, sample.paperSignals);
    const favorableRate = safeRatio(sample.favorableSignals, sample.paperSignals);

    return clamp01(
      winRate * 0.34 +
        blockHealth * 0.18 +
        favorableRate * 0.12 +
        sample.confidenceScore * 0.18 +
        sample.consensusScore * 0.18,
    );
  }

  private resolveTrend(
    firstScore: number,
    lastScore: number,
  ): LearningMemoryTrend {
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
    accumulator: LearningMemoryAccumulator,
    memoryScore: number,
    trend: LearningMemoryTrend,
  ): LearningMemoryStatus {
    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      return 'MEMORY_BLOCKED';
    }

    if (accumulator.sampleCount < this.policy.minimumSamples) {
      return 'MEMORY_NEUTRAL';
    }

    if (accumulator.maxDrawdownUnits > this.policy.maximumDrawdownUnits) {
      return 'MEMORY_BLOCKED';
    }

    if (
      accumulator.operatorViolationCount > this.policy.maximumOperatorViolations
    ) {
      return 'MEMORY_BLOCKED';
    }

    if (
      accumulator.certificationFailureCount >
      this.policy.maximumCertificationFailures
    ) {
      return 'MEMORY_BLOCKED';
    }

    if (trend === 'DEGRADING' && memoryScore < this.policy.minimumSupportScore) {
      return 'MEMORY_DEGRADED';
    }

    if (memoryScore >= this.policy.minimumSupportScore) {
      return 'MEMORY_SUPPORTS_PAPER';
    }

    if (memoryScore >= this.policy.minimumNeutralScore) {
      return 'MEMORY_NEUTRAL';
    }

    return 'MEMORY_DEGRADED';
  }

  private resolveGlobalStatus(
    contexts: readonly LearningMemoryContextReport[],
  ): LearningMemoryStatus {
    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      return 'MEMORY_BLOCKED';
    }

    if (contexts.length === 0) {
      return 'MEMORY_NEUTRAL';
    }

    if (contexts.some((context) => context.status === 'MEMORY_BLOCKED')) {
      return 'MEMORY_BLOCKED';
    }

    if (contexts.some((context) => context.status === 'MEMORY_SUPPORTS_PAPER')) {
      return 'MEMORY_SUPPORTS_PAPER';
    }

    if (contexts.some((context) => context.status === 'MEMORY_DEGRADED')) {
      return 'MEMORY_DEGRADED';
    }

    return 'MEMORY_NEUTRAL';
  }

  private resolveReasons(
    accumulator: LearningMemoryAccumulator,
    memoryScore: number,
    trend: LearningMemoryTrend,
  ): readonly LearningMemoryReason[] {
    const reasons: LearningMemoryReason[] = ['PAPER_ONLY_POLICY_LOCK'];

    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      reasons.push('POLICY_LOCK_ACTIVE');
    }

    if (accumulator.sampleCount === 0 || accumulator.paperSignals === 0) {
      reasons.push('NO_MEMORY');
    }

    if (accumulator.sampleCount < this.policy.minimumSamples) {
      reasons.push('LOW_SAMPLE_SIZE');
    }

    if (accumulator.sampleCount >= this.policy.minimumSamples) {
      reasons.push('CONTEXT_RECURRING');
    }

    if (trend === 'DEGRADING') {
      reasons.push('CONTEXT_DEGRADING');
    }

    if (accumulator.maxDrawdownUnits > this.policy.maximumDrawdownUnits) {
      reasons.push('EXCESSIVE_DRAWDOWN');
    }

    if (
      accumulator.operatorViolationCount > this.policy.maximumOperatorViolations
    ) {
      reasons.push('OPERATOR_MEMORY_RISK');
    }

    if (
      accumulator.certificationFailureCount >
      this.policy.maximumCertificationFailures
    ) {
      reasons.push('CERTIFICATION_MEMORY_RISK');
    }

    if (memoryScore >= this.policy.minimumSupportScore) {
      reasons.push('POSITIVE_CONTEXT_MEMORY');
    } else if (memoryScore >= this.policy.minimumNeutralScore) {
      reasons.push('NEUTRAL_CONTEXT_MEMORY');
    } else {
      reasons.push('NEGATIVE_CONTEXT_MEMORY');
    }

    return reasons;
  }

  private validate(
    samples: readonly LearningMemorySample[],
  ): LearningMemoryFailure | null {
    if (this.policy.minimumSamples <= 0) {
      return {
        code: 'INVALID_LEARNING_MEMORY_INPUT',
        message: 'minimumSamples must be greater than zero',
      };
    }

    for (const sample of samples) {
      if (sample.memoryId.trim().length === 0) {
        return {
          code: 'INVALID_LEARNING_MEMORY_INPUT',
          message: 'memoryId must not be empty',
        };
      }

      if (sample.contextKey.trim().length === 0) {
        return {
          code: 'INVALID_LEARNING_MEMORY_INPUT',
          message: 'contextKey must not be empty',
        };
      }

      if (sample.strategyId.trim().length === 0) {
        return {
          code: 'INVALID_LEARNING_MEMORY_INPUT',
          message: 'strategyId must not be empty',
        };
      }

      if (sample.tableId.trim().length === 0) {
        return {
          code: 'INVALID_LEARNING_MEMORY_INPUT',
          message: 'tableId must not be empty',
        };
      }

      if (!Number.isFinite(sample.occurredAtEpochMs) || sample.occurredAtEpochMs < 0) {
        return {
          code: 'INVALID_LEARNING_MEMORY_INPUT',
          message: 'occurredAtEpochMs must be a valid non-negative timestamp',
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
          code: 'INVALID_LEARNING_MEMORY_INPUT',
          message: 'numeric counters must not be negative',
        };
      }

      if (sample.favorableSignals + sample.blockedSignals > sample.paperSignals) {
        return {
          code: 'INVALID_LEARNING_MEMORY_INPUT',
          message: 'favorableSignals plus blockedSignals must not exceed paperSignals',
        };
      }

      const normalizedScores = [sample.confidenceScore, sample.consensusScore];

      if (normalizedScores.some((value) => value < 0 || value > 1)) {
        return {
          code: 'INVALID_LEARNING_MEMORY_INPUT',
          message: 'normalized scores must be between 0 and 1',
        };
      }
    }

    return null;
  }
}
