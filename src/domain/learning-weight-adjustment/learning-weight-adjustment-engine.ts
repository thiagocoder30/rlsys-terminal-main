export type LearningWeightName =
  | 'baseConfidence'
  | 'strategyReputation'
  | 'tableReputation'
  | 'memory'
  | 'similarity'
  | 'correlation'
  | 'pattern'
  | 'risk'
  | 'operator'
  | 'consensus';

export type LearningWeightAdjustmentStatus =
  | 'WEIGHTS_SUPPORT_PAPER'
  | 'WEIGHTS_NEUTRAL'
  | 'WEIGHTS_DEGRADED'
  | 'WEIGHTS_BLOCKED';

export type LearningWeightAdjustmentReason =
  | 'PAPER_ONLY_POLICY_LOCK'
  | 'LOW_EVIDENCE'
  | 'SUPPORTIVE_LEARNING_EVIDENCE'
  | 'NEUTRAL_LEARNING_EVIDENCE'
  | 'DEGRADED_LEARNING_EVIDENCE'
  | 'RISK_WEIGHT_ELEVATED'
  | 'OPERATOR_WEIGHT_DEGRADED'
  | 'PATTERN_WEIGHT_DEGRADED'
  | 'DEFENSIVE_WEIGHT_BLOCK'
  | 'POLICY_LOCK_ACTIVE';

export interface LearningWeightVector {
  readonly baseConfidence: number;
  readonly strategyReputation: number;
  readonly tableReputation: number;
  readonly memory: number;
  readonly similarity: number;
  readonly correlation: number;
  readonly pattern: number;
  readonly risk: number;
  readonly operator: number;
  readonly consensus: number;
}

export interface LearningWeightAdjustmentEvidence {
  readonly evidenceId: string;
  readonly memoryScore: number;
  readonly similarityScore: number;
  readonly correlationScore: number;
  readonly patternScore: number;
  readonly outcomeScore: number;
  readonly riskScore: number;
  readonly operatorScore: number;
  readonly confidenceScore: number;
  readonly consensusScore: number;
  readonly blocked: boolean;
}

export interface LearningWeightAdjustmentInput {
  readonly adjustmentId: string;
  readonly baseWeights: LearningWeightVector;
  readonly evidence: readonly LearningWeightAdjustmentEvidence[];
}

export interface LearningWeightAdjustmentPolicy {
  readonly minimumEvidence: number;
  readonly minimumSupportScore: number;
  readonly minimumNeutralScore: number;
  readonly maximumRiskScore: number;
  readonly minimumOperatorScore: number;
  readonly maximumWeightDelta: number;
  readonly productionMoneyAllowed: boolean;
  readonly liveMoneyAuthorization: boolean;
}

export interface LearningWeightAdjustmentReport {
  readonly adjustmentId: string;
  readonly status: LearningWeightAdjustmentStatus;
  readonly evidenceCount: number;
  readonly learningScore: number;
  readonly baseWeights: LearningWeightVector;
  readonly adjustedWeights: LearningWeightVector;
  readonly normalizedWeights: LearningWeightVector;
  readonly reasons: readonly LearningWeightAdjustmentReason[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly paperOnly: true;
}

export interface LearningWeightAdjustmentFailure {
  readonly code: 'INVALID_LEARNING_WEIGHT_ADJUSTMENT_INPUT';
  readonly message: string;
}

export type LearningWeightAdjustmentResult =
  | {
      readonly ok: true;
      readonly value: LearningWeightAdjustmentReport;
    }
  | {
      readonly ok: false;
      readonly error: LearningWeightAdjustmentFailure;
    };

const WEIGHT_NAMES: readonly LearningWeightName[] = Object.freeze([
  'baseConfidence',
  'strategyReputation',
  'tableReputation',
  'memory',
  'similarity',
  'correlation',
  'pattern',
  'risk',
  'operator',
  'consensus',
]);

const DEFAULT_POLICY: LearningWeightAdjustmentPolicy = Object.freeze({
  minimumEvidence: 3,
  minimumSupportScore: 0.72,
  minimumNeutralScore: 0.48,
  maximumRiskScore: 0.62,
  minimumOperatorScore: 0.58,
  maximumWeightDelta: 0.08,
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

const sumWeights = (weights: LearningWeightVector): number => {
  let total = 0;

  for (const weightName of WEIGHT_NAMES) {
    total += weights[weightName];
  }

  return total;
};

export class LearningWeightAdjustmentEngine {
  private readonly policy: LearningWeightAdjustmentPolicy;

  public constructor(policy: LearningWeightAdjustmentPolicy = DEFAULT_POLICY) {
    this.policy = Object.freeze({
      minimumEvidence: policy.minimumEvidence,
      minimumSupportScore: policy.minimumSupportScore,
      minimumNeutralScore: policy.minimumNeutralScore,
      maximumRiskScore: policy.maximumRiskScore,
      minimumOperatorScore: policy.minimumOperatorScore,
      maximumWeightDelta: policy.maximumWeightDelta,
      productionMoneyAllowed: policy.productionMoneyAllowed,
      liveMoneyAuthorization: policy.liveMoneyAuthorization,
    });
  }

  /**
   * Adjusts institutional learning weights in O(n + w).
   * This engine never authorizes real-money operation.
   */
  public adjust(
    input: LearningWeightAdjustmentInput,
  ): LearningWeightAdjustmentResult {
    const validationFailure = this.validate(input);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const averages = this.calculateAverages(input.evidence);
    const learningScore = this.calculateLearningScore(averages);
    const adjustedWeights = this.adjustWeights(input.baseWeights, averages);
    const normalizedWeights = this.normalizeWeights(adjustedWeights);
    const reasons = this.resolveReasons(input.evidence.length, averages, learningScore);
    const status = this.resolveStatus(input.evidence.length, averages, learningScore);

    return {
      ok: true,
      value: Object.freeze({
        adjustmentId: input.adjustmentId,
        status,
        evidenceCount: input.evidence.length,
        learningScore,
        baseWeights: Object.freeze({ ...input.baseWeights }),
        adjustedWeights: Object.freeze(adjustedWeights),
        normalizedWeights: Object.freeze(normalizedWeights),
        reasons: Object.freeze(reasons),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        paperOnly: true,
      }),
    };
  }

  private calculateAverages(
    evidence: readonly LearningWeightAdjustmentEvidence[],
  ): LearningWeightAdjustmentEvidence {
    let memoryScore = 0;
    let similarityScore = 0;
    let correlationScore = 0;
    let patternScore = 0;
    let outcomeScore = 0;
    let riskScore = 0;
    let operatorScore = 0;
    let confidenceScore = 0;
    let consensusScore = 0;
    let blockedCount = 0;

    for (const item of evidence) {
      memoryScore += item.memoryScore;
      similarityScore += item.similarityScore;
      correlationScore += item.correlationScore;
      patternScore += item.patternScore;
      outcomeScore += item.outcomeScore;
      riskScore += item.riskScore;
      operatorScore += item.operatorScore;
      confidenceScore += item.confidenceScore;
      consensusScore += item.consensusScore;
      blockedCount += item.blocked ? 1 : 0;
    }

    const count = evidence.length;

    return Object.freeze({
      evidenceId: 'average-learning-evidence',
      memoryScore: safeRatio(memoryScore, count),
      similarityScore: safeRatio(similarityScore, count),
      correlationScore: safeRatio(correlationScore, count),
      patternScore: safeRatio(patternScore, count),
      outcomeScore: safeRatio(outcomeScore, count),
      riskScore: safeRatio(riskScore, count),
      operatorScore: safeRatio(operatorScore, count),
      confidenceScore: safeRatio(confidenceScore, count),
      consensusScore: safeRatio(consensusScore, count),
      blocked: safeRatio(blockedCount, count) > 0.35,
    });
  }

  private calculateLearningScore(
    averages: LearningWeightAdjustmentEvidence,
  ): number {
    const blockedPenalty = averages.blocked ? 0.18 : 0;

    return round4(
      clamp01(
        averages.memoryScore * 0.14 +
          averages.similarityScore * 0.12 +
          averages.correlationScore * 0.14 +
          averages.patternScore * 0.16 +
          averages.outcomeScore * 0.16 +
          averages.confidenceScore * 0.1 +
          averages.consensusScore * 0.1 +
          averages.operatorScore * 0.08 +
          (1 - averages.riskScore) * 0.1 -
          blockedPenalty,
      ),
    );
  }

  private adjustWeights(
    baseWeights: LearningWeightVector,
    averages: LearningWeightAdjustmentEvidence,
  ): LearningWeightVector {
    const delta = this.policy.maximumWeightDelta;

    return Object.freeze({
      baseConfidence: this.adjustSingleWeight(
        baseWeights.baseConfidence,
        averages.confidenceScore,
        delta,
      ),
      strategyReputation: this.adjustSingleWeight(
        baseWeights.strategyReputation,
        averages.outcomeScore,
        delta,
      ),
      tableReputation: this.adjustSingleWeight(
        baseWeights.tableReputation,
        averages.outcomeScore,
        delta,
      ),
      memory: this.adjustSingleWeight(baseWeights.memory, averages.memoryScore, delta),
      similarity: this.adjustSingleWeight(
        baseWeights.similarity,
        averages.similarityScore,
        delta,
      ),
      correlation: this.adjustSingleWeight(
        baseWeights.correlation,
        averages.correlationScore,
        delta,
      ),
      pattern: this.adjustSingleWeight(baseWeights.pattern, averages.patternScore, delta),
      risk: this.adjustRiskWeight(baseWeights.risk, averages.riskScore, delta),
      operator: this.adjustSingleWeight(
        baseWeights.operator,
        averages.operatorScore,
        delta,
      ),
      consensus: this.adjustSingleWeight(
        baseWeights.consensus,
        averages.consensusScore,
        delta,
      ),
    });
  }

  private adjustSingleWeight(
    currentWeight: number,
    evidenceScore: number,
    maximumDelta: number,
  ): number {
    const centeredEvidence = evidenceScore - 0.5;
    const delta = centeredEvidence * maximumDelta * 2;

    return round4(clamp01(currentWeight + delta));
  }

  private adjustRiskWeight(
    currentWeight: number,
    riskScore: number,
    maximumDelta: number,
  ): number {
    if (riskScore > this.policy.maximumRiskScore) {
      return round4(clamp01(currentWeight + maximumDelta));
    }

    return round4(clamp01(currentWeight - maximumDelta / 2));
  }

  private normalizeWeights(weights: LearningWeightVector): LearningWeightVector {
    const total = sumWeights(weights);

    if (total <= 0) {
      return Object.freeze({ ...weights });
    }

    return Object.freeze({
      baseConfidence: round4(weights.baseConfidence / total),
      strategyReputation: round4(weights.strategyReputation / total),
      tableReputation: round4(weights.tableReputation / total),
      memory: round4(weights.memory / total),
      similarity: round4(weights.similarity / total),
      correlation: round4(weights.correlation / total),
      pattern: round4(weights.pattern / total),
      risk: round4(weights.risk / total),
      operator: round4(weights.operator / total),
      consensus: round4(weights.consensus / total),
    });
  }

  private resolveStatus(
    evidenceCount: number,
    averages: LearningWeightAdjustmentEvidence,
    learningScore: number,
  ): LearningWeightAdjustmentStatus {
    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      return 'WEIGHTS_BLOCKED';
    }

    if (evidenceCount < this.policy.minimumEvidence) {
      return 'WEIGHTS_NEUTRAL';
    }

    if (averages.blocked || averages.riskScore > this.policy.maximumRiskScore) {
      return 'WEIGHTS_BLOCKED';
    }

    if (averages.operatorScore < this.policy.minimumOperatorScore) {
      return 'WEIGHTS_BLOCKED';
    }

    if (learningScore >= this.policy.minimumSupportScore) {
      return 'WEIGHTS_SUPPORT_PAPER';
    }

    if (learningScore >= this.policy.minimumNeutralScore) {
      return 'WEIGHTS_NEUTRAL';
    }

    return 'WEIGHTS_DEGRADED';
  }

  private resolveReasons(
    evidenceCount: number,
    averages: LearningWeightAdjustmentEvidence,
    learningScore: number,
  ): LearningWeightAdjustmentReason[] {
    const reasons: LearningWeightAdjustmentReason[] = ['PAPER_ONLY_POLICY_LOCK'];

    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      reasons.push('POLICY_LOCK_ACTIVE');
    }

    if (evidenceCount < this.policy.minimumEvidence) {
      reasons.push('LOW_EVIDENCE');
    }

    if (averages.riskScore > this.policy.maximumRiskScore) {
      reasons.push('RISK_WEIGHT_ELEVATED');
    }

    if (averages.operatorScore < this.policy.minimumOperatorScore) {
      reasons.push('OPERATOR_WEIGHT_DEGRADED');
    }

    if (averages.patternScore < this.policy.minimumNeutralScore) {
      reasons.push('PATTERN_WEIGHT_DEGRADED');
    }

    if (
      averages.blocked ||
      averages.riskScore > this.policy.maximumRiskScore ||
      averages.operatorScore < this.policy.minimumOperatorScore
    ) {
      reasons.push('DEFENSIVE_WEIGHT_BLOCK');
    }

    if (learningScore >= this.policy.minimumSupportScore) {
      reasons.push('SUPPORTIVE_LEARNING_EVIDENCE');
    } else if (learningScore >= this.policy.minimumNeutralScore) {
      reasons.push('NEUTRAL_LEARNING_EVIDENCE');
    } else {
      reasons.push('DEGRADED_LEARNING_EVIDENCE');
    }

    return reasons;
  }

  private validate(
    input: LearningWeightAdjustmentInput,
  ): LearningWeightAdjustmentFailure | null {
    if (input.adjustmentId.trim().length === 0) {
      return {
        code: 'INVALID_LEARNING_WEIGHT_ADJUSTMENT_INPUT',
        message: 'adjustmentId must not be empty',
      };
    }

    if (this.policy.minimumEvidence <= 0) {
      return {
        code: 'INVALID_LEARNING_WEIGHT_ADJUSTMENT_INPUT',
        message: 'minimumEvidence must be greater than zero',
      };
    }

    if (this.policy.maximumWeightDelta < 0 || this.policy.maximumWeightDelta > 1) {
      return {
        code: 'INVALID_LEARNING_WEIGHT_ADJUSTMENT_INPUT',
        message: 'maximumWeightDelta must be between 0 and 1',
      };
    }

    for (const weightName of WEIGHT_NAMES) {
      const weight = input.baseWeights[weightName];

      if (weight < 0 || weight > 1 || !Number.isFinite(weight)) {
        return {
          code: 'INVALID_LEARNING_WEIGHT_ADJUSTMENT_INPUT',
          message: 'base weights must be between 0 and 1',
        };
      }
    }

    for (const evidence of input.evidence) {
      if (evidence.evidenceId.trim().length === 0) {
        return {
          code: 'INVALID_LEARNING_WEIGHT_ADJUSTMENT_INPUT',
          message: 'evidenceId must not be empty',
        };
      }

      const scores = [
        evidence.memoryScore,
        evidence.similarityScore,
        evidence.correlationScore,
        evidence.patternScore,
        evidence.outcomeScore,
        evidence.riskScore,
        evidence.operatorScore,
        evidence.confidenceScore,
        evidence.consensusScore,
      ];

      if (scores.some((score) => score < 0 || score > 1 || !Number.isFinite(score))) {
        return {
          code: 'INVALID_LEARNING_WEIGHT_ADJUSTMENT_INPUT',
          message: 'evidence scores must be between 0 and 1',
        };
      }
    }

    return null;
  }
}
