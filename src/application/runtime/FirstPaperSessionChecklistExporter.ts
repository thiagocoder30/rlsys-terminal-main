import type {
  FirstRealPlatformPaperSessionProtocolReport,
  FirstPaperSessionStatus,
} from './FirstRealPlatformPaperSessionProtocol.js';

export type FirstPaperSessionChecklistExportFormat = 'TEXT' | 'JSON';

export interface FirstPaperSessionChecklistExporterInput {
  readonly exportId: string;
  readonly generatedAtEpochMs: number;
  readonly format: FirstPaperSessionChecklistExportFormat;
  readonly protocolReport: FirstRealPlatformPaperSessionProtocolReport;
}

export interface FirstPaperSessionChecklistJsonExport {
  readonly exportId: string;
  readonly generatedAtEpochMs: number;
  readonly format: 'JSON';
  readonly sessionId: string;
  readonly strategyName: string;
  readonly status: FirstPaperSessionStatus;
  readonly canStartPaperSession: boolean;
  readonly warmup: {
    readonly complete: boolean;
    readonly observedRounds: number;
    readonly minWarmupRounds: number;
    readonly maxObservedRounds: number;
  };
  readonly recommendationCounters: {
    readonly favorableCount: number;
    readonly waitCount: number;
    readonly noUseCount: number;
    readonly elevatedRiskCount: number;
    readonly averageConfidencePercent: number;
  };
  readonly checklist: readonly string[];
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly operatorSummary: string;
  readonly governance: {
    readonly operatorDecisionRequired: true;
    readonly supervisedRecommendationOnly: true;
    readonly institutionalAnalysisMode: true;
  };
}

export interface FirstPaperSessionChecklistExportReport {
  readonly exportId: string;
  readonly generatedAtEpochMs: number;
  readonly format: FirstPaperSessionChecklistExportFormat;
  readonly sessionId: string;
  readonly strategyName: string;
  readonly status: FirstPaperSessionStatus;
  readonly text: string;
  readonly json: FirstPaperSessionChecklistJsonExport;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly institutionalAnalysisMode: true;
}

export interface FirstPaperSessionChecklistExporterFailure {
  readonly code: 'INVALID_FIRST_PAPER_SESSION_CHECKLIST_EXPORT_INPUT';
  readonly stage: 'VALIDATION';
  readonly message: string;
}

export type FirstPaperSessionChecklistExporterResult =
  | { readonly ok: true; readonly value: FirstPaperSessionChecklistExportReport }
  | { readonly ok: false; readonly error: FirstPaperSessionChecklistExporterFailure };

/**
 * Exports the first PAPER session protocol as an operator checklist.
 *
 * This class does not evaluate the protocol. It serializes the already validated
 * FirstRealPlatformPaperSessionProtocolReport into TEXT or JSON for operator use.
 *
 * Complexity:
 * - Time: O(n), where n is checklist + blockers + warnings length.
 * - Space: O(n), because the export payload is intentionally materialized.
 */
export class FirstPaperSessionChecklistExporter {
  public export(
    input: FirstPaperSessionChecklistExporterInput,
  ): FirstPaperSessionChecklistExporterResult {
    const validationFailure = this.validate(input);
    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }

    const report = input.protocolReport;

    const json: FirstPaperSessionChecklistJsonExport = Object.freeze({
      exportId: input.exportId.trim(),
      generatedAtEpochMs: input.generatedAtEpochMs,
      format: 'JSON',
      sessionId: report.sessionId,
      strategyName: report.strategyName,
      status: report.status,
      canStartPaperSession: report.canStartPaperSession,
      warmup: Object.freeze({
        complete: report.warmupComplete,
        observedRounds: report.observedRounds,
        minWarmupRounds: report.minWarmupRounds,
        maxObservedRounds: report.maxObservedRounds,
      }),
      recommendationCounters: Object.freeze({
        favorableCount: report.favorableCount,
        waitCount: report.waitCount,
        noUseCount: report.noUseCount,
        elevatedRiskCount: report.elevatedRiskCount,
        averageConfidencePercent: report.averageConfidencePercent,
      }),
      checklist: Object.freeze([...report.checklist]),
      blockers: Object.freeze([...report.blockers]),
      warnings: Object.freeze([...report.warnings]),
      operatorSummary: report.operatorSummary,
      governance: Object.freeze({
        operatorDecisionRequired: true,
        supervisedRecommendationOnly: true,
        institutionalAnalysisMode: true,
      }),
    });

    const text = input.format === 'JSON'
      ? JSON.stringify(json, null, 2)
      : this.toText(json);

    return {
      ok: true,
      value: Object.freeze({
        exportId: input.exportId.trim(),
        generatedAtEpochMs: input.generatedAtEpochMs,
        format: input.format,
        sessionId: report.sessionId,
        strategyName: report.strategyName,
        status: report.status,
        text,
        json,
        operatorDecisionRequired: true,
        supervisedRecommendationOnly: true,
        institutionalAnalysisMode: true,
      }),
    };
  }

  private validate(
    input: FirstPaperSessionChecklistExporterInput,
  ): FirstPaperSessionChecklistExporterFailure | null {
    if (typeof input.exportId !== 'string' || input.exportId.trim().length === 0) {
      return this.failure('exportId is required');
    }

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.failure('generatedAtEpochMs must be a positive finite number');
    }

    if (input.format !== 'TEXT' && input.format !== 'JSON') {
      return this.failure('format must be TEXT or JSON');
    }

    if (!this.isValidProtocolReport(input.protocolReport)) {
      return this.failure('protocolReport is invalid or violates supervised recommendation semantics');
    }

    return null;
  }

  private isValidProtocolReport(report: FirstRealPlatformPaperSessionProtocolReport): boolean {
    return (
      typeof report === 'object' &&
      report !== null &&
      typeof report.sessionId === 'string' &&
      report.sessionId.trim().length > 0 &&
      typeof report.strategyName === 'string' &&
      report.strategyName.trim().length > 0 &&
      (
        report.status === 'READY_FOR_FIRST_PAPER_SESSION' ||
        report.status === 'WARMUP_REQUIRED' ||
        report.status === 'SESSION_LIMIT_REACHED' ||
        report.status === 'SESSION_BLOCKED'
      ) &&
      typeof report.canStartPaperSession === 'boolean' &&
      typeof report.warmupComplete === 'boolean' &&
      Number.isInteger(report.observedRounds) &&
      Number.isInteger(report.minWarmupRounds) &&
      Number.isInteger(report.maxObservedRounds) &&
      Number.isInteger(report.favorableCount) &&
      Number.isInteger(report.waitCount) &&
      Number.isInteger(report.noUseCount) &&
      Number.isInteger(report.elevatedRiskCount) &&
      Number.isFinite(report.averageConfidencePercent) &&
      Array.isArray(report.checklist) &&
      Array.isArray(report.blockers) &&
      Array.isArray(report.warnings) &&
      typeof report.operatorSummary === 'string' &&
      report.operatorDecisionRequired === true &&
      report.supervisedRecommendationOnly === true &&
      report.institutionalAnalysisMode === true
    );
  }

  private toText(json: FirstPaperSessionChecklistJsonExport): string {
    const lines: string[] = [
      'RL.SYS CORE — FIRST PAPER SESSION CHECKLIST',
      '==========================================',
      `Export ID: ${json.exportId}`,
      `Generated At Epoch Ms: ${json.generatedAtEpochMs}`,
      '',
      'SESSION',
      '-------',
      `Session ID: ${json.sessionId}`,
      `Strategy: ${json.strategyName}`,
      `Status: ${json.status}`,
      `Can Start PAPER Session: ${json.canStartPaperSession}`,
      '',
      'WARMUP',
      '------',
      `Complete: ${json.warmup.complete}`,
      `Observed Rounds: ${json.warmup.observedRounds}`,
      `Minimum Warmup Rounds: ${json.warmup.minWarmupRounds}`,
      `Maximum Observed Rounds: ${json.warmup.maxObservedRounds}`,
      '',
      'RECOMMENDATION COUNTERS',
      '-----------------------',
      `Favorable: ${json.recommendationCounters.favorableCount}`,
      `Wait: ${json.recommendationCounters.waitCount}`,
      `No Use: ${json.recommendationCounters.noUseCount}`,
      `Elevated Risk: ${json.recommendationCounters.elevatedRiskCount}`,
      `Average Confidence: ${json.recommendationCounters.averageConfidencePercent}%`,
      '',
      'OPERATOR SUMMARY',
      '----------------',
      json.operatorSummary,
      '',
      'CHECKLIST',
      '---------',
      ...this.list(json.checklist),
      '',
      'BLOCKERS',
      '--------',
      ...this.listOrNone(json.blockers),
      '',
      'WARNINGS',
      '--------',
      ...this.listOrNone(json.warnings),
      '',
      'GOVERNANCE',
      '----------',
      'Operator Decision Required: true',
      'Supervised Recommendation Only: true',
      'Institutional Analysis Mode: true',
    ];

    return lines.join('\n');
  }

  private list(items: readonly string[]): readonly string[] {
    return Object.freeze(items.map((item, index) => `${index + 1}. ${item}`));
  }

  private listOrNone(items: readonly string[]): readonly string[] {
    if (items.length === 0) {
      return Object.freeze(['None']);
    }

    return this.list(items);
  }

  private failure(message: string): FirstPaperSessionChecklistExporterFailure {
    return Object.freeze({
      code: 'INVALID_FIRST_PAPER_SESSION_CHECKLIST_EXPORT_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
