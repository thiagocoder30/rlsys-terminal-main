import type {
  OperatorDecisionPresentationReport,
  OperatorPresentationStatus,
  OperatorRiskLevel,
} from './OperatorDecisionPresentationAdapter.js';

export type PerSpinSessionRecommendationTrend =
  | 'SESSION_FAVORABLE_DOMINANT'
  | 'SESSION_WAIT_DOMINANT'
  | 'SESSION_NO_USE_DOMINANT'
  | 'SESSION_MIXED'
  | 'SESSION_EMPTY';

export interface PerSpinRecommendationRecord {
  readonly spinIndex: number;
  readonly strategyName: string;
  readonly status: OperatorPresentationStatus;
  readonly confidencePercent: number;
  readonly riskLevel: OperatorRiskLevel;
  readonly actionLabel: OperatorDecisionPresentationReport['actionLabel'];
  readonly headline: string;
  readonly explanation: string;
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
  readonly blockers: readonly string[];
}

export interface PerSpinRecommendationSessionReporterInput {
  readonly sessionId: string;
  readonly strategyName: string;
  readonly generatedAtEpochMs: number;
  readonly presentations: readonly OperatorDecisionPresentationReport[];
}

export interface PerSpinRecommendationSessionReport {
  readonly sessionId: string;
  readonly strategyName: string;
  readonly generatedAtEpochMs: number;
  readonly totalRecommendations: number;
  readonly favorableCount: number;
  readonly waitCount: number;
  readonly noUseCount: number;
  readonly averageConfidencePercent: number;
  readonly controlledRiskCount: number;
  readonly moderateRiskCount: number;
  readonly elevatedRiskCount: number;
  readonly trend: PerSpinSessionRecommendationTrend;
  readonly latestRecommendation: PerSpinRecommendationRecord | null;
  readonly timeline: readonly PerSpinRecommendationRecord[];
  readonly operatorSummary: string;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly institutionalAnalysisMode: true;
}

export interface PerSpinRecommendationSessionReporterFailure {
  readonly code: 'INVALID_PER_SPIN_SESSION_REPORT_INPUT';
  readonly stage: 'VALIDATION';
  readonly message: string;
}

export type PerSpinRecommendationSessionReporterResult =
  | { readonly ok: true; readonly value: PerSpinRecommendationSessionReport }
  | { readonly ok: false; readonly error: PerSpinRecommendationSessionReporterFailure };

/**
 * Builds an immutable per-spin operator recommendation session report.
 *
 * This reporter does not create new recommendation intelligence. It only
 * consolidates the operator-facing presentations already produced by
 * OperatorDecisionPresentationAdapter.
 *
 * Complexity:
 * - Time: O(n), where n is the number of presented spins.
 * - Space: O(n), because the operator timeline is intentionally preserved.
 */
export class PerSpinRecommendationSessionReporter {
  public report(
    input: PerSpinRecommendationSessionReporterInput,
  ): PerSpinRecommendationSessionReporterResult {
    const validationFailure = this.validate(input);
    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }

    let favorableCount = 0;
    let waitCount = 0;
    let noUseCount = 0;
    let totalConfidence = 0;

    let controlledRiskCount = 0;
    let moderateRiskCount = 0;
    let elevatedRiskCount = 0;

    const timeline: PerSpinRecommendationRecord[] = [];

    for (let index = 0; index < input.presentations.length; index += 1) {
      const presentation = input.presentations[index];

      const record = this.toRecord(index + 1, presentation);
      timeline.push(record);

      totalConfidence += presentation.confidencePercent;

      if (presentation.status === 'FAVORAVEL') {
        favorableCount += 1;
      } else if (presentation.status === 'AGUARDAR') {
        waitCount += 1;
      } else {
        noUseCount += 1;
      }

      if (presentation.riskLevel === 'CONTROLADO') {
        controlledRiskCount += 1;
      } else if (presentation.riskLevel === 'MODERADO') {
        moderateRiskCount += 1;
      } else {
        elevatedRiskCount += 1;
      }
    }

    const totalRecommendations = input.presentations.length;
    const averageConfidencePercent =
      totalRecommendations === 0 ? 0 : Math.round(totalConfidence / totalRecommendations);

    const trend = this.trend(favorableCount, waitCount, noUseCount, totalRecommendations);
    const latestRecommendation =
      timeline.length === 0 ? null : timeline[timeline.length - 1];

    return {
      ok: true,
      value: Object.freeze({
        sessionId: input.sessionId.trim(),
        strategyName: input.strategyName.trim(),
        generatedAtEpochMs: input.generatedAtEpochMs,
        totalRecommendations,
        favorableCount,
        waitCount,
        noUseCount,
        averageConfidencePercent,
        controlledRiskCount,
        moderateRiskCount,
        elevatedRiskCount,
        trend,
        latestRecommendation,
        timeline: Object.freeze(timeline),
        operatorSummary: this.operatorSummary(
          input.strategyName.trim(),
          totalRecommendations,
          trend,
          averageConfidencePercent,
        ),
        operatorDecisionRequired: true,
        supervisedRecommendationOnly: true,
        institutionalAnalysisMode: true,
      }),
    };
  }

  private validate(
    input: PerSpinRecommendationSessionReporterInput,
  ): PerSpinRecommendationSessionReporterFailure | null {
    if (typeof input.sessionId !== 'string' || input.sessionId.trim().length === 0) {
      return this.failure('sessionId is required');
    }

    if (typeof input.strategyName !== 'string' || input.strategyName.trim().length === 0) {
      return this.failure('strategyName is required');
    }

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.failure('generatedAtEpochMs must be a positive finite number');
    }

    if (!Array.isArray(input.presentations)) {
      return this.failure('presentations must be an array');
    }

    for (let index = 0; index < input.presentations.length; index += 1) {
      const presentation = input.presentations[index];
      if (!this.isValidPresentation(presentation)) {
        return this.failure(`presentation at index ${index} is invalid`);
      }

      if (presentation.strategyName.trim() !== input.strategyName.trim()) {
        return this.failure(`presentation at index ${index} belongs to another strategy`);
      }
    }

    return null;
  }

  private isValidPresentation(presentation: OperatorDecisionPresentationReport): boolean {
    return (
      typeof presentation === 'object' &&
      presentation !== null &&
      typeof presentation.strategyName === 'string' &&
      presentation.strategyName.trim().length > 0 &&
      (
        presentation.status === 'FAVORAVEL' ||
        presentation.status === 'AGUARDAR' ||
        presentation.status === 'NAO_UTILIZAR'
      ) &&
      Number.isInteger(presentation.confidencePercent) &&
      presentation.confidencePercent >= 0 &&
      presentation.confidencePercent <= 100 &&
      (
        presentation.riskLevel === 'CONTROLADO' ||
        presentation.riskLevel === 'MODERADO' ||
        presentation.riskLevel === 'ELEVADO'
      ) &&
      typeof presentation.headline === 'string' &&
      typeof presentation.explanation === 'string' &&
      Array.isArray(presentation.reasons) &&
      Array.isArray(presentation.warnings) &&
      Array.isArray(presentation.blockers) &&
      presentation.operatorDecisionRequired === true &&
      presentation.supervisedRecommendationOnly === true &&
      presentation.institutionalAnalysisMode === true
    );
  }

  private toRecord(
    spinIndex: number,
    presentation: OperatorDecisionPresentationReport,
  ): PerSpinRecommendationRecord {
    return Object.freeze({
      spinIndex,
      strategyName: presentation.strategyName,
      status: presentation.status,
      confidencePercent: presentation.confidencePercent,
      riskLevel: presentation.riskLevel,
      actionLabel: presentation.actionLabel,
      headline: presentation.headline,
      explanation: presentation.explanation,
      reasons: Object.freeze([...presentation.reasons]),
      warnings: Object.freeze([...presentation.warnings]),
      blockers: Object.freeze([...presentation.blockers]),
    });
  }

  private trend(
    favorableCount: number,
    waitCount: number,
    noUseCount: number,
    totalRecommendations: number,
  ): PerSpinSessionRecommendationTrend {
    if (totalRecommendations === 0) {
      return 'SESSION_EMPTY';
    }

    if (favorableCount > waitCount && favorableCount > noUseCount) {
      return 'SESSION_FAVORABLE_DOMINANT';
    }

    if (noUseCount > favorableCount && noUseCount > waitCount) {
      return 'SESSION_NO_USE_DOMINANT';
    }

    if (waitCount > favorableCount && waitCount > noUseCount) {
      return 'SESSION_WAIT_DOMINANT';
    }

    return 'SESSION_MIXED';
  }

  private operatorSummary(
    strategyName: string,
    totalRecommendations: number,
    trend: PerSpinSessionRecommendationTrend,
    averageConfidencePercent: number,
  ): string {
    if (trend === 'SESSION_EMPTY') {
      return `${strategyName}: nenhuma recomendação por giro foi registrada nesta sessão.`;
    }

    if (trend === 'SESSION_FAVORABLE_DOMINANT') {
      return `${strategyName}: sessão com predominância favorável em ${totalRecommendations} recomendações, confiança média de ${averageConfidencePercent}%.`;
    }

    if (trend === 'SESSION_NO_USE_DOMINANT') {
      return `${strategyName}: sessão com predominância de não utilização em ${totalRecommendations} recomendações, confiança média de ${averageConfidencePercent}%.`;
    }

    if (trend === 'SESSION_WAIT_DOMINANT') {
      return `${strategyName}: sessão com predominância de espera em ${totalRecommendations} recomendações, confiança média de ${averageConfidencePercent}%.`;
    }

    return `${strategyName}: sessão mista em ${totalRecommendations} recomendações, confiança média de ${averageConfidencePercent}%.`;
  }

  private failure(message: string): PerSpinRecommendationSessionReporterFailure {
    return Object.freeze({
      code: 'INVALID_PER_SPIN_SESSION_REPORT_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
