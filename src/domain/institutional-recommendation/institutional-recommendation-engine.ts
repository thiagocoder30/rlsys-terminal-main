export type InstitutionalRecommendationDecision =
  | 'PAPER_FAVORAVEL'
  | 'OBSERVAR'
  | 'NAO_UTILIZAR';

export type InstitutionalRecommendationReason =
  | 'PAPER_ONLY_POLICY_LOCK'
  | 'READINESS_BLOCKED'
  | 'CERTIFICATION_BLOCKED'
  | 'RISK_BLOCKED'
  | 'OPERATOR_BLOCKED'
  | 'CONSENSUS_WEAK'
  | 'CONFIDENCE_WEAK'
  | 'REPUTATION_WEAK'
  | 'LEARNING_REJECTED'
  | 'LEARNING_UNCERTAIN'
  | 'PATTERN_DEGRADED'
  | 'CORRELATION_DEGRADED'
  | 'SIMILARITY_DEGRADED'
  | 'MEMORY_DEGRADED'
  | 'INSTITUTIONAL_ALIGNMENT_STRONG'
  | 'INSTITUTIONAL_ALIGNMENT_MODERATE'
  | 'INSTITUTIONAL_ALIGNMENT_WEAK'
  | 'POLICY_LOCK_ACTIVE';

export type LearningValidationStatus =
  | 'LEARNING_TRUSTED'
  | 'LEARNING_UNCERTAIN'
  | 'LEARNING_REJECTED'
  | 'LEARNING_BLOCKED';

export interface InstitutionalRecommendationInput {
  readonly recommendationId: string;
  readonly sessionId: string;
  readonly strategyId: string;
  readonly tableId: string;
  readonly readinessApproved: boolean;
  readonly certificationApproved: boolean;
  readonly riskApproved: boolean;
  readonly operatorApproved: boolean;
  readonly consensusScore: number;
  readonly calibratedConfidence: number;
  readonly strategyReputationScore: number;
  readonly tableReputationScore: number;
  readonly memoryScore: number;
  readonly similarityScore: number;
  readonly correlationScore: number;
  readonly patternScore: number;
  readonly learningWeightScore: number;
  readonly learningValidationScore: number;
  readonly learningValidationStatus: LearningValidationStatus;
}

export interface InstitutionalRecommendationPolicy {
  readonly minimumPaperFavorableScore: number;
  readonly minimumObserveScore: number;
  readonly minimumConsensusScore: number;
  readonly minimumConfidenceScore: number;
  readonly minimumReputationScore: number;
  readonly minimumLearningValidationScore: number;
  readonly productionMoneyAllowed: boolean;
  readonly liveMoneyAuthorization: boolean;
}

export interface InstitutionalRecommendationReport {
  readonly recommendationId: string;
  readonly sessionId: string;
  readonly strategyId: string;
  readonly tableId: string;
  readonly decision: InstitutionalRecommendationDecision;
  readonly institutionalScore: number;
  readonly learningScore: number;
  readonly defensiveBlock: boolean;
  readonly reasons: readonly InstitutionalRecommendationReason[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly paperOnly: true;
}

export interface InstitutionalRecommendationFailure {
  readonly code: 'INVALID_INSTITUTIONAL_RECOMMENDATION_INPUT';
  readonly message: string;
}

export type InstitutionalRecommendationResult =
  | {
      readonly ok: true;
      readonly value: InstitutionalRecommendationReport;
    }
  | {
      readonly ok: false;
      readonly error: InstitutionalRecommendationFailure;
    };

const DEFAULT_POLICY: InstitutionalRecommendationPolicy = Object.freeze({
  minimumPaperFavorableScore: 0.72,
  minimumObserveScore: 0.48,
  minimumConsensusScore: 0.55,
  minimumConfidenceScore: 0.55,
  minimumReputationScore: 0.5,
  minimumLearningValidationScore: 0.55,
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

const clamp01 = (value: number): number => {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

export class InstitutionalRecommendationEngine {
  private readonly policy: InstitutionalRecommendationPolicy;

  public constructor(policy: InstitutionalRecommendationPolicy = DEFAULT_POLICY) {
    this.policy = Object.freeze({
      minimumPaperFavorableScore: policy.minimumPaperFavorableScore,
      minimumObserveScore: policy.minimumObserveScore,
      minimumConsensusScore: policy.minimumConsensusScore,
      minimumConfidenceScore: policy.minimumConfidenceScore,
      minimumReputationScore: policy.minimumReputationScore,
      minimumLearningValidationScore: policy.minimumLearningValidationScore,
      productionMoneyAllowed: policy.productionMoneyAllowed,
      liveMoneyAuthorization: policy.liveMoneyAuthorization,
    });
  }

  /**
   * Produces a defensive PAPER-only institutional recommendation in O(1).
   * The output is a supervised decision label, never an automatic execution command.
   */
  public recommend(
    input: InstitutionalRecommendationInput,
  ): InstitutionalRecommendationResult {
    const validationFailure = this.validate(input);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const learningScore = this.calculateLearningScore(input);
    const institutionalScore = this.calculateInstitutionalScore(input, learningScore);
    const reasons = this.resolveReasons(input, institutionalScore, learningScore);
    const defensiveBlock = this.hasDefensiveBlock(reasons);
    const decision = this.resolveDecision(institutionalScore, defensiveBlock);

    return {
      ok: true,
      value: Object.freeze({
        recommendationId: input.recommendationId,
        sessionId: input.sessionId,
        strategyId: input.strategyId,
        tableId: input.tableId,
        decision,
        institutionalScore,
        learningScore,
        defensiveBlock,
        reasons: Object.freeze(reasons),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        paperOnly: true,
      }),
    };
  }

  private calculateLearningScore(input: InstitutionalRecommendationInput): number {
    const learningValidationMultiplier =
      input.learningValidationStatus === 'LEARNING_TRUSTED'
        ? 1
        : input.learningValidationStatus === 'LEARNING_UNCERTAIN'
          ? 0.55
          : 0;

    return round4(
      clamp01(
        (input.memoryScore * 0.16 +
          input.similarityScore * 0.14 +
          input.correlationScore * 0.16 +
          input.patternScore * 0.18 +
          input.learningWeightScore * 0.16 +
          input.learningValidationScore * 0.2) *
          learningValidationMultiplier,
      ),
    );
  }

  private calculateInstitutionalScore(
    input: InstitutionalRecommendationInput,
    learningScore: number,
  ): number {
    const gateScore =
      (input.readinessApproved ? 1 : 0) * 0.1 +
      (input.certificationApproved ? 1 : 0) * 0.1 +
      (input.riskApproved ? 1 : 0) * 0.1 +
      (input.operatorApproved ? 1 : 0) * 0.1;

    return round4(
      clamp01(
        gateScore +
          input.consensusScore * 0.12 +
          input.calibratedConfidence * 0.16 +
          input.strategyReputationScore * 0.09 +
          input.tableReputationScore * 0.09 +
          learningScore * 0.24,
      ),
    );
  }

  private resolveDecision(
    institutionalScore: number,
    defensiveBlock: boolean,
  ): InstitutionalRecommendationDecision {
    if (defensiveBlock) {
      return 'NAO_UTILIZAR';
    }

    if (institutionalScore >= this.policy.minimumPaperFavorableScore) {
      return 'PAPER_FAVORAVEL';
    }

    if (institutionalScore >= this.policy.minimumObserveScore) {
      return 'OBSERVAR';
    }

    return 'NAO_UTILIZAR';
  }

  private resolveReasons(
    input: InstitutionalRecommendationInput,
    institutionalScore: number,
    learningScore: number,
  ): InstitutionalRecommendationReason[] {
    const reasons: InstitutionalRecommendationReason[] = ['PAPER_ONLY_POLICY_LOCK'];

    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      reasons.push('POLICY_LOCK_ACTIVE');
    }

    if (!input.readinessApproved) reasons.push('READINESS_BLOCKED');
    if (!input.certificationApproved) reasons.push('CERTIFICATION_BLOCKED');
    if (!input.riskApproved) reasons.push('RISK_BLOCKED');
    if (!input.operatorApproved) reasons.push('OPERATOR_BLOCKED');

    if (input.consensusScore < this.policy.minimumConsensusScore) {
      reasons.push('CONSENSUS_WEAK');
    }

    if (input.calibratedConfidence < this.policy.minimumConfidenceScore) {
      reasons.push('CONFIDENCE_WEAK');
    }

    if (
      input.strategyReputationScore < this.policy.minimumReputationScore ||
      input.tableReputationScore < this.policy.minimumReputationScore
    ) {
      reasons.push('REPUTATION_WEAK');
    }

    if (input.learningValidationStatus === 'LEARNING_BLOCKED') {
      reasons.push('LEARNING_REJECTED');
    }

    if (input.learningValidationStatus === 'LEARNING_REJECTED') {
      reasons.push('LEARNING_REJECTED');
    }

    if (input.learningValidationStatus === 'LEARNING_UNCERTAIN') {
      reasons.push('LEARNING_UNCERTAIN');
    }

    if (input.learningValidationScore < this.policy.minimumLearningValidationScore) {
      reasons.push('LEARNING_UNCERTAIN');
    }

    if (input.patternScore < this.policy.minimumObserveScore) {
      reasons.push('PATTERN_DEGRADED');
    }

    if (input.correlationScore < this.policy.minimumObserveScore) {
      reasons.push('CORRELATION_DEGRADED');
    }

    if (input.similarityScore < this.policy.minimumObserveScore) {
      reasons.push('SIMILARITY_DEGRADED');
    }

    if (input.memoryScore < this.policy.minimumObserveScore) {
      reasons.push('MEMORY_DEGRADED');
    }

    if (institutionalScore >= this.policy.minimumPaperFavorableScore) {
      reasons.push('INSTITUTIONAL_ALIGNMENT_STRONG');
    } else if (
      institutionalScore >= this.policy.minimumObserveScore ||
      learningScore >= this.policy.minimumObserveScore
    ) {
      reasons.push('INSTITUTIONAL_ALIGNMENT_MODERATE');
    } else {
      reasons.push('INSTITUTIONAL_ALIGNMENT_WEAK');
    }

    return reasons;
  }

  private hasDefensiveBlock(
    reasons: readonly InstitutionalRecommendationReason[],
  ): boolean {
    return (
      reasons.includes('POLICY_LOCK_ACTIVE') ||
      reasons.includes('READINESS_BLOCKED') ||
      reasons.includes('CERTIFICATION_BLOCKED') ||
      reasons.includes('RISK_BLOCKED') ||
      reasons.includes('OPERATOR_BLOCKED') ||
      reasons.includes('LEARNING_REJECTED')
    );
  }

  private validate(
    input: InstitutionalRecommendationInput,
  ): InstitutionalRecommendationFailure | null {
    if (input.recommendationId.trim().length === 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_RECOMMENDATION_INPUT',
        message: 'recommendationId must not be empty',
      };
    }

    if (input.sessionId.trim().length === 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_RECOMMENDATION_INPUT',
        message: 'sessionId must not be empty',
      };
    }

    if (input.strategyId.trim().length === 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_RECOMMENDATION_INPUT',
        message: 'strategyId must not be empty',
      };
    }

    if (input.tableId.trim().length === 0) {
      return {
        code: 'INVALID_INSTITUTIONAL_RECOMMENDATION_INPUT',
        message: 'tableId must not be empty',
      };
    }

    const scores = [
      input.consensusScore,
      input.calibratedConfidence,
      input.strategyReputationScore,
      input.tableReputationScore,
      input.memoryScore,
      input.similarityScore,
      input.correlationScore,
      input.patternScore,
      input.learningWeightScore,
      input.learningValidationScore,
    ];

    if (scores.some((score) => score < 0 || score > 1 || !Number.isFinite(score))) {
      return {
        code: 'INVALID_INSTITUTIONAL_RECOMMENDATION_INPUT',
        message: 'all normalized scores must be between 0 and 1',
      };
    }

    return null;
  }
}
