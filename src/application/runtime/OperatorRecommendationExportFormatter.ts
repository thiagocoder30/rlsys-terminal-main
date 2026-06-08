import type {
  PerSpinRecommendationRecord,
  PerSpinRecommendationSessionReport,
} from './PerSpinRecommendationSessionReporter.js';

export type OperatorRecommendationExportFormat = 'TEXT' | 'JSON';

export interface OperatorRecommendationExportFormatterInput {
  readonly exportId: string;
  readonly generatedAtEpochMs: number;
  readonly format: OperatorRecommendationExportFormat;
  readonly report: PerSpinRecommendationSessionReport;
  readonly includeTimeline?: boolean;
}

export interface OperatorRecommendationJsonExport {
  readonly exportId: string;
  readonly generatedAtEpochMs: number;
  readonly format: 'JSON';
  readonly session: {
    readonly sessionId: string;
    readonly strategyName: string;
    readonly sessionGeneratedAtEpochMs: number;
    readonly totalRecommendations: number;
    readonly favorableCount: number;
    readonly waitCount: number;
    readonly noUseCount: number;
    readonly averageConfidencePercent: number;
    readonly controlledRiskCount: number;
    readonly moderateRiskCount: number;
    readonly elevatedRiskCount: number;
    readonly trend: PerSpinRecommendationSessionReport['trend'];
    readonly operatorSummary: string;
  };
  readonly latestRecommendation: PerSpinRecommendationRecord | null;
  readonly timeline: readonly PerSpinRecommendationRecord[];
  readonly governance: {
    readonly operatorDecisionRequired: true;
    readonly supervisedRecommendationOnly: true;
    readonly institutionalAnalysisMode: true;
  };
}

export interface OperatorRecommendationExportReport {
  readonly exportId: string;
  readonly generatedAtEpochMs: number;
  readonly format: OperatorRecommendationExportFormat;
  readonly sessionId: string;
  readonly strategyName: string;
  readonly text: string;
  readonly json: OperatorRecommendationJsonExport;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly institutionalAnalysisMode: true;
}

export interface OperatorRecommendationExportFailure {
  readonly code: 'INVALID_OPERATOR_RECOMMENDATION_EXPORT_INPUT';
  readonly stage: 'VALIDATION';
  readonly message: string;
}

export type OperatorRecommendationExportResult =
  | { readonly ok: true; readonly value: OperatorRecommendationExportReport }
  | { readonly ok: false; readonly error: OperatorRecommendationExportFailure };

/**
 * Formats per-spin recommendation session reports into operator-facing TEXT/JSON.
 *
 * This formatter does not create recommendations. It serializes the session
 * report already produced by PerSpinRecommendationSessionReporter.
 *
 * Complexity:
 * - Time: O(n), where n is the exported timeline length.
 * - Space: O(n), due to the serialized text/json export payload.
 */
export class OperatorRecommendationExportFormatter {
  public export(
    input: OperatorRecommendationExportFormatterInput,
  ): OperatorRecommendationExportResult {
    const validationFailure = this.validate(input);
    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }

    const includeTimeline = input.includeTimeline !== false;
    const timeline = includeTimeline ? input.report.timeline : [];

    const json: OperatorRecommendationJsonExport = Object.freeze({
      exportId: input.exportId.trim(),
      generatedAtEpochMs: input.generatedAtEpochMs,
      format: 'JSON',
      session: Object.freeze({
        sessionId: input.report.sessionId,
        strategyName: input.report.strategyName,
        sessionGeneratedAtEpochMs: input.report.generatedAtEpochMs,
        totalRecommendations: input.report.totalRecommendations,
        favorableCount: input.report.favorableCount,
        waitCount: input.report.waitCount,
        noUseCount: input.report.noUseCount,
        averageConfidencePercent: input.report.averageConfidencePercent,
        controlledRiskCount: input.report.controlledRiskCount,
        moderateRiskCount: input.report.moderateRiskCount,
        elevatedRiskCount: input.report.elevatedRiskCount,
        trend: input.report.trend,
        operatorSummary: input.report.operatorSummary,
      }),
      latestRecommendation: input.report.latestRecommendation,
      timeline: Object.freeze([...timeline]),
      governance: Object.freeze({
        operatorDecisionRequired: true,
        supervisedRecommendationOnly: true,
        institutionalAnalysisMode: true,
      }),
    });

    const text = this.toText(json, input.format);

    return {
      ok: true,
      value: Object.freeze({
        exportId: input.exportId.trim(),
        generatedAtEpochMs: input.generatedAtEpochMs,
        format: input.format,
        sessionId: input.report.sessionId,
        strategyName: input.report.strategyName,
        text,
        json,
        operatorDecisionRequired: true,
        supervisedRecommendationOnly: true,
        institutionalAnalysisMode: true,
      }),
    };
  }

  private validate(
    input: OperatorRecommendationExportFormatterInput,
  ): OperatorRecommendationExportFailure | null {
    if (typeof input.exportId !== 'string' || input.exportId.trim().length === 0) {
      return this.failure('exportId is required');
    }

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.failure('generatedAtEpochMs must be a positive finite number');
    }

    if (input.format !== 'TEXT' && input.format !== 'JSON') {
      return this.failure('format must be TEXT or JSON');
    }

    if (!this.isValidReport(input.report)) {
      return this.failure('report is invalid or violates supervised recommendation semantics');
    }

    return null;
  }

  private isValidReport(report: PerSpinRecommendationSessionReport): boolean {
    return (
      typeof report === 'object' &&
      report !== null &&
      typeof report.sessionId === 'string' &&
      report.sessionId.trim().length > 0 &&
      typeof report.strategyName === 'string' &&
      report.strategyName.trim().length > 0 &&
      Number.isFinite(report.generatedAtEpochMs) &&
      report.generatedAtEpochMs > 0 &&
      Number.isInteger(report.totalRecommendations) &&
      report.totalRecommendations >= 0 &&
      report.timeline.length === report.totalRecommendations &&
      report.favorableCount + report.waitCount + report.noUseCount === report.totalRecommendations &&
      report.controlledRiskCount + report.moderateRiskCount + report.elevatedRiskCount === report.totalRecommendations &&
      report.operatorDecisionRequired === true &&
      report.supervisedRecommendationOnly === true &&
      report.institutionalAnalysisMode === true
    );
  }

  private toText(
    json: OperatorRecommendationJsonExport,
    requestedFormat: OperatorRecommendationExportFormat,
  ): string {
    if (requestedFormat === 'JSON') {
      return JSON.stringify(json, null, 2);
    }

    const lines: string[] = [
      'RL.SYS CORE — OPERATOR RECOMMENDATION EXPORT',
      '===========================================',
      `Export ID: ${json.exportId}`,
      `Generated At Epoch Ms: ${json.generatedAtEpochMs}`,
      '',
      'SESSION',
      '-------',
      `Session ID: ${json.session.sessionId}`,
      `Strategy: ${json.session.strategyName}`,
      `Total Recommendations: ${json.session.totalRecommendations}`,
      `Favorable: ${json.session.favorableCount}`,
      `Wait: ${json.session.waitCount}`,
      `No Use: ${json.session.noUseCount}`,
      `Average Confidence: ${json.session.averageConfidencePercent}%`,
      `Controlled Risk: ${json.session.controlledRiskCount}`,
      `Moderate Risk: ${json.session.moderateRiskCount}`,
      `Elevated Risk: ${json.session.elevatedRiskCount}`,
      `Trend: ${json.session.trend}`,
      '',
      'OPERATOR SUMMARY',
      '----------------',
      json.session.operatorSummary,
      '',
      'LATEST RECOMMENDATION',
      '---------------------',
      this.latestToText(json.latestRecommendation),
      '',
      'GOVERNANCE',
      '----------',
      'Operator Decision Required: true',
      'Supervised Recommendation Only: true',
      'Institutional Analysis Mode: true',
    ];

    if (json.timeline.length > 0) {
      lines.push('', 'TIMELINE', '--------');
      for (const item of json.timeline) {
        lines.push(this.timelineItemToText(item));
      }
    }

    return lines.join('\n');
  }

  private latestToText(record: PerSpinRecommendationRecord | null): string {
    if (record === null) {
      return 'No recommendation recorded.';
    }

    return [
      `Spin: ${record.spinIndex}`,
      `Status: ${record.status}`,
      `Confidence: ${record.confidencePercent}%`,
      `Risk: ${record.riskLevel}`,
      `Action: ${record.actionLabel}`,
      `Headline: ${record.headline}`,
    ].join('\n');
  }

  private timelineItemToText(record: PerSpinRecommendationRecord): string {
    return [
      `#${record.spinIndex}`,
      `Status=${record.status}`,
      `Confidence=${record.confidencePercent}%`,
      `Risk=${record.riskLevel}`,
      `Action=${record.actionLabel}`,
    ].join(' | ');
  }

  private failure(message: string): OperatorRecommendationExportFailure {
    return Object.freeze({
      code: 'INVALID_OPERATOR_RECOMMENDATION_EXPORT_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
