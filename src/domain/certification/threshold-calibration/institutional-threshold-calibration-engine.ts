import type { MultiSessionCertificationEvaluation } from '../multi-session';

export type InstitutionalThresholdCalibrationDecision =
  | 'PAPER_COMPATIVEL'
  | 'AGUARDAR'
  | 'NAO_UTILIZAR';

export type InstitutionalThresholdCalibrationReason =
  | 'THRESHOLDS_CALIBRATED'
  | 'THRESHOLD_CALIBRATION_NEEDS_MORE_EVIDENCE'
  | 'THRESHOLD_CALIBRATION_STABILITY_RISK'
  | 'INVALID_THRESHOLD_CALIBRATION_INPUT';

export interface InstitutionalThresholdBounds {
  readonly minimumAllowedPaperCompatibleBatchRatio: number;
  readonly maximumAllowedPaperCompatibleBatchRatio: number;
  readonly minimumAllowedBlockedBatchRatio: number;
  readonly maximumAllowedBlockedBatchRatio: number;
  readonly minimumAllowedInvalidBatchRatio: number;
  readonly maximumAllowedInvalidBatchRatio: number;
  readonly minimumAllowedAggregateStabilityScore: number;
  readonly maximumAllowedAggregateStabilityScore: number;
}

export interface InstitutionalThresholdCalibrationPolicy {
  readonly minimumHistoricalEvaluations: number;
  readonly minimumObservedPaperCompatibleBatchRatio: number;
  readonly maximumObservedBlockedBatchRatio: number;
  readonly maximumObservedInvalidBatchRatio: number;
  readonly minimumObservedAggregateStabilityScore: number;
  readonly safetyMarginRatio: number;
  readonly bounds: InstitutionalThresholdBounds;
}

export interface InstitutionalThresholdCalibrationSample {
  readonly calibrationId: string;
  readonly label: string;
  readonly evaluation: MultiSessionCertificationEvaluation;
}

export interface InstitutionalThresholdCalibrationInput {
  readonly samples: readonly InstitutionalThresholdCalibrationSample[];
  readonly policy: InstitutionalThresholdCalibrationPolicy;
}

export interface InstitutionalThresholdRecommendation {
  readonly minimumPaperCompatibleBatchRatio: number;
  readonly maximumBlockedBatchRatio: number;
  readonly maximumInvalidBatchRatio: number;
  readonly minimumAggregateStabilityScore: number;
}

export interface InstitutionalThresholdCalibrationMetrics {
  readonly totalSamples: number;
  readonly paperCompatibleSamples: number;
  readonly waitSamples: number;
  readonly blockedSamples: number;
  readonly averagePaperCompatibleBatchRatio: number;
  readonly averageBlockedBatchRatio: number;
  readonly averageInvalidBatchRatio: number;
  readonly averageAggregateStabilityScore: number;
}

export interface InstitutionalThresholdCalibrationEvaluation {
  readonly decision: InstitutionalThresholdCalibrationDecision;
  readonly reason: InstitutionalThresholdCalibrationReason;
  readonly metrics: InstitutionalThresholdCalibrationMetrics;
  readonly recommendation: InstitutionalThresholdRecommendation;
  readonly productionMoneyAllowed: false;
  readonly activeSessionMutationAllowed: false;
  readonly explanation: string;
}

export type InstitutionalThresholdCalibrationResult =
  | {
      readonly ok: true;
      readonly value: InstitutionalThresholdCalibrationEvaluation;
    }
  | {
      readonly ok: false;
      readonly error: InstitutionalThresholdCalibrationEvaluation;
    };

const EMPTY_METRICS: InstitutionalThresholdCalibrationMetrics = {
  totalSamples: 0,
  paperCompatibleSamples: 0,
  waitSamples: 0,
  blockedSamples: 0,
  averagePaperCompatibleBatchRatio: 0,
  averageBlockedBatchRatio: 0,
  averageInvalidBatchRatio: 0,
  averageAggregateStabilityScore: 0,
};

const EMPTY_RECOMMENDATION: InstitutionalThresholdRecommendation = {
  minimumPaperCompatibleBatchRatio: 0,
  maximumBlockedBatchRatio: 0,
  maximumInvalidBatchRatio: 0,
  minimumAggregateStabilityScore: 0,
};

/**
 * InstitutionalThresholdCalibrationEngine performs offline calibration over
 * completed PAPER certification history.
 *
 * It is intentionally isolated from active session runtime state:
 * - no active session mutation;
 * - no production money permission;
 * - no automatic risk expansion.
 *
 * Complexity:
 * - Time: O(n), where n = historical certification samples.
 * - Space: O(1), excluding the returned immutable evaluation object.
 */
export class InstitutionalThresholdCalibrationEngine {
  public evaluate(
    input: InstitutionalThresholdCalibrationInput,
  ): InstitutionalThresholdCalibrationResult {
    const invalidEvaluation = this.validate(input);

    if (invalidEvaluation !== null) {
      return {
        ok: false,
        error: invalidEvaluation,
      };
    }

    const metrics = this.computeMetrics(input.samples);
    const recommendation = this.computeRecommendation(metrics, input.policy);

    if (metrics.totalSamples < input.policy.minimumHistoricalEvaluations) {
      return {
        ok: true,
        value: {
          decision: 'AGUARDAR',
          reason: 'THRESHOLD_CALIBRATION_NEEDS_MORE_EVIDENCE',
          metrics,
          recommendation,
          productionMoneyAllowed: false,
          activeSessionMutationAllowed: false,
          explanation:
            'A calibração institucional precisa de mais certificações PAPER históricas antes de recomendar thresholds estáveis.',
        },
      };
    }

    const hasStabilityRisk =
      metrics.averagePaperCompatibleBatchRatio <
        input.policy.minimumObservedPaperCompatibleBatchRatio ||
      metrics.averageBlockedBatchRatio >
        input.policy.maximumObservedBlockedBatchRatio ||
      metrics.averageInvalidBatchRatio >
        input.policy.maximumObservedInvalidBatchRatio ||
      metrics.averageAggregateStabilityScore <
        input.policy.minimumObservedAggregateStabilityScore;

    if (hasStabilityRisk) {
      return {
        ok: true,
        value: {
          decision: 'NAO_UTILIZAR',
          reason: 'THRESHOLD_CALIBRATION_STABILITY_RISK',
          metrics,
          recommendation,
          productionMoneyAllowed: false,
          activeSessionMutationAllowed: false,
          explanation:
            'A calibração institucional detectou histórico PAPER instável. Os thresholds calculados não devem ser utilizados em runtime ativo.',
        },
      };
    }

    return {
      ok: true,
      value: {
        decision: 'PAPER_COMPATIVEL',
        reason: 'THRESHOLDS_CALIBRATED',
        metrics,
        recommendation,
        productionMoneyAllowed: false,
        activeSessionMutationAllowed: false,
        explanation:
          'Os thresholds institucionais foram calibrados offline com base em histórico PAPER suficiente e estável.',
      },
    };
  }

  private validate(
    input: InstitutionalThresholdCalibrationInput,
  ): InstitutionalThresholdCalibrationEvaluation | null {
    const invalidPolicy =
      !Number.isFinite(input.policy.minimumHistoricalEvaluations) ||
      !Number.isFinite(input.policy.minimumObservedPaperCompatibleBatchRatio) ||
      !Number.isFinite(input.policy.maximumObservedBlockedBatchRatio) ||
      !Number.isFinite(input.policy.maximumObservedInvalidBatchRatio) ||
      !Number.isFinite(input.policy.minimumObservedAggregateStabilityScore) ||
      !Number.isFinite(input.policy.safetyMarginRatio) ||
      input.policy.minimumHistoricalEvaluations <= 0 ||
      input.policy.minimumObservedPaperCompatibleBatchRatio < 0 ||
      input.policy.minimumObservedPaperCompatibleBatchRatio > 1 ||
      input.policy.maximumObservedBlockedBatchRatio < 0 ||
      input.policy.maximumObservedBlockedBatchRatio > 1 ||
      input.policy.maximumObservedInvalidBatchRatio < 0 ||
      input.policy.maximumObservedInvalidBatchRatio > 1 ||
      input.policy.minimumObservedAggregateStabilityScore < 0 ||
      input.policy.minimumObservedAggregateStabilityScore > 1 ||
      input.policy.safetyMarginRatio < 0 ||
      input.policy.safetyMarginRatio > 0.5 ||
      !this.isValidBounds(input.policy.bounds);

    const invalidSamples =
      !Array.isArray(input.samples) ||
      input.samples.some((sample) => !this.isValidSample(sample));

    if (!invalidPolicy && !invalidSamples) {
      return null;
    }

    return {
      decision: 'NAO_UTILIZAR',
      reason: 'INVALID_THRESHOLD_CALIBRATION_INPUT',
      metrics: EMPTY_METRICS,
      recommendation: EMPTY_RECOMMENDATION,
      productionMoneyAllowed: false,
      activeSessionMutationAllowed: false,
      explanation:
        'Entrada inválida para calibração institucional. O sistema bloqueia a recomendação por segurança.',
    };
  }

  private isValidBounds(bounds: InstitutionalThresholdBounds): boolean {
    return (
      Number.isFinite(bounds.minimumAllowedPaperCompatibleBatchRatio) &&
      Number.isFinite(bounds.maximumAllowedPaperCompatibleBatchRatio) &&
      Number.isFinite(bounds.minimumAllowedBlockedBatchRatio) &&
      Number.isFinite(bounds.maximumAllowedBlockedBatchRatio) &&
      Number.isFinite(bounds.minimumAllowedInvalidBatchRatio) &&
      Number.isFinite(bounds.maximumAllowedInvalidBatchRatio) &&
      Number.isFinite(bounds.minimumAllowedAggregateStabilityScore) &&
      Number.isFinite(bounds.maximumAllowedAggregateStabilityScore) &&
      bounds.minimumAllowedPaperCompatibleBatchRatio >= 0 &&
      bounds.maximumAllowedPaperCompatibleBatchRatio <= 1 &&
      bounds.minimumAllowedPaperCompatibleBatchRatio <=
        bounds.maximumAllowedPaperCompatibleBatchRatio &&
      bounds.minimumAllowedBlockedBatchRatio >= 0 &&
      bounds.maximumAllowedBlockedBatchRatio <= 1 &&
      bounds.minimumAllowedBlockedBatchRatio <=
        bounds.maximumAllowedBlockedBatchRatio &&
      bounds.minimumAllowedInvalidBatchRatio >= 0 &&
      bounds.maximumAllowedInvalidBatchRatio <= 1 &&
      bounds.minimumAllowedInvalidBatchRatio <=
        bounds.maximumAllowedInvalidBatchRatio &&
      bounds.minimumAllowedAggregateStabilityScore >= 0 &&
      bounds.maximumAllowedAggregateStabilityScore <= 1 &&
      bounds.minimumAllowedAggregateStabilityScore <=
        bounds.maximumAllowedAggregateStabilityScore
    );
  }

  private isValidSample(sample: InstitutionalThresholdCalibrationSample): boolean {
    return (
      sample.calibrationId.trim().length > 0 &&
      sample.label.trim().length > 0 &&
      this.isValidEvaluation(sample.evaluation)
    );
  }

  private isValidEvaluation(evaluation: MultiSessionCertificationEvaluation): boolean {
    return (
      Number.isFinite(evaluation.metrics.paperCompatibleBatchRatio) &&
      Number.isFinite(evaluation.metrics.blockedBatchRatio) &&
      Number.isFinite(evaluation.metrics.invalidBatchRatio) &&
      Number.isFinite(evaluation.metrics.aggregateStabilityScore) &&
      evaluation.metrics.paperCompatibleBatchRatio >= 0 &&
      evaluation.metrics.paperCompatibleBatchRatio <= 1 &&
      evaluation.metrics.blockedBatchRatio >= 0 &&
      evaluation.metrics.blockedBatchRatio <= 1 &&
      evaluation.metrics.invalidBatchRatio >= 0 &&
      evaluation.metrics.invalidBatchRatio <= 1 &&
      evaluation.metrics.aggregateStabilityScore >= 0 &&
      evaluation.metrics.aggregateStabilityScore <= 1 &&
      evaluation.productionMoneyAllowed === false
    );
  }

  private computeMetrics(
    samples: readonly InstitutionalThresholdCalibrationSample[],
  ): InstitutionalThresholdCalibrationMetrics {
    let paperCompatibleSamples = 0;
    let waitSamples = 0;
    let blockedSamples = 0;
    let paperCompatibleRatioSum = 0;
    let blockedRatioSum = 0;
    let invalidRatioSum = 0;
    let stabilityScoreSum = 0;

    for (const sample of samples) {
      if (sample.evaluation.decision === 'PAPER_COMPATIVEL') {
        paperCompatibleSamples += 1;
      } else if (sample.evaluation.decision === 'AGUARDAR') {
        waitSamples += 1;
      } else {
        blockedSamples += 1;
      }

      paperCompatibleRatioSum +=
        sample.evaluation.metrics.paperCompatibleBatchRatio;
      blockedRatioSum += sample.evaluation.metrics.blockedBatchRatio;
      invalidRatioSum += sample.evaluation.metrics.invalidBatchRatio;
      stabilityScoreSum += sample.evaluation.metrics.aggregateStabilityScore;
    }

    const totalSamples = samples.length;
    const safeTotalSamples = totalSamples === 0 ? 1 : totalSamples;

    return {
      totalSamples,
      paperCompatibleSamples,
      waitSamples,
      blockedSamples,
      averagePaperCompatibleBatchRatio:
        paperCompatibleRatioSum / safeTotalSamples,
      averageBlockedBatchRatio: blockedRatioSum / safeTotalSamples,
      averageInvalidBatchRatio: invalidRatioSum / safeTotalSamples,
      averageAggregateStabilityScore: stabilityScoreSum / safeTotalSamples,
    };
  }

  private computeRecommendation(
    metrics: InstitutionalThresholdCalibrationMetrics,
    policy: InstitutionalThresholdCalibrationPolicy,
  ): InstitutionalThresholdRecommendation {
    const margin = policy.safetyMarginRatio;

    return {
      minimumPaperCompatibleBatchRatio: this.clamp(
        metrics.averagePaperCompatibleBatchRatio * (1 - margin),
        policy.bounds.minimumAllowedPaperCompatibleBatchRatio,
        policy.bounds.maximumAllowedPaperCompatibleBatchRatio,
      ),
      maximumBlockedBatchRatio: this.clamp(
        metrics.averageBlockedBatchRatio * (1 + margin),
        policy.bounds.minimumAllowedBlockedBatchRatio,
        policy.bounds.maximumAllowedBlockedBatchRatio,
      ),
      maximumInvalidBatchRatio: this.clamp(
        metrics.averageInvalidBatchRatio * (1 + margin),
        policy.bounds.minimumAllowedInvalidBatchRatio,
        policy.bounds.maximumAllowedInvalidBatchRatio,
      ),
      minimumAggregateStabilityScore: this.clamp(
        metrics.averageAggregateStabilityScore * (1 - margin),
        policy.bounds.minimumAllowedAggregateStabilityScore,
        policy.bounds.maximumAllowedAggregateStabilityScore,
      ),
    };
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
  }
}
