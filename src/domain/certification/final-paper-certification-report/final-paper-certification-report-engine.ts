import type { MultiSessionCertificationEvaluation } from '../multi-session';
import type { InstitutionalThresholdCalibrationEvaluation } from '../threshold-calibration';
import type { PaperStabilityStressTestEvaluation } from '../paper-stability-stress-test';

export type FinalPaperCertificationDecision =
  | 'PAPER_COMPATIVEL'
  | 'AGUARDAR'
  | 'NAO_UTILIZAR';

export type FinalPaperCertificationReason =
  | 'FINAL_PAPER_CERTIFICATION_APPROVED'
  | 'FINAL_PAPER_CERTIFICATION_NEEDS_MORE_EVIDENCE'
  | 'FINAL_PAPER_CERTIFICATION_BLOCKED'
  | 'INVALID_FINAL_PAPER_CERTIFICATION_INPUT';

export interface FinalPaperCertificationPolicy {
  readonly minimumConfidenceScore: number;
  readonly minimumRequiredEvidenceItems: number;
  readonly minimumAggregateStabilityScore: number;
  readonly minimumStressPassRatio: number;
  readonly maximumBlockedRatio: number;
  readonly maximumInvalidRatio: number;
}

export interface FinalPaperCertificationInput {
  readonly reportId: string;
  readonly generatedAtIso: string;
  readonly multiSession: MultiSessionCertificationEvaluation;
  readonly thresholdCalibration: InstitutionalThresholdCalibrationEvaluation;
  readonly stressTest: PaperStabilityStressTestEvaluation;
  readonly policy: FinalPaperCertificationPolicy;
}

export interface FinalPaperCertificationMetrics {
  readonly evidenceItems: number;
  readonly paperCompatibleRatio: number;
  readonly blockedRatio: number;
  readonly invalidRatio: number;
  readonly aggregateStabilityScore: number;
  readonly stressPassRatio: number;
  readonly historicalSampleCount: number;
  readonly certificationConfidenceScore: number;
}

export interface FinalPaperCertificationEvidence {
  readonly multiSessionDecision: FinalPaperCertificationDecision;
  readonly thresholdCalibrationDecision: FinalPaperCertificationDecision;
  readonly stressTestDecision: FinalPaperCertificationDecision;
  readonly recommendationSnapshot: {
    readonly minimumPaperCompatibleBatchRatio: number;
    readonly maximumBlockedBatchRatio: number;
    readonly maximumInvalidBatchRatio: number;
    readonly minimumAggregateStabilityScore: number;
  };
}

export interface FinalPaperCertificationEvaluation {
  readonly decision: FinalPaperCertificationDecision;
  readonly reason: FinalPaperCertificationReason;
  readonly reportId: string;
  readonly generatedAtIso: string;
  readonly metrics: FinalPaperCertificationMetrics;
  readonly evidence: FinalPaperCertificationEvidence;
  readonly productionMoneyAllowed: false;
  readonly activeSessionMutationAllowed: false;
  readonly explanation: string;
}

export type FinalPaperCertificationResult =
  | {
      readonly ok: true;
      readonly value: FinalPaperCertificationEvaluation;
    }
  | {
      readonly ok: false;
      readonly error: FinalPaperCertificationEvaluation;
    };

const EMPTY_METRICS: FinalPaperCertificationMetrics = {
  evidenceItems: 0,
  paperCompatibleRatio: 0,
  blockedRatio: 0,
  invalidRatio: 0,
  aggregateStabilityScore: 0,
  stressPassRatio: 0,
  historicalSampleCount: 0,
  certificationConfidenceScore: 0,
};

const EMPTY_EVIDENCE: FinalPaperCertificationEvidence = {
  multiSessionDecision: 'NAO_UTILIZAR',
  thresholdCalibrationDecision: 'NAO_UTILIZAR',
  stressTestDecision: 'NAO_UTILIZAR',
  recommendationSnapshot: {
    minimumPaperCompatibleBatchRatio: 0,
    maximumBlockedBatchRatio: 0,
    maximumInvalidBatchRatio: 0,
    minimumAggregateStabilityScore: 0,
  },
};

/**
 * FinalPaperCertificationReportEngine consolidates the institutional PAPER
 * certification chain into one auditable final report.
 *
 * It does not mutate active sessions and never authorizes production money.
 *
 * Complexity:
 * - Time: O(1), because it consolidates already aggregated evaluations.
 * - Space: O(1), excluding the immutable returned report object.
 */
export class FinalPaperCertificationReportEngine {
  public evaluate(
    input: FinalPaperCertificationInput,
  ): FinalPaperCertificationResult {
    const invalidEvaluation = this.validate(input);

    if (invalidEvaluation !== null) {
      return {
        ok: false,
        error: invalidEvaluation,
      };
    }

    const metrics = this.computeMetrics(input);
    const evidence = this.computeEvidence(input);

    if (
      metrics.evidenceItems < input.policy.minimumRequiredEvidenceItems ||
      input.multiSession.decision === 'AGUARDAR' ||
      input.thresholdCalibration.decision === 'AGUARDAR' ||
      input.stressTest.decision === 'AGUARDAR'
    ) {
      return {
        ok: true,
        value: {
          decision: 'AGUARDAR',
          reason: 'FINAL_PAPER_CERTIFICATION_NEEDS_MORE_EVIDENCE',
          reportId: input.reportId,
          generatedAtIso: input.generatedAtIso,
          metrics,
          evidence,
          productionMoneyAllowed: false,
          activeSessionMutationAllowed: false,
          explanation:
            'A certificação PAPER final precisa de mais evidências institucionais antes de aprovação.',
        },
      };
    }

    const blocked =
      input.multiSession.decision === 'NAO_UTILIZAR' ||
      input.thresholdCalibration.decision === 'NAO_UTILIZAR' ||
      input.stressTest.decision === 'NAO_UTILIZAR' ||
      metrics.certificationConfidenceScore <
        input.policy.minimumConfidenceScore ||
      metrics.aggregateStabilityScore <
        input.policy.minimumAggregateStabilityScore ||
      metrics.stressPassRatio < input.policy.minimumStressPassRatio ||
      metrics.blockedRatio > input.policy.maximumBlockedRatio ||
      metrics.invalidRatio > input.policy.maximumInvalidRatio;

    if (blocked) {
      return {
        ok: true,
        value: {
          decision: 'NAO_UTILIZAR',
          reason: 'FINAL_PAPER_CERTIFICATION_BLOCKED',
          reportId: input.reportId,
          generatedAtIso: input.generatedAtIso,
          metrics,
          evidence,
          productionMoneyAllowed: false,
          activeSessionMutationAllowed: false,
          explanation:
            'A certificação PAPER final detectou risco institucional ou evidência insuficiente para aprovação operacional.',
        },
      };
    }

    return {
      ok: true,
      value: {
        decision: 'PAPER_COMPATIVEL',
        reason: 'FINAL_PAPER_CERTIFICATION_APPROVED',
        reportId: input.reportId,
        generatedAtIso: input.generatedAtIso,
        metrics,
        evidence,
        productionMoneyAllowed: false,
        activeSessionMutationAllowed: false,
        explanation:
          'A certificação PAPER final consolidou evidências suficientes de compatibilidade, estabilidade e segurança institucional.',
      },
    };
  }

  private validate(
    input: FinalPaperCertificationInput,
  ): FinalPaperCertificationEvaluation | null {
    const invalid =
      input.reportId.trim().length === 0 ||
      Number.isNaN(Date.parse(input.generatedAtIso)) ||
      !this.validPolicy(input.policy) ||
      input.multiSession.productionMoneyAllowed !== false ||
      input.thresholdCalibration.productionMoneyAllowed !== false ||
      input.thresholdCalibration.activeSessionMutationAllowed !== false ||
      input.stressTest.productionMoneyAllowed !== false ||
      input.stressTest.activeSessionMutationAllowed !== false ||
      !this.validRatio(input.multiSession.metrics.paperCompatibleBatchRatio) ||
      !this.validRatio(input.multiSession.metrics.blockedBatchRatio) ||
      !this.validRatio(input.multiSession.metrics.invalidBatchRatio) ||
      !this.validRatio(input.multiSession.metrics.aggregateStabilityScore) ||
      !this.validRatio(
        input.thresholdCalibration.metrics.averageAggregateStabilityScore,
      ) ||
      !this.validRatio(input.stressTest.metrics.passRatio) ||
      !this.validRatio(input.stressTest.metrics.invalidRatio) ||
      !this.validRatio(input.stressTest.metrics.averageStabilityScore);

    if (!invalid) {
      return null;
    }

    return {
      decision: 'NAO_UTILIZAR',
      reason: 'INVALID_FINAL_PAPER_CERTIFICATION_INPUT',
      reportId: input.reportId,
      generatedAtIso: input.generatedAtIso,
      metrics: EMPTY_METRICS,
      evidence: EMPTY_EVIDENCE,
      productionMoneyAllowed: false,
      activeSessionMutationAllowed: false,
      explanation:
        'Entrada inválida para relatório final PAPER. O sistema bloqueia a certificação por segurança institucional.',
    };
  }

  private validPolicy(policy: FinalPaperCertificationPolicy): boolean {
    return (
      Number.isFinite(policy.minimumConfidenceScore) &&
      Number.isFinite(policy.minimumRequiredEvidenceItems) &&
      Number.isFinite(policy.minimumAggregateStabilityScore) &&
      Number.isFinite(policy.minimumStressPassRatio) &&
      Number.isFinite(policy.maximumBlockedRatio) &&
      Number.isFinite(policy.maximumInvalidRatio) &&
      this.validRatio(policy.minimumConfidenceScore) &&
      policy.minimumRequiredEvidenceItems > 0 &&
      this.validRatio(policy.minimumAggregateStabilityScore) &&
      this.validRatio(policy.minimumStressPassRatio) &&
      this.validRatio(policy.maximumBlockedRatio) &&
      this.validRatio(policy.maximumInvalidRatio)
    );
  }

  private validRatio(value: number): boolean {
    return Number.isFinite(value) && value >= 0 && value <= 1;
  }

  private computeMetrics(
    input: FinalPaperCertificationInput,
  ): FinalPaperCertificationMetrics {
    const evidenceItems = 3;
    const paperCompatibleSignals = [
      input.multiSession.decision,
      input.thresholdCalibration.decision,
      input.stressTest.decision,
    ].filter((decision) => decision === 'PAPER_COMPATIVEL').length;

    const paperCompatibleRatio = paperCompatibleSignals / evidenceItems;
    const blockedRatio = input.multiSession.metrics.blockedBatchRatio;
    const invalidRatio = Math.max(
      input.multiSession.metrics.invalidBatchRatio,
      input.stressTest.metrics.invalidRatio,
    );

    const aggregateStabilityScore = Math.min(
      input.multiSession.metrics.aggregateStabilityScore,
      input.thresholdCalibration.metrics.averageAggregateStabilityScore,
      input.stressTest.metrics.averageStabilityScore,
    );

    const stressPassRatio = input.stressTest.metrics.passRatio;
    const historicalSampleCount =
      input.thresholdCalibration.metrics.totalSamples;

    const riskPenalty =
      (blockedRatio +
        invalidRatio +
        (1 - aggregateStabilityScore) +
        (1 - stressPassRatio)) /
      4;

    const certificationConfidenceScore = Math.max(
      0,
      Math.min(1, paperCompatibleRatio * (1 - riskPenalty)),
    );

    return {
      evidenceItems,
      paperCompatibleRatio,
      blockedRatio,
      invalidRatio,
      aggregateStabilityScore,
      stressPassRatio,
      historicalSampleCount,
      certificationConfidenceScore,
    };
  }

  private computeEvidence(
    input: FinalPaperCertificationInput,
  ): FinalPaperCertificationEvidence {
    return {
      multiSessionDecision: input.multiSession.decision,
      thresholdCalibrationDecision: input.thresholdCalibration.decision,
      stressTestDecision: input.stressTest.decision,
      recommendationSnapshot: {
        minimumPaperCompatibleBatchRatio:
          input.thresholdCalibration.recommendation
            .minimumPaperCompatibleBatchRatio,
        maximumBlockedBatchRatio:
          input.thresholdCalibration.recommendation.maximumBlockedBatchRatio,
        maximumInvalidBatchRatio:
          input.thresholdCalibration.recommendation.maximumInvalidBatchRatio,
        minimumAggregateStabilityScore:
          input.thresholdCalibration.recommendation
            .minimumAggregateStabilityScore,
      },
    };
  }
}
