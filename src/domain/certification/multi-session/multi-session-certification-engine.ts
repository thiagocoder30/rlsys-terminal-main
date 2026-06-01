import {
  PaperRuntimeCertificationHarness,
  type PaperRuntimeCertificationDecision,
  type PaperRuntimeCertificationEvaluation,
  type PaperRuntimeCertificationPolicy,
  type PaperRuntimeCertificationSession,
} from '../paper-runtime';

export type MultiSessionCertificationDecision =
  | 'PAPER_COMPATIVEL'
  | 'AGUARDAR'
  | 'NAO_UTILIZAR';

export type MultiSessionCertificationReason =
  | 'MULTI_SESSION_CERTIFIED'
  | 'MULTI_SESSION_NEEDS_MORE_EVIDENCE'
  | 'MULTI_SESSION_STABILITY_RISK'
  | 'INVALID_MULTI_SESSION_CERTIFICATION_INPUT';

export interface MultiSessionCertificationPolicy {
  readonly minimumCertificationBatches: number;
  readonly minimumPaperCompatibleBatchRatio: number;
  readonly maximumBlockedBatchRatio: number;
  readonly maximumInvalidBatchRatio: number;
  readonly minimumAggregateStabilityScore: number;
  readonly paperRuntimePolicy: PaperRuntimeCertificationPolicy;
}

export interface MultiSessionCertificationBatch {
  readonly certificationId: string;
  readonly label: string;
  readonly sessions: readonly PaperRuntimeCertificationSession[];
}

export interface MultiSessionCertificationInput {
  readonly batches: readonly MultiSessionCertificationBatch[];
  readonly policy: MultiSessionCertificationPolicy;
}

export interface MultiSessionCertificationBatchEvaluation {
  readonly certificationId: string;
  readonly label: string;
  readonly decision: PaperRuntimeCertificationDecision;
  readonly evaluation: PaperRuntimeCertificationEvaluation;
}

export interface MultiSessionCertificationMetrics {
  readonly totalBatches: number;
  readonly paperCompatibleBatches: number;
  readonly waitBatches: number;
  readonly blockedBatches: number;
  readonly invalidBatches: number;
  readonly paperCompatibleBatchRatio: number;
  readonly waitBatchRatio: number;
  readonly blockedBatchRatio: number;
  readonly invalidBatchRatio: number;
  readonly aggregateStabilityScore: number;
}

export interface MultiSessionCertificationEvaluation {
  readonly decision: MultiSessionCertificationDecision;
  readonly reason: MultiSessionCertificationReason;
  readonly metrics: MultiSessionCertificationMetrics;
  readonly batchEvaluations: readonly MultiSessionCertificationBatchEvaluation[];
  readonly productionMoneyAllowed: false;
  readonly explanation: string;
}

export type MultiSessionCertificationResult =
  | {
      readonly ok: true;
      readonly value: MultiSessionCertificationEvaluation;
    }
  | {
      readonly ok: false;
      readonly error: MultiSessionCertificationEvaluation;
    };

const EMPTY_METRICS: MultiSessionCertificationMetrics = {
  totalBatches: 0,
  paperCompatibleBatches: 0,
  waitBatches: 0,
  blockedBatches: 0,
  invalidBatches: 0,
  paperCompatibleBatchRatio: 0,
  waitBatchRatio: 0,
  blockedBatchRatio: 0,
  invalidBatchRatio: 0,
  aggregateStabilityScore: 0,
};

/**
 * MultiSessionCertificationEngine consolidates multiple PAPER certification
 * batches using the Sprint 171 harness as a deterministic strategy dependency.
 *
 * Complexity:
 * - Time: O(b + s), where b = batches and s = total sessions across batches.
 * - Space: O(b), only one evaluation per batch is retained for explainability.
 *
 * Safety:
 * - Never authorizes live or production money.
 * - Keeps productionMoneyAllowed permanently false.
 */
export class MultiSessionCertificationEngine {
  public constructor(
    private readonly paperHarness: PaperRuntimeCertificationHarness =
      new PaperRuntimeCertificationHarness(),
  ) {}

  public evaluate(
    input: MultiSessionCertificationInput,
  ): MultiSessionCertificationResult {
    const invalidEvaluation = this.validate(input);

    if (invalidEvaluation !== null) {
      return {
        ok: false,
        error: invalidEvaluation,
      };
    }

    const batchEvaluations: MultiSessionCertificationBatchEvaluation[] = [];

    let paperCompatibleBatches = 0;
    let waitBatches = 0;
    let blockedBatches = 0;
    let invalidBatches = 0;
    let stabilityScoreSum = 0;

    for (const batch of input.batches) {
      const batchResult = this.paperHarness.evaluate({
        sessions: batch.sessions,
        policy: input.policy.paperRuntimePolicy,
      });

      const evaluation = batchResult.ok ? batchResult.value : batchResult.error;

      if (evaluation.decision === 'PAPER_COMPATIVEL') {
        paperCompatibleBatches += 1;
      } else if (evaluation.decision === 'AGUARDAR') {
        waitBatches += 1;
      } else {
        blockedBatches += 1;
      }

      if (!batchResult.ok) {
        invalidBatches += 1;
      }

      stabilityScoreSum += evaluation.metrics.stabilityScore;

      batchEvaluations.push({
        certificationId: batch.certificationId,
        label: batch.label,
        decision: evaluation.decision,
        evaluation,
      });
    }

    const totalBatches = input.batches.length;
    const safeTotalBatches = totalBatches === 0 ? 1 : totalBatches;

    const metrics: MultiSessionCertificationMetrics = {
      totalBatches,
      paperCompatibleBatches,
      waitBatches,
      blockedBatches,
      invalidBatches,
      paperCompatibleBatchRatio: paperCompatibleBatches / safeTotalBatches,
      waitBatchRatio: waitBatches / safeTotalBatches,
      blockedBatchRatio: blockedBatches / safeTotalBatches,
      invalidBatchRatio: invalidBatches / safeTotalBatches,
      aggregateStabilityScore: stabilityScoreSum / safeTotalBatches,
    };

    if (totalBatches < input.policy.minimumCertificationBatches) {
      return {
        ok: true,
        value: {
          decision: 'AGUARDAR',
          reason: 'MULTI_SESSION_NEEDS_MORE_EVIDENCE',
          metrics,
          batchEvaluations,
          productionMoneyAllowed: false,
          explanation:
            'A certificação multi-sessão ainda precisa de mais lotes PAPER para formar evidência institucional suficiente.',
        },
      };
    }

    const hasStabilityRisk =
      metrics.paperCompatibleBatchRatio <
        input.policy.minimumPaperCompatibleBatchRatio ||
      metrics.blockedBatchRatio > input.policy.maximumBlockedBatchRatio ||
      metrics.invalidBatchRatio > input.policy.maximumInvalidBatchRatio ||
      metrics.aggregateStabilityScore <
        input.policy.minimumAggregateStabilityScore;

    if (hasStabilityRisk) {
      return {
        ok: true,
        value: {
          decision: 'NAO_UTILIZAR',
          reason: 'MULTI_SESSION_STABILITY_RISK',
          metrics,
          batchEvaluations,
          productionMoneyAllowed: false,
          explanation:
            'A certificação multi-sessão detectou instabilidade agregada, bloqueios ou entradas inválidas acima do limite institucional.',
        },
      };
    }

    return {
      ok: true,
      value: {
        decision: 'PAPER_COMPATIVEL',
        reason: 'MULTI_SESSION_CERTIFIED',
        metrics,
        batchEvaluations,
        productionMoneyAllowed: false,
        explanation:
          'Os lotes PAPER avaliados atendem aos critérios institucionais mínimos de estabilidade multi-sessão.',
      },
    };
  }

  private validate(
    input: MultiSessionCertificationInput,
  ): MultiSessionCertificationEvaluation | null {
    const invalidPolicy =
      !Number.isFinite(input.policy.minimumCertificationBatches) ||
      !Number.isFinite(input.policy.minimumPaperCompatibleBatchRatio) ||
      !Number.isFinite(input.policy.maximumBlockedBatchRatio) ||
      !Number.isFinite(input.policy.maximumInvalidBatchRatio) ||
      !Number.isFinite(input.policy.minimumAggregateStabilityScore) ||
      input.policy.minimumCertificationBatches <= 0 ||
      input.policy.minimumPaperCompatibleBatchRatio < 0 ||
      input.policy.minimumPaperCompatibleBatchRatio > 1 ||
      input.policy.maximumBlockedBatchRatio < 0 ||
      input.policy.maximumBlockedBatchRatio > 1 ||
      input.policy.maximumInvalidBatchRatio < 0 ||
      input.policy.maximumInvalidBatchRatio > 1 ||
      input.policy.minimumAggregateStabilityScore < 0 ||
      input.policy.minimumAggregateStabilityScore > 1;

    const invalidBatches =
      !Array.isArray(input.batches) ||
      input.batches.some((batch) => !this.isValidBatch(batch));

    if (!invalidPolicy && !invalidBatches) {
      return null;
    }

    return {
      decision: 'NAO_UTILIZAR',
      reason: 'INVALID_MULTI_SESSION_CERTIFICATION_INPUT',
      metrics: EMPTY_METRICS,
      batchEvaluations: [],
      productionMoneyAllowed: false,
      explanation:
        'Entrada inválida para certificação multi-sessão. O sistema bloqueia a certificação por segurança institucional.',
    };
  }

  private isValidBatch(batch: MultiSessionCertificationBatch): boolean {
    return (
      batch.certificationId.trim().length > 0 &&
      batch.label.trim().length > 0 &&
      Array.isArray(batch.sessions)
    );
  }
}
