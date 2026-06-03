export type LearningConfidenceValidationStatus =
  | 'LEARNING_TRUSTED'
  | 'LEARNING_UNCERTAIN'
  | 'LEARNING_REJECTED'
  | 'LEARNING_BLOCKED';

export type LearningConfidenceValidationReason =
  | 'PAPER_ONLY_POLICY_LOCK'
  | 'LOW_EVIDENCE_VOLUME'
  | 'LOW_RECURRENCE'
  | 'HIGH_VARIANCE'
  | 'POSITIVE_VALIDATED_LEARNING'
  | 'UNCERTAIN_VALIDATED_LEARNING'
  | 'NEGATIVE_VALIDATED_LEARNING'
  | 'EXCESSIVE_BLOCK_RATE'
  | 'EXCESSIVE_RISK'
  | 'WEAK_OPERATOR_RELIABILITY'
  | 'DEFENSIVE_LEARNING_BLOCK'
  | 'POLICY_LOCK_ACTIVE';

export interface LearningConfidenceValidationSample {
  readonly sampleId: string;
  readonly learningKey: string;
  readonly occurredAtEpochMs: number;
  readonly memoryScore: number;
  readonly patternScore: number;
  readonly correlationScore: number;
  readonly similarityScore: number;
  readonly adjustedWeightScore: number;
  readonly outcomeScore: number;
  readonly riskScore: number;
  readonly operatorScore: number;
  readonly blocked: boolean;
}

export interface LearningConfidenceValidationPolicy {
  readonly minimumEvidence: number;
  readonly minimumTrustedScore: number;
  readonly minimumUncertainScore: number;
  readonly minimumRecurrenceRate: number;
  readonly maximumVariance: number;
  readonly maximumBlockRate: number;
  readonly maximumRiskScore: number;
  readonly minimumOperatorScore: number;
  readonly productionMoneyAllowed: boolean;
  readonly liveMoneyAuthorization: boolean;
}

export interface LearningConfidenceValidationReport {
  readonly learningKey: string;
  readonly status: LearningConfidenceValidationStatus;
  readonly validationScore: number;
  readonly evidenceCount: number;
  readonly recurrenceRate: number;
  readonly varianceScore: number;
  readonly averageMemoryScore: number;
  readonly averagePatternScore: number;
  readonly averageCorrelationScore: number;
  readonly averageSimilarityScore: number;
  readonly averageAdjustedWeightScore: number;
  readonly averageOutcomeScore: number;
  readonly averageRiskScore: number;
  readonly averageOperatorScore: number;
  readonly blockRate: number;
  readonly reasons: readonly LearningConfidenceValidationReason[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly paperOnly: true;
}

export interface LearningConfidenceValidationFailure {
  readonly code: 'INVALID_LEARNING_CONFIDENCE_VALIDATION_INPUT';
  readonly message: string;
}

export type LearningConfidenceValidationResult =
  | {
      readonly ok: true;
      readonly value: LearningConfidenceValidationReport;
    }
  | {
      readonly ok: false;
      readonly error: LearningConfidenceValidationFailure;
    };

const DEFAULT_POLICY: LearningConfidenceValidationPolicy = Object.freeze({
  minimumEvidence: 5,
  minimumTrustedScore: 0.72,
  minimumUncertainScore: 0.48,
  minimumRecurrenceRate: 0.6,
  maximumVariance: 0.12,
  maximumBlockRate: 0.28,
  maximumRiskScore: 0.62,
  minimumOperatorScore: 0.58,
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

export class LearningConfidenceValidationEngine {
  private readonly policy: LearningConfidenceValidationPolicy;

  public constructor(policy: LearningConfidenceValidationPolicy = DEFAULT_POLICY) {
    this.policy = Object.freeze({
      minimumEvidence: policy.minimumEvidence,
      minimumTrustedScore: policy.minimumTrustedScore,
      minimumUncertainScore: policy.minimumUncertainScore,
      minimumRecurrenceRate: policy.minimumRecurrenceRate,
      maximumVariance: policy.maximumVariance,
      maximumBlockRate: policy.maximumBlockRate,
      maximumRiskScore: policy.maximumRiskScore,
      minimumOperatorScore: policy.minimumOperatorScore,
      productionMoneyAllowed: policy.productionMoneyAllowed,
      liveMoneyAuthorization: policy.liveMoneyAuthorization,
    });
  }

  /**
   * Validates whether accumulated supervised PAPER learning is trustworthy.
   * Complexity: O(n). Memory: O(1). This engine never authorizes live money.
   */
  public validateLearning(
    learningKey: string,
    samples: readonly LearningConfidenceValidationSample[],
  ): LearningConfidenceValidationResult {
    const validationFailure = this.validateInput(learningKey, samples);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const averages = this.calculateAverages(samples);
    const recurrenceRate = this.calculateRecurrenceRate(learningKey, samples);
    const varianceScore = this.calculateVariance(samples, averages.averageOutcomeScore);
    const validationScore = this.calculateValidationScore(
      averages,
      recurrenceRate,
      varianceScore,
    );
    const reasons = this.resolveReasons(
      samples.length,
      averages,
      recurrenceRate,
      varianceScore,
      validationScore,
    );
    const status = this.resolveStatus(
      samples.length,
      averages,
      recurrenceRate,
      varianceScore,
      validationScore,
    );

    return {
      ok: true,
      value: Object.freeze({
        learningKey,
        status,
        validationScore,
        evidenceCount: samples.length,
        recurrenceRate,
        varianceScore,
        averageMemoryScore: averages.averageMemoryScore,
        averagePatternScore: averages.averagePatternScore,
        averageCorrelationScore: averages.averageCorrelationScore,
        averageSimilarityScore: averages.averageSimilarityScore,
        averageAdjustedWeightScore: averages.averageAdjustedWeightScore,
        averageOutcomeScore: averages.averageOutcomeScore,
        averageRiskScore: averages.averageRiskScore,
        averageOperatorScore: averages.averageOperatorScore,
        blockRate: averages.blockRate,
        reasons: Object.freeze(reasons),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        paperOnly: true,
      }),
    };
  }

  private calculateAverages(
    samples: readonly LearningConfidenceValidationSample[],
  ): {
    readonly averageMemoryScore: number;
    readonly averagePatternScore: number;
    readonly averageCorrelationScore: number;
    readonly averageSimilarityScore: number;
    readonly averageAdjustedWeightScore: number;
    readonly averageOutcomeScore: number;
    readonly averageRiskScore: number;
    readonly averageOperatorScore: number;
    readonly blockRate: number;
  } {
    let memoryScore = 0;
    let patternScore = 0;
    let correlationScore = 0;
    let similarityScore = 0;
    let adjustedWeightScore = 0;
    let outcomeScore = 0;
    let riskScore = 0;
    let operatorScore = 0;
    let blockedCount = 0;

    for (const sample of samples) {
      memoryScore += sample.memoryScore;
      patternScore += sample.patternScore;
      correlationScore += sample.correlationScore;
      similarityScore += sample.similarityScore;
      adjustedWeightScore += sample.adjustedWeightScore;
      outcomeScore += sample.outcomeScore;
      riskScore += sample.riskScore;
      operatorScore += sample.operatorScore;
      blockedCount += sample.blocked ? 1 : 0;
    }

    const count = samples.length;

    return Object.freeze({
      averageMemoryScore: round4(safeRatio(memoryScore, count)),
      averagePatternScore: round4(safeRatio(patternScore, count)),
      averageCorrelationScore: round4(safeRatio(correlationScore, count)),
      averageSimilarityScore: round4(safeRatio(similarityScore, count)),
      averageAdjustedWeightScore: round4(safeRatio(adjustedWeightScore, count)),
      averageOutcomeScore: round4(safeRatio(outcomeScore, count)),
      averageRiskScore: round4(safeRatio(riskScore, count)),
      averageOperatorScore: round4(safeRatio(operatorScore, count)),
      blockRate: round4(safeRatio(blockedCount, count)),
    });
  }

  private calculateRecurrenceRate(
    learningKey: string,
    samples: readonly LearningConfidenceValidationSample[],
  ): number {
    let matchingCount = 0;

    for (const sample of samples) {
      if (sample.learningKey === learningKey) {
        matchingCount += 1;
      }
    }

    return round4(safeRatio(matchingCount, samples.length));
  }

  private calculateVariance(
    samples: readonly LearningConfidenceValidationSample[],
    averageOutcomeScore: number,
  ): number {
    if (samples.length === 0) {
      return 0;
    }

    let variance = 0;

    for (const sample of samples) {
      const delta = sample.outcomeScore - averageOutcomeScore;
      variance += delta * delta;
    }

    return round4(safeRatio(variance, samples.length));
  }

  private calculateValidationScore(
    averages: {
      readonly averageMemoryScore: number;
      readonly averagePatternScore: number;
      readonly averageCorrelationScore: number;
      readonly averageSimilarityScore: number;
      readonly averageAdjustedWeightScore: number;
      readonly averageOutcomeScore: number;
      readonly averageRiskScore: number;
      readonly averageOperatorScore: number;
      readonly blockRate: number;
    },
    recurrenceRate: number,
    varianceScore: number,
  ): number {
    return round4(
      clamp01(
        averages.averageMemoryScore * 0.12 +
          averages.averagePatternScore * 0.14 +
          averages.averageCorrelationScore * 0.14 +
          averages.averageSimilarityScore * 0.1 +
          averages.averageAdjustedWeightScore * 0.12 +
          averages.averageOutcomeScore * 0.16 +
          recurrenceRate * 0.1 +
          averages.averageOperatorScore * 0.06 +
          (1 - averages.averageRiskScore) * 0.04 +
          (1 - varianceScore) * 0.02 -
          averages.blockRate * 0.18,
      ),
    );
  }

  private resolveStatus(
    evidenceCount: number,
    averages: {
      readonly averageRiskScore: number;
      readonly averageOperatorScore: number;
      readonly blockRate: number;
    },
    recurrenceRate: number,
    varianceScore: number,
    validationScore: number,
  ): LearningConfidenceValidationStatus {
    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      return 'LEARNING_BLOCKED';
    }

    if (
      averages.blockRate > this.policy.maximumBlockRate ||
      averages.averageRiskScore > this.policy.maximumRiskScore ||
      averages.averageOperatorScore < this.policy.minimumOperatorScore
    ) {
      return 'LEARNING_BLOCKED';
    }

    if (
      evidenceCount < this.policy.minimumEvidence ||
      recurrenceRate < this.policy.minimumRecurrenceRate ||
      varianceScore > this.policy.maximumVariance
    ) {
      return 'LEARNING_UNCERTAIN';
    }

    if (validationScore >= this.policy.minimumTrustedScore) {
      return 'LEARNING_TRUSTED';
    }

    if (validationScore >= this.policy.minimumUncertainScore) {
      return 'LEARNING_UNCERTAIN';
    }

    return 'LEARNING_REJECTED';
  }

  private resolveReasons(
    evidenceCount: number,
    averages: {
      readonly averageRiskScore: number;
      readonly averageOperatorScore: number;
      readonly blockRate: number;
    },
    recurrenceRate: number,
    varianceScore: number,
    validationScore: number,
  ): LearningConfidenceValidationReason[] {
    const reasons: LearningConfidenceValidationReason[] = ['PAPER_ONLY_POLICY_LOCK'];

    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      reasons.push('POLICY_LOCK_ACTIVE');
    }

    if (evidenceCount < this.policy.minimumEvidence) {
      reasons.push('LOW_EVIDENCE_VOLUME');
    }

    if (recurrenceRate < this.policy.minimumRecurrenceRate) {
      reasons.push('LOW_RECURRENCE');
    }

    if (varianceScore > this.policy.maximumVariance) {
      reasons.push('HIGH_VARIANCE');
    }

    if (averages.blockRate > this.policy.maximumBlockRate) {
      reasons.push('EXCESSIVE_BLOCK_RATE');
    }

    if (averages.averageRiskScore > this.policy.maximumRiskScore) {
      reasons.push('EXCESSIVE_RISK');
    }

    if (averages.averageOperatorScore < this.policy.minimumOperatorScore) {
      reasons.push('WEAK_OPERATOR_RELIABILITY');
    }

    if (
      averages.blockRate > this.policy.maximumBlockRate ||
      averages.averageRiskScore > this.policy.maximumRiskScore ||
      averages.averageOperatorScore < this.policy.minimumOperatorScore
    ) {
      reasons.push('DEFENSIVE_LEARNING_BLOCK');
    }

    if (validationScore >= this.policy.minimumTrustedScore) {
      reasons.push('POSITIVE_VALIDATED_LEARNING');
    } else if (validationScore >= this.policy.minimumUncertainScore) {
      reasons.push('UNCERTAIN_VALIDATED_LEARNING');
    } else {
      reasons.push('NEGATIVE_VALIDATED_LEARNING');
    }

    return reasons;
  }

  private validateInput(
    learningKey: string,
    samples: readonly LearningConfidenceValidationSample[],
  ): LearningConfidenceValidationFailure | null {
    if (learningKey.trim().length === 0) {
      return {
        code: 'INVALID_LEARNING_CONFIDENCE_VALIDATION_INPUT',
        message: 'learningKey must not be empty',
      };
    }

    if (this.policy.minimumEvidence <= 0) {
      return {
        code: 'INVALID_LEARNING_CONFIDENCE_VALIDATION_INPUT',
        message: 'minimumEvidence must be greater than zero',
      };
    }

    for (const sample of samples) {
      if (sample.sampleId.trim().length === 0) {
        return {
          code: 'INVALID_LEARNING_CONFIDENCE_VALIDATION_INPUT',
          message: 'sampleId must not be empty',
        };
      }

      if (sample.learningKey.trim().length === 0) {
        return {
          code: 'INVALID_LEARNING_CONFIDENCE_VALIDATION_INPUT',
          message: 'sample learningKey must not be empty',
        };
      }

      if (!Number.isFinite(sample.occurredAtEpochMs) || sample.occurredAtEpochMs < 0) {
        return {
          code: 'INVALID_LEARNING_CONFIDENCE_VALIDATION_INPUT',
          message: 'occurredAtEpochMs must be a valid non-negative timestamp',
        };
      }

      const scores = [
        sample.memoryScore,
        sample.patternScore,
        sample.correlationScore,
        sample.similarityScore,
        sample.adjustedWeightScore,
        sample.outcomeScore,
        sample.riskScore,
        sample.operatorScore,
      ];

      if (scores.some((score) => score < 0 || score > 1 || !Number.isFinite(score))) {
        return {
          code: 'INVALID_LEARNING_CONFIDENCE_VALIDATION_INPUT',
          message: 'all normalized scores must be between 0 and 1',
        };
      }
    }

    return null;
  }
}
