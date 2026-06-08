import type {
  InstitutionalPaperCertificationReport,
} from './InstitutionalPaperCertificationEngine.js';

export type PaperCertificationExportFormat =
  | 'TEXT'
  | 'JSON';

export interface PaperCertificationReportExporterInput {
  readonly exportId: string;
  readonly generatedAtEpochMs: number;
  readonly certification: InstitutionalPaperCertificationReport;
  readonly format: PaperCertificationExportFormat;
}

export interface PaperCertificationJsonExport {
  readonly exportId: string;
  readonly generatedAtEpochMs: number;
  readonly certificationId: string;
  readonly status: InstitutionalPaperCertificationReport['status'];
  readonly certificationScore: number;
  readonly campaignCount: number;
  readonly dryRunCount: number;
  readonly averageReadinessRatio: number;
  readonly averageReviewRatio: number;
  readonly averageBlockedRatio: number;
  readonly decisionCounts: InstitutionalPaperCertificationReport['decisionCounts'];
  readonly reasons: readonly string[];
  readonly operatorSummary: string;
  readonly governance: {
    readonly paperOnly: true;
    readonly productionMoneyAllowed: false;
    readonly liveMoneyAuthorization: false;
    readonly automaticExecutionAllowed: false;
    readonly automaticSuggestionAllowed: true;
    readonly automaticBetExecutionAllowed: false;
    readonly humanSupervisionRequired: true;
  };
}

export interface PaperCertificationReportExporterReport {
  readonly exportId: string;
  readonly format: PaperCertificationExportFormat;
  readonly certificationId: string;
  readonly status: InstitutionalPaperCertificationReport['status'];
  readonly text: string;
  readonly json: PaperCertificationJsonExport;
  readonly lineCount: number;
  readonly paperOnly: true;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
  readonly automaticExecutionAllowed: false;
  readonly automaticSuggestionAllowed: true;
  readonly automaticBetExecutionAllowed: false;
  readonly humanSupervisionRequired: true;
}

export interface PaperCertificationReportExporterFailure {
  readonly code: 'INVALID_PAPER_CERTIFICATION_REPORT_EXPORTER_INPUT';
  readonly stage: 'VALIDATION';
  readonly message: string;
}

export type PaperCertificationReportExporterResult =
  | {
      readonly ok: true;
      readonly value: PaperCertificationReportExporterReport;
    }
  | {
      readonly ok: false;
      readonly error: PaperCertificationReportExporterFailure;
    };

/**
 * Exports InstitutionalPaperCertificationReport into operator/audit friendly
 * formats without changing certification semantics.
 *
 * Complexity:
 * - Time: O(r), where r is the number of institutional reasons.
 * - Space: O(r), for export lines and reason copy.
 *
 * This exporter is PAPER-only and never authorizes live money or automatic bet
 * execution.
 */
export class PaperCertificationReportExporter {
  public export(
    input: PaperCertificationReportExporterInput,
  ): PaperCertificationReportExporterResult {
    const validationFailure = this.validate(input);

    if (validationFailure !== null) {
      return {
        ok: false,
        error: validationFailure,
      };
    }

    const json = this.toJson(input);
    const lines = this.toTextLines(json);
    const text = lines.join('\n');

    return {
      ok: true,
      value: Object.freeze({
        exportId: input.exportId,
        format: input.format,
        certificationId: input.certification.certificationId,
        status: input.certification.status,
        text,
        json,
        lineCount: lines.length,
        paperOnly: true,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        automaticExecutionAllowed: false,
        automaticSuggestionAllowed: true,
        automaticBetExecutionAllowed: false,
        humanSupervisionRequired: true,
      }),
    };
  }

  private validate(
    input: PaperCertificationReportExporterInput,
  ): PaperCertificationReportExporterFailure | null {
    if (input.exportId.trim().length === 0) {
      return this.validationFailure('exportId is required');
    }

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.validationFailure('generatedAtEpochMs must be a positive finite number');
    }

    if (input.format !== 'TEXT' && input.format !== 'JSON') {
      return this.validationFailure('format must be TEXT or JSON');
    }

    const certification = input.certification;

    if (certification.certificationId.trim().length === 0) {
      return this.validationFailure('certificationId is required');
    }

    if (certification.paperOnly !== true) {
      return this.validationFailure('certification must be PAPER-only');
    }

    if (
      certification.productionMoneyAllowed !== false ||
      certification.liveMoneyAuthorization !== false ||
      certification.automaticExecutionAllowed !== false ||
      certification.automaticBetExecutionAllowed !== false ||
      certification.humanSupervisionRequired !== true
    ) {
      return this.validationFailure('certification violates institutional PAPER locks');
    }

    return null;
  }

  private toJson(input: PaperCertificationReportExporterInput): PaperCertificationJsonExport {
    const certification = input.certification;

    return Object.freeze({
      exportId: input.exportId,
      generatedAtEpochMs: input.generatedAtEpochMs,
      certificationId: certification.certificationId,
      status: certification.status,
      certificationScore: certification.certificationScore,
      campaignCount: certification.campaignCount,
      dryRunCount: certification.dryRunCount,
      averageReadinessRatio: certification.averageReadinessRatio,
      averageReviewRatio: certification.averageReviewRatio,
      averageBlockedRatio: certification.averageBlockedRatio,
      decisionCounts: certification.decisionCounts,
      reasons: Object.freeze([...certification.reasons]),
      operatorSummary: certification.operatorSummary,
      governance: Object.freeze({
        paperOnly: true,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
        automaticExecutionAllowed: false,
        automaticSuggestionAllowed: true,
        automaticBetExecutionAllowed: false,
        humanSupervisionRequired: true,
      }),
    });
  }

  private toTextLines(json: PaperCertificationJsonExport): readonly string[] {
    return Object.freeze([
      '========================================',
      'RL.SYS CORE — PAPER CERTIFICATION REPORT',
      '========================================',
      `ExportId: ${json.exportId}`,
      `CertificationId: ${json.certificationId}`,
      `Status: ${json.status}`,
      `CertificationScore: ${json.certificationScore}`,
      '',
      'Campaign Metrics:',
      `CampaignCount: ${json.campaignCount}`,
      `DryRunCount: ${json.dryRunCount}`,
      `AverageReadinessRatio: ${json.averageReadinessRatio}`,
      `AverageReviewRatio: ${json.averageReviewRatio}`,
      `AverageBlockedRatio: ${json.averageBlockedRatio}`,
      '',
      'Decision Distribution:',
      `PAPER_FAVORAVEL: ${json.decisionCounts.paperFavoravel}`,
      `OBSERVAR: ${json.decisionCounts.observar}`,
      `NAO_UTILIZAR: ${json.decisionCounts.naoUtilizar}`,
      '',
      'Institutional Reasons:',
      ...json.reasons.map((reason) => `- ${reason}`),
      '',
      'Governance:',
      `paperOnly=${json.governance.paperOnly}`,
      `productionMoneyAllowed=${json.governance.productionMoneyAllowed}`,
      `liveMoneyAuthorization=${json.governance.liveMoneyAuthorization}`,
      `automaticExecutionAllowed=${json.governance.automaticExecutionAllowed}`,
      `automaticSuggestionAllowed=${json.governance.automaticSuggestionAllowed}`,
      `automaticBetExecutionAllowed=${json.governance.automaticBetExecutionAllowed}`,
      `humanSupervisionRequired=${json.governance.humanSupervisionRequired}`,
      '',
      'Operator Summary:',
      json.operatorSummary,
      '========================================',
    ]);
  }

  private validationFailure(message: string): PaperCertificationReportExporterFailure {
    return Object.freeze({
      code: 'INVALID_PAPER_CERTIFICATION_REPORT_EXPORTER_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
