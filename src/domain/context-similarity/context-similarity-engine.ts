export type ContextSimilarityStatus =
  | 'SIMILARITY_SUPPORTS_PAPER'
  | 'SIMILARITY_NEUTRAL'
  | 'SIMILARITY_DEGRADED'
  | 'SIMILARITY_BLOCKED';

export type ContextSimilarityReason =
  | 'PAPER_ONLY_POLICY_LOCK'
  | 'NO_REFERENCE_CONTEXTS'
  | 'NO_SIMILAR_CONTEXT'
  | 'LOW_SIMILARITY'
  | 'MODERATE_SIMILARITY'
  | 'HIGH_SIMILARITY'
  | 'SIMILAR_CONTEXT_POSITIVE'
  | 'SIMILAR_CONTEXT_NEGATIVE'
  | 'SIMILAR_CONTEXT_BLOCKED'
  | 'POLICY_LOCK_ACTIVE';

export interface ContextSimilarityVector {
  readonly volatilityScore: number;
  readonly consensusScore: number;
  readonly confidenceScore: number;
  readonly riskScore: number;
  readonly operatorScore: number;
  readonly strategyReputationScore: number;
  readonly tableReputationScore: number;
  readonly memoryScore: number;
}

export interface ContextSimilarityReference {
  readonly contextId: string;
  readonly strategyId: string;
  readonly tableId: string;
  readonly vector: ContextSimilarityVector;
  readonly historicalOutcomeScore: number;
  readonly blocked: boolean;
}

export interface ContextSimilarityInput {
  readonly currentContextId: string;
  readonly strategyId: string;
  readonly tableId: string;
  readonly currentVector: ContextSimilarityVector;
  readonly references: readonly ContextSimilarityReference[];
}

export interface ContextSimilarityPolicy {
  readonly minimumHighSimilarity: number;
  readonly minimumModerateSimilarity: number;
  readonly minimumPositiveOutcomeScore: number;
  readonly maximumNegativeOutcomeScore: number;
  readonly productionMoneyAllowed: boolean;
  readonly liveMoneyAuthorization: boolean;
}

export interface ContextSimilarityMatch {
  readonly contextId: string;
  readonly strategyId: string;
  readonly tableId: string;
  readonly similarityScore: number;
  readonly historicalOutcomeScore: number;
  readonly blocked: boolean;
}

export interface ContextSimilarityReport {
  readonly currentContextId: string;
  readonly status: ContextSimilarityStatus;
  readonly bestMatch: ContextSimilarityMatch | null;
  readonly matches: readonly ContextSimilarityMatch[];
  readonly referenceCount: number;
  readonly reasons: readonly ContextSimilarityReason[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly paperOnly: true;
}

export interface ContextSimilarityFailure {
  readonly code: 'INVALID_CONTEXT_SIMILARITY_INPUT';
  readonly message: string;
}

export type ContextSimilarityResult =
  | {
      readonly ok: true;
      readonly value: ContextSimilarityReport;
    }
  | {
      readonly ok: false;
      readonly error: ContextSimilarityFailure;
    };

const DEFAULT_POLICY: ContextSimilarityPolicy = Object.freeze({
  minimumHighSimilarity: 0.82,
  minimumModerateSimilarity: 0.62,
  minimumPositiveOutcomeScore: 0.68,
  maximumNegativeOutcomeScore: 0.42,
  productionMoneyAllowed: false,
  liveMoneyAuthorization: false,
});

const vectorKeys: readonly (keyof ContextSimilarityVector)[] = Object.freeze([
  'volatilityScore',
  'consensusScore',
  'confidenceScore',
  'riskScore',
  'operatorScore',
  'strategyReputationScore',
  'tableReputationScore',
  'memoryScore',
]);

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

const clamp01 = (value: number): number => {
  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
};

export class ContextSimilarityEngine {
  private readonly policy: ContextSimilarityPolicy;

  public constructor(policy: ContextSimilarityPolicy = DEFAULT_POLICY) {
    this.policy = Object.freeze({
      minimumHighSimilarity: policy.minimumHighSimilarity,
      minimumModerateSimilarity: policy.minimumModerateSimilarity,
      minimumPositiveOutcomeScore: policy.minimumPositiveOutcomeScore,
      maximumNegativeOutcomeScore: policy.maximumNegativeOutcomeScore,
      productionMoneyAllowed: policy.productionMoneyAllowed,
      liveMoneyAuthorization: policy.liveMoneyAuthorization,
    });
  }

  /**
   * Compares the current institutional context against historical PAPER contexts.
   * Complexity: O(n * d), where d is the fixed vector dimension.
   */
  public evaluate(input: ContextSimilarityInput): ContextSimilarityResult {
    const validationFailure = this.validate(input);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const matches = this.createMatches(input);
    const bestMatch = matches[0] ?? null;
    const reasons = this.resolveReasons(bestMatch, input.references.length);
    const status = this.resolveStatus(bestMatch, input.references.length);

    return {
      ok: true,
      value: Object.freeze({
        currentContextId: input.currentContextId,
        status,
        bestMatch,
        matches: Object.freeze(matches),
        referenceCount: input.references.length,
        reasons: Object.freeze(reasons),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        paperOnly: true,
      }),
    };
  }

  private createMatches(
    input: ContextSimilarityInput,
  ): ContextSimilarityMatch[] {
    const matches: ContextSimilarityMatch[] = [];

    for (const reference of input.references) {
      const similarityScore = this.calculateSimilarity(
        input.currentVector,
        reference.vector,
      );

      if (similarityScore >= this.policy.minimumModerateSimilarity) {
        matches.push(
          Object.freeze({
            contextId: reference.contextId,
            strategyId: reference.strategyId,
            tableId: reference.tableId,
            similarityScore,
            historicalOutcomeScore: reference.historicalOutcomeScore,
            blocked: reference.blocked,
          }),
        );
      }
    }

    matches.sort((left, right) => {
      const similarityDelta = right.similarityScore - left.similarityScore;

      if (similarityDelta !== 0) {
        return similarityDelta;
      }

      const outcomeDelta =
        right.historicalOutcomeScore - left.historicalOutcomeScore;

      if (outcomeDelta !== 0) {
        return outcomeDelta;
      }

      return left.contextId.localeCompare(right.contextId);
    });

    return matches;
  }

  private calculateSimilarity(
    currentVector: ContextSimilarityVector,
    referenceVector: ContextSimilarityVector,
  ): number {
    let distance = 0;

    for (const key of vectorKeys) {
      distance += Math.abs(currentVector[key] - referenceVector[key]);
    }

    const normalizedDistance = distance / vectorKeys.length;

    return round4(clamp01(1 - normalizedDistance));
  }

  private resolveStatus(
    bestMatch: ContextSimilarityMatch | null,
    referenceCount: number,
  ): ContextSimilarityStatus {
    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      return 'SIMILARITY_BLOCKED';
    }

    if (referenceCount === 0 || bestMatch === null) {
      return 'SIMILARITY_NEUTRAL';
    }

    if (bestMatch.blocked) {
      return 'SIMILARITY_BLOCKED';
    }

    if (
      bestMatch.similarityScore >= this.policy.minimumHighSimilarity &&
      bestMatch.historicalOutcomeScore >= this.policy.minimumPositiveOutcomeScore
    ) {
      return 'SIMILARITY_SUPPORTS_PAPER';
    }

    if (bestMatch.historicalOutcomeScore <= this.policy.maximumNegativeOutcomeScore) {
      return 'SIMILARITY_DEGRADED';
    }

    if (bestMatch.similarityScore >= this.policy.minimumModerateSimilarity) {
      return 'SIMILARITY_NEUTRAL';
    }

    return 'SIMILARITY_DEGRADED';
  }

  private resolveReasons(
    bestMatch: ContextSimilarityMatch | null,
    referenceCount: number,
  ): ContextSimilarityReason[] {
    const reasons: ContextSimilarityReason[] = ['PAPER_ONLY_POLICY_LOCK'];

    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      reasons.push('POLICY_LOCK_ACTIVE');
    }

    if (referenceCount === 0) {
      reasons.push('NO_REFERENCE_CONTEXTS');
      return reasons;
    }

    if (bestMatch === null) {
      reasons.push('NO_SIMILAR_CONTEXT');
      reasons.push('LOW_SIMILARITY');
      return reasons;
    }

    if (bestMatch.similarityScore >= this.policy.minimumHighSimilarity) {
      reasons.push('HIGH_SIMILARITY');
    } else if (bestMatch.similarityScore >= this.policy.minimumModerateSimilarity) {
      reasons.push('MODERATE_SIMILARITY');
    } else {
      reasons.push('LOW_SIMILARITY');
    }

    if (bestMatch.blocked) {
      reasons.push('SIMILAR_CONTEXT_BLOCKED');
    }

    if (bestMatch.historicalOutcomeScore >= this.policy.minimumPositiveOutcomeScore) {
      reasons.push('SIMILAR_CONTEXT_POSITIVE');
    }

    if (bestMatch.historicalOutcomeScore <= this.policy.maximumNegativeOutcomeScore) {
      reasons.push('SIMILAR_CONTEXT_NEGATIVE');
    }

    return reasons;
  }

  private validate(input: ContextSimilarityInput): ContextSimilarityFailure | null {
    if (input.currentContextId.trim().length === 0) {
      return {
        code: 'INVALID_CONTEXT_SIMILARITY_INPUT',
        message: 'currentContextId must not be empty',
      };
    }

    if (input.strategyId.trim().length === 0) {
      return {
        code: 'INVALID_CONTEXT_SIMILARITY_INPUT',
        message: 'strategyId must not be empty',
      };
    }

    if (input.tableId.trim().length === 0) {
      return {
        code: 'INVALID_CONTEXT_SIMILARITY_INPUT',
        message: 'tableId must not be empty',
      };
    }

    const vectorFailure = this.validateVector(input.currentVector);

    if (vectorFailure !== null) {
      return vectorFailure;
    }

    for (const reference of input.references) {
      if (reference.contextId.trim().length === 0) {
        return {
          code: 'INVALID_CONTEXT_SIMILARITY_INPUT',
          message: 'reference contextId must not be empty',
        };
      }

      if (reference.strategyId.trim().length === 0) {
        return {
          code: 'INVALID_CONTEXT_SIMILARITY_INPUT',
          message: 'reference strategyId must not be empty',
        };
      }

      if (reference.tableId.trim().length === 0) {
        return {
          code: 'INVALID_CONTEXT_SIMILARITY_INPUT',
          message: 'reference tableId must not be empty',
        };
      }

      if (
        reference.historicalOutcomeScore < 0 ||
        reference.historicalOutcomeScore > 1 ||
        !Number.isFinite(reference.historicalOutcomeScore)
      ) {
        return {
          code: 'INVALID_CONTEXT_SIMILARITY_INPUT',
          message: 'historicalOutcomeScore must be between 0 and 1',
        };
      }

      const referenceVectorFailure = this.validateVector(reference.vector);

      if (referenceVectorFailure !== null) {
        return referenceVectorFailure;
      }
    }

    return null;
  }

  private validateVector(
    vector: ContextSimilarityVector,
  ): ContextSimilarityFailure | null {
    for (const key of vectorKeys) {
      const value = vector[key];

      if (value < 0 || value > 1 || !Number.isFinite(value)) {
        return {
          code: 'INVALID_CONTEXT_SIMILARITY_INPUT',
          message: 'all vector scores must be between 0 and 1',
        };
      }
    }

    return null;
  }
}
