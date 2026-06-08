import type {
  FirstRealPlatformPaperSessionProtocolReport,
} from './FirstRealPlatformPaperSessionProtocol.js';

import type {
  FirstPaperSessionChecklistExportReport,
} from './FirstPaperSessionChecklistExporter.js';

import type {
  FirstPaperSessionRunbookReport,
} from './FirstPaperSessionRunbookComposer.js';

export type FirstPaperSessionExecutionBundleStatus =
  | 'BUNDLE_READY'
  | 'BUNDLE_WARMUP_REQUIRED'
  | 'BUNDLE_BLOCKED'
  | 'BUNDLE_SESSION_LIMIT_REACHED';

export interface FirstPaperSessionExecutionBundleInput {
  readonly bundleId: string;
  readonly generatedAtEpochMs: number;
  readonly protocolReport: FirstRealPlatformPaperSessionProtocolReport;
  readonly checklistExport: FirstPaperSessionChecklistExportReport;
  readonly runbook: FirstPaperSessionRunbookReport;
}

export interface FirstPaperSessionExecutionBundleReport {
  readonly bundleId: string;
  readonly generatedAtEpochMs: number;
  readonly sessionId: string;
  readonly strategyName: string;
  readonly status: FirstPaperSessionExecutionBundleStatus;
  readonly canStartPaperSession: boolean;
  readonly protocolStatus: FirstRealPlatformPaperSessionProtocolReport['status'];
  readonly checklistExportId: string;
  readonly runbookId: string;
  readonly protocolReport: FirstRealPlatformPaperSessionProtocolReport;
  readonly checklistExport: FirstPaperSessionChecklistExportReport;
  readonly runbook: FirstPaperSessionRunbookReport;
  readonly operatorSummary: string;
  readonly operatorReadinessChecklist: readonly string[];
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly institutionalAnalysisMode: true;
}

export interface FirstPaperSessionExecutionBundleFailure {
  readonly code: 'INVALID_FIRST_PAPER_SESSION_EXECUTION_BUNDLE_INPUT';
  readonly stage: 'VALIDATION';
  readonly message: string;
}

export type FirstPaperSessionExecutionBundleResult =
  | { readonly ok: true; readonly value: FirstPaperSessionExecutionBundleReport }
  | { readonly ok: false; readonly error: FirstPaperSessionExecutionBundleFailure };

/**
 * Consolidates protocol, checklist and runbook into one first PAPER session bundle.
 *
 * This class does not evaluate readiness and does not generate recommendations.
 * It verifies that previously produced artifacts refer to the same session and
 * strategy, then creates a deterministic operational bundle for the operator.
 *
 * Complexity:
 * - Time: O(n), where n is checklist + blockers + warnings length.
 * - Space: O(n), because the bundle preserves operational artifacts.
 */
export class FirstPaperSessionExecutionBundle {
  public compose(
    input: FirstPaperSessionExecutionBundleInput,
  ): FirstPaperSessionExecutionBundleResult {
    const validationFailure = this.validate(input);
    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }

    const blockers = this.unique([
      ...input.protocolReport.blockers,
      ...input.checklistExport.json.blockers,
      ...input.runbook.blockers,
    ]);

    const warnings = this.unique([
      ...input.protocolReport.warnings,
      ...input.checklistExport.json.warnings,
      ...input.runbook.warnings,
    ]);

    const readinessChecklist = this.unique([
      ...input.protocolReport.checklist,
      ...input.checklistExport.json.checklist,
      ...input.runbook.steps.map((step) => `${step.phase}:${step.title}`),
    ]);

    const status = this.status(input.protocolReport.status);

    return {
      ok: true,
      value: Object.freeze({
        bundleId: input.bundleId.trim(),
        generatedAtEpochMs: input.generatedAtEpochMs,
        sessionId: input.protocolReport.sessionId,
        strategyName: input.protocolReport.strategyName,
        status,
        canStartPaperSession: input.protocolReport.canStartPaperSession && input.runbook.canStartPaperSession,
        protocolStatus: input.protocolReport.status,
        checklistExportId: input.checklistExport.exportId,
        runbookId: input.runbook.runbookId,
        protocolReport: input.protocolReport,
        checklistExport: input.checklistExport,
        runbook: input.runbook,
        operatorSummary: this.summary(status, input.protocolReport.strategyName, blockers.length, warnings.length),
        operatorReadinessChecklist: Object.freeze(readinessChecklist),
        blockers: Object.freeze(blockers),
        warnings: Object.freeze(warnings),
        operatorDecisionRequired: true,
        supervisedRecommendationOnly: true,
        institutionalAnalysisMode: true,
      }),
    };
  }

  private validate(
    input: FirstPaperSessionExecutionBundleInput,
  ): FirstPaperSessionExecutionBundleFailure | null {
    if (typeof input.bundleId !== 'string' || input.bundleId.trim().length === 0) {
      return this.failure('bundleId is required');
    }

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.failure('generatedAtEpochMs must be a positive finite number');
    }

    if (!this.isValidProtocol(input.protocolReport)) {
      return this.failure('protocolReport is invalid');
    }

    if (!this.isValidChecklist(input.checklistExport)) {
      return this.failure('checklistExport is invalid');
    }

    if (!this.isValidRunbook(input.runbook)) {
      return this.failure('runbook is invalid');
    }

    if (
      input.protocolReport.sessionId !== input.checklistExport.sessionId ||
      input.protocolReport.sessionId !== input.runbook.sessionId
    ) {
      return this.failure('protocol, checklist and runbook must belong to the same session');
    }

    if (
      input.protocolReport.strategyName !== input.checklistExport.strategyName ||
      input.protocolReport.strategyName !== input.runbook.strategyName
    ) {
      return this.failure('protocol, checklist and runbook must belong to the same strategy');
    }

    if (input.protocolReport.status !== input.checklistExport.status) {
      return this.failure('protocol and checklist status mismatch');
    }

    if (input.protocolReport.status !== input.runbook.protocolStatus) {
      return this.failure('protocol and runbook status mismatch');
    }

    return null;
  }

  private isValidProtocol(report: FirstRealPlatformPaperSessionProtocolReport): boolean {
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
      Array.isArray(report.checklist) &&
      Array.isArray(report.blockers) &&
      Array.isArray(report.warnings) &&
      report.operatorDecisionRequired === true &&
      report.supervisedRecommendationOnly === true &&
      report.institutionalAnalysisMode === true
    );
  }

  private isValidChecklist(report: FirstPaperSessionChecklistExportReport): boolean {
    return (
      typeof report === 'object' &&
      report !== null &&
      typeof report.exportId === 'string' &&
      report.exportId.trim().length > 0 &&
      typeof report.sessionId === 'string' &&
      report.sessionId.trim().length > 0 &&
      typeof report.strategyName === 'string' &&
      report.strategyName.trim().length > 0 &&
      typeof report.json === 'object' &&
      report.json !== null &&
      Array.isArray(report.json.checklist) &&
      Array.isArray(report.json.blockers) &&
      Array.isArray(report.json.warnings) &&
      report.operatorDecisionRequired === true &&
      report.supervisedRecommendationOnly === true &&
      report.institutionalAnalysisMode === true &&
      report.json.governance.operatorDecisionRequired === true &&
      report.json.governance.supervisedRecommendationOnly === true &&
      report.json.governance.institutionalAnalysisMode === true
    );
  }

  private isValidRunbook(report: FirstPaperSessionRunbookReport): boolean {
    return (
      typeof report === 'object' &&
      report !== null &&
      typeof report.runbookId === 'string' &&
      report.runbookId.trim().length > 0 &&
      typeof report.sessionId === 'string' &&
      report.sessionId.trim().length > 0 &&
      typeof report.strategyName === 'string' &&
      report.strategyName.trim().length > 0 &&
      Array.isArray(report.steps) &&
      Array.isArray(report.blockers) &&
      Array.isArray(report.warnings) &&
      typeof report.renderedText === 'string' &&
      report.operatorDecisionRequired === true &&
      report.supervisedRecommendationOnly === true &&
      report.institutionalAnalysisMode === true
    );
  }

  private status(
    protocolStatus: FirstRealPlatformPaperSessionProtocolReport['status'],
  ): FirstPaperSessionExecutionBundleStatus {
    if (protocolStatus === 'READY_FOR_FIRST_PAPER_SESSION') {
      return 'BUNDLE_READY';
    }

    if (protocolStatus === 'WARMUP_REQUIRED') {
      return 'BUNDLE_WARMUP_REQUIRED';
    }

    if (protocolStatus === 'SESSION_LIMIT_REACHED') {
      return 'BUNDLE_SESSION_LIMIT_REACHED';
    }

    return 'BUNDLE_BLOCKED';
  }

  private summary(
    status: FirstPaperSessionExecutionBundleStatus,
    strategyName: string,
    blockerCount: number,
    warningCount: number,
  ): string {
    if (status === 'BUNDLE_READY') {
      return `${strategyName}: pacote operacional pronto para primeira sessão PAPER supervisionada. Warnings: ${warningCount}.`;
    }

    if (status === 'BUNDLE_WARMUP_REQUIRED') {
      return `${strategyName}: pacote gerado, mas o warmup ainda precisa ser concluído. Blockers: ${blockerCount}.`;
    }

    if (status === 'BUNDLE_SESSION_LIMIT_REACHED') {
      return `${strategyName}: pacote indica limite de sessão atingido; encerrar e exportar artefatos.`;
    }

    return `${strategyName}: pacote bloqueado para início da sessão PAPER. Blockers: ${blockerCount}.`;
  }

  private unique(items: readonly string[]): readonly string[] {
    const seen = new Set<string>();
    const output: string[] = [];

    for (const item of items) {
      const normalized = typeof item === 'string' ? item.trim() : '';
      if (normalized.length > 0 && !seen.has(normalized)) {
        seen.add(normalized);
        output.push(normalized);
      }
    }

    return Object.freeze(output);
  }

  private failure(message: string): FirstPaperSessionExecutionBundleFailure {
    return Object.freeze({
      code: 'INVALID_FIRST_PAPER_SESSION_EXECUTION_BUNDLE_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
