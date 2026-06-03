export type OutcomeCorrelationStatus =
  | 'CORRELATION_SUPPORTS_PAPER'
  | 'CORRELATION_NEUTRAL'
  | 'CORRELATION_DEGRADED'
  | 'CORRELATION_BLOCKED';

export type OutcomeCorrelationReason =
  | 'PAPER_ONLY_POLICY_LOCK'
  | 'LOW_SAMPLE_SIZE'
  | 'POSITIVE_CORRELATION_EVIDENCE'
  | 'NEUTRAL_CORRELATION_EVIDENCE'
  | 'NEGATIVE_CORRELATION_EVIDENCE'
  | 'RISK_CORRELATION_BLOCKER'
  | 'VOLATILITY_CORRELATION_BLOCKER'
  | 'OPERATOR_CORRELATION_BLOCKER'
  | 'POLICY_LOCK_ACTIVE';

export type OutcomeCorrelationFeatureName =
  | 'volatilityScore'
  | 'consensusScore'
  | 'confidenceScore'
  | 'riskScore'
  | 'operatorScore'
  | 'strategyReputationScore'
  | 'tableReputationScore'
  | 'memoryScore'
  | 'similarityScore';

export interface OutcomeCorrelationSample {
  readonly sampleId: string;
  readonly contextId: string;
  readonly strategyId: string;
  readonly tableId: string;
  readonly volatilityScore: number;
  readonly consensusScore: number;
  readonly confidenceScore: number;
  readonly riskScore: number;
  readonly operatorScore: number;
  readonly strategyReputationScore: number;
  readonly tableReputationScore: number;
  readonly memoryScore: number;
  readonly similarityScore: number;
  readonly outcomeScore: number;
  readonly blocked: boolean;
}

export interface OutcomeCorrelationPolicy {
  readonly minimumSamples: number;
  readonly minimumSupportScore: number;
  readonly minimumNeutralScore: number;
  readonly maximumRiskCorrelation: number;
  readonly maximumVolatilityCorrelation: number;
  readonly minimumOperatorCorrelation: number;
  readonly productionMoneyAllowed: boolean;
  readonly liveMoneyAuthorization: boolean;
}

export interface OutcomeFeatureCorrelation {
  readonly featureName: OutcomeCorrelationFeatureName;
  readonly correlationScore: number;
  readonly averageFeatureValue: number;
}

export interface OutcomeCorrelationReport {
  readonly status: OutcomeCorrelationStatus;
  readonly sampleCount: number;
  readonly blockedSampleCount: number;
  readonly averageOutcomeScore: number;
  readonly supportScore: number;
  readonly correlations: readonly OutcomeFeatureCorrelation[];
  readonly reasons: readonly OutcomeCorrelationReason[];
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly paperOnly: true;
}

export interface OutcomeCorrelationFailure {
  readonly code: 'INVALID_OUTCOME_CORRELATION_INPUT';
  readonly message: string;
}

export type OutcomeCorrelationResult =
  | {
      readonly ok: true;
      readonly value: OutcomeCorrelationReport;
    }
  | {
      readonly ok: false;
      readonly error: OutcomeCorrelationFailure;
    };

interface FeatureAccumulator {
  readonly featureName: OutcomeCorrelationFeatureName;
  featureSum: number;
  weightedOutcomeSum: number;
}

const FEATURE_NAMES: readonly OutcomeCorrelationFeatureName[] = Object.freeze([
  'volatilityScore',
  'consensusScore',
  'confidenceScore',
  'riskScore',
  'operatorScore',
  'strategyReputationScore',
  'tableReputationScore',
  'memoryScore',
  'similarityScore',
]);

const DEFAULT_POLICY: OutcomeCorrelationPolicy = Object.freeze({
  minimumSamples: 3,
  minimumSupportScore: 0.68,
  minimumNeutralScore: 0.48,
  maximumRiskCorrelation: 0.52,
  maximumVolatilityCorrelation: 0.58,
  minimumOperatorCorrelation: 0.42,
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

export class OutcomeCorrelationEngine {
  private readonly policy: OutcomeCorrelationPolicy;

  public constructor(policy: OutcomeCorrelationPolicy = DEFAULT_POLICY) {
    this.policy = Object.freeze({
      minimumSamples: policy.minimumSamples,
      minimumSupportScore: policy.minimumSupportScore,
      minimumNeutralScore: policy.minimumNeutralScore,
      maximumRiskCorrelation: policy.maximumRiskCorrelation,
      maximumVolatilityCorrelation: policy.maximumVolatilityCorrelation,
      minimumOperatorCorrelation: policy.minimumOperatorCorrelation,
      productionMoneyAllowed: policy.productionMoneyAllowed,
      liveMoneyAuthorization: policy.liveMoneyAuthorization,
    });
  }

  /**
   * Computes lightweight PAPER outcome correlations in O(n * f),
   * where f is a fixed small feature count.
   */
  public evaluate(
    samples: readonly OutcomeCorrelationSample[],
  ): OutcomeCorrelationResult {
    const validationFailure = this.validate(samples);

    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }

    const correlations = this.calculateCorrelations(samples);
    const averageOutcomeScore = round4(
      safeRatio(
        samples.reduce((sum, sample) => sum + sample.outcomeScore, 0),
        samples.length,
      ),
    );
    const blockedSampleCount = samples.filter((sample) => sample.blocked).length;
    const supportScore = this.calculateSupportScore(
      correlations,
      averageOutcomeScore,
      blockedSampleCount,
      samples.length,
    );
    const reasons = this.resolveReasons(samples.length, correlations, supportScore);
    const status = this.resolveStatus(samples.length, correlations, supportScore);

    return {
      ok: true,
      value: Object.freeze({
        status,
        sampleCount: samples.length,
        blockedSampleCount,
        averageOutcomeScore,
        supportScore,
        correlations: Object.freeze(correlations),
        reasons: Object.freeze(reasons),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        paperOnly: true,
      }),
    };
  }

  private calculateCorrelations(
    samples: readonly OutcomeCorrelationSample[],
  ): OutcomeFeatureCorrelation[] {
    const accumulators = new Map<OutcomeCorrelationFeatureName, FeatureAccumulator>();

    for (const featureName of FEATURE_NAMES) {
      accumulators.set(featureName, {
        featureName,
        featureSum: 0,
        weightedOutcomeSum: 0,
      });
    }

    for (const sample of samples) {
      for (const featureName of FEATURE_NAMES) {
        const accumulator = accumulators.get(featureName);

        if (accumulator === undefined) {
          continue;
        }

        const featureValue = sample[featureName];
        accumulator.featureSum += featureValue;
        accumulator.weightedOutcomeSum += featureValue * sample.outcomeScore;
      }
    }

    const correlations: OutcomeFeatureCorrelation[] = [];

    for (const accumulator of accumulators.values()) {
      const averageFeatureValue = round4(
        safeRatio(accumulator.featureSum, samples.length),
      );
      const correlationScore = round4(
        safeRatio(accumulator.weightedOutcomeSum, accumulator.featureSum),
      );

      correlations.push(
        Object.freeze({
          featureName: accumulator.featureName,
          correlationScore,
          averageFeatureValue,
        }),
      );
    }

    correlations.sort((left, right) => left.featureName.localeCompare(right.featureName));
    return correlations;
  }

  private calculateSupportScore(
    correlations: readonly OutcomeFeatureCorrelation[],
    averageOutcomeScore: number,
    blockedSampleCount: number,
    sampleCount: number,
  ): number {
    const consensus = this.findCorrelation(correlations, 'consensusScore');
    const confidence = this.findCorrelation(correlations, 'confidenceScore');
    const operator = this.findCorrelation(correlations, 'operatorScore');
    const strategy = this.findCorrelation(correlations, 'strategyReputationScore');
    const table = this.findCorrelation(correlations, 'tableReputationScore');
    const memory = this.findCorrelation(correlations, 'memoryScore');
    const similarity = this.findCorrelation(correlations, 'similarityScore');
    const risk = this.findCorrelation(correlations, 'riskScore');
    const volatility = this.findCorrelation(correlations, 'volatilityScore');

    const blockerPenalty = safeRatio(blockedSampleCount, sampleCount) * 0.22;

    return round4(
      clamp01(
        averageOutcomeScore * 0.2 +
          consensus * 0.12 +
          confidence * 0.12 +
          operator * 0.1 +
          strategy * 0.1 +
          table * 0.1 +
          memory * 0.12 +
          similarity * 0.12 +
          (1 - risk) * 0.06 +
          (1 - volatility) * 0.06 -
          blockerPenalty,
      ),
    );
  }

  private findCorrelation(
    correlations: readonly OutcomeFeatureCorrelation[],
    featureName: OutcomeCorrelationFeatureName,
  ): number {
    return (
      correlations.find((correlation) => correlation.featureName === featureName)
        ?.correlationScore ?? 0
    );
  }

  private resolveStatus(
    sampleCount: number,
    correlations: readonly OutcomeFeatureCorrelation[],
    supportScore: number,
  ): OutcomeCorrelationStatus {
    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      return 'CORRELATION_BLOCKED';
    }

    if (sampleCount < this.policy.minimumSamples) {
      return 'CORRELATION_NEUTRAL';
    }

    if (
      this.findCorrelation(correlations, 'riskScore') >
      this.policy.maximumRiskCorrelation
    ) {
      return 'CORRELATION_BLOCKED';
    }

    if (
      this.findCorrelation(correlations, 'volatilityScore') >
      this.policy.maximumVolatilityCorrelation
    ) {
      return 'CORRELATION_BLOCKED';
    }

    if (
      this.findCorrelation(correlations, 'operatorScore') <
      this.policy.minimumOperatorCorrelation
    ) {
      return 'CORRELATION_BLOCKED';
    }

    if (supportScore >= this.policy.minimumSupportScore) {
      return 'CORRELATION_SUPPORTS_PAPER';
    }

    if (supportScore >= this.policy.minimumNeutralScore) {
      return 'CORRELATION_NEUTRAL';
    }

    return 'CORRELATION_DEGRADED';
  }

  private resolveReasons(
    sampleCount: number,
    correlations: readonly OutcomeFeatureCorrelation[],
    supportScore: number,
  ): OutcomeCorrelationReason[] {
    const reasons: OutcomeCorrelationReason[] = ['PAPER_ONLY_POLICY_LOCK'];

    if (this.policy.productionMoneyAllowed || this.policy.liveMoneyAuthorization) {
      reasons.push('POLICY_LOCK_ACTIVE');
    }

    if (sampleCount < this.policy.minimumSamples) {
      reasons.push('LOW_SAMPLE_SIZE');
    }

    if (
      this.findCorrelation(correlations, 'riskScore') >
      this.policy.maximumRiskCorrelation
    ) {
      reasons.push('RISK_CORRELATION_BLOCKER');
    }

    if (
      this.findCorrelation(correlations, 'volatilityScore') >
      this.policy.maximumVolatilityCorrelation
    ) {
      reasons.push('VOLATILITY_CORRELATION_BLOCKER');
    }

    if (
      this.findCorrelation(correlations, 'operatorScore') <
      this.policy.minimumOperatorCorrelation
    ) {
      reasons.push('OPERATOR_CORRELATION_BLOCKER');
    }

    if (supportScore >= this.policy.minimumSupportScore) {
      reasons.push('POSITIVE_CORRELATION_EVIDENCE');
    } else if (supportScore >= this.policy.minimumNeutralScore) {
      reasons.push('NEUTRAL_CORRELATION_EVIDENCE');
    } else {
      reasons.push('NEGATIVE_CORRELATION_EVIDENCE');
    }

    return reasons;
  }

  private validate(
    samples: readonly OutcomeCorrelationSample[],
  ): OutcomeCorrelationFailure | null {
    if (this.policy.minimumSamples <= 0) {
      return {
        code: 'INVALID_OUTCOME_CORRELATION_INPUT',
        message: 'minimumSamples must be greater than zero',
      };
    }

    for (const sample of samples) {
      if (sample.sampleId.trim().length === 0) {
        return {
          code: 'INVALID_OUTCOME_CORRELATION_INPUT',
          message: 'sampleId must not be empty',
        };
      }

      if (sample.contextId.trim().length === 0) {
        return {
          code: 'INVALID_OUTCOME_CORRELATION_INPUT',
          message: 'contextId must not be empty',
        };
      }

      if (sample.strategyId.trim().length === 0) {
        return {
          code: 'INVALID_OUTCOME_CORRELATION_INPUT',
          message: 'strategyId must not be empty',
        };
      }

      if (sample.tableId.trim().length === 0) {
        return {
          code: 'INVALID_OUTCOME_CORRELATION_INPUT',
          message: 'tableId must not be empty',
        };
      }

      for (const featureName of FEATURE_NAMES) {
        const value = sample[featureName];

        if (value < 0 || value > 1 || !Number.isFinite(value)) {
          return {
            code: 'INVALID_OUTCOME_CORRELATION_INPUT',
            message: 'feature scores must be between 0 and 1',
          };
        }
      }

      if (
        sample.outcomeScore < 0 ||
        sample.outcomeScore > 1 ||
        !Number.isFinite(sample.outcomeScore)
      ) {
        return {
          code: 'INVALID_OUTCOME_CORRELATION_INPUT',
          message: 'outcomeScore must be between 0 and 1',
        };
      }
    }

    return null;
  }
}
