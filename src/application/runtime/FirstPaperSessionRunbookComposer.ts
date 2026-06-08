import type {
  FirstPaperSessionChecklistExportReport,
} from './FirstPaperSessionChecklistExporter.js';

export type FirstPaperSessionRunbookPhase =
  | 'PRE_SESSION'
  | 'WARMUP'
  | 'OBSERVATION'
  | 'RECOMMENDATION'
  | 'PAPER_TRACKING'
  | 'SHUTDOWN'
  | 'EXPORT';

export interface FirstPaperSessionRunbookStep {
  readonly stepNumber: number;
  readonly phase: FirstPaperSessionRunbookPhase;
  readonly title: string;
  readonly instruction: string;
  readonly expectedEvidence: string;
  readonly mandatory: boolean;
}

export interface FirstPaperSessionRunbookComposerInput {
  readonly runbookId: string;
  readonly generatedAtEpochMs: number;
  readonly checklistExport: FirstPaperSessionChecklistExportReport;
}

export interface FirstPaperSessionRunbookReport {
  readonly runbookId: string;
  readonly generatedAtEpochMs: number;
  readonly sessionId: string;
  readonly strategyName: string;
  readonly protocolStatus: FirstPaperSessionChecklistExportReport['status'];
  readonly canStartPaperSession: boolean;
  readonly steps: readonly FirstPaperSessionRunbookStep[];
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly operatorSummary: string;
  readonly renderedText: string;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly institutionalAnalysisMode: true;
}

export interface FirstPaperSessionRunbookComposerFailure {
  readonly code: 'INVALID_FIRST_PAPER_SESSION_RUNBOOK_INPUT';
  readonly stage: 'VALIDATION';
  readonly message: string;
}

export type FirstPaperSessionRunbookComposerResult =
  | { readonly ok: true; readonly value: FirstPaperSessionRunbookReport }
  | { readonly ok: false; readonly error: FirstPaperSessionRunbookComposerFailure };

/**
 * Composes an operator runbook for the first real-platform PAPER session.
 *
 * This composer does not evaluate readiness and does not create recommendations.
 * It consumes the checklist export from FirstPaperSessionChecklistExporter and
 * turns it into a deterministic step-by-step operator procedure.
 *
 * Complexity:
 * - Time: O(n), where n is checklist + blockers + warnings length.
 * - Space: O(n), because the runbook steps and rendered text are materialized.
 */
export class FirstPaperSessionRunbookComposer {
  public compose(
    input: FirstPaperSessionRunbookComposerInput,
  ): FirstPaperSessionRunbookComposerResult {
    const validationFailure = this.validate(input);
    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }

    const checklist = input.checklistExport;
    const steps = this.steps(checklist);
    const blockers = Object.freeze([...checklist.json.blockers]);
    const warnings = Object.freeze([...checklist.json.warnings]);

    const report: Omit<FirstPaperSessionRunbookReport, 'renderedText'> = Object.freeze({
      runbookId: input.runbookId.trim(),
      generatedAtEpochMs: input.generatedAtEpochMs,
      sessionId: checklist.sessionId,
      strategyName: checklist.strategyName,
      protocolStatus: checklist.status,
      canStartPaperSession: checklist.json.canStartPaperSession,
      steps: Object.freeze(steps),
      blockers,
      warnings,
      operatorSummary: this.summary(checklist),
      operatorDecisionRequired: true,
      supervisedRecommendationOnly: true,
      institutionalAnalysisMode: true,
    });

    return {
      ok: true,
      value: Object.freeze({
        ...report,
        renderedText: this.render(report),
      }),
    };
  }

  private validate(
    input: FirstPaperSessionRunbookComposerInput,
  ): FirstPaperSessionRunbookComposerFailure | null {
    if (typeof input.runbookId !== 'string' || input.runbookId.trim().length === 0) {
      return this.failure('runbookId is required');
    }

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.failure('generatedAtEpochMs must be a positive finite number');
    }

    if (!this.isValidChecklistExport(input.checklistExport)) {
      return this.failure('checklistExport is invalid or violates supervised recommendation semantics');
    }

    return null;
  }

  private isValidChecklistExport(checklist: FirstPaperSessionChecklistExportReport): boolean {
    return (
      typeof checklist === 'object' &&
      checklist !== null &&
      typeof checklist.exportId === 'string' &&
      checklist.exportId.trim().length > 0 &&
      typeof checklist.sessionId === 'string' &&
      checklist.sessionId.trim().length > 0 &&
      typeof checklist.strategyName === 'string' &&
      checklist.strategyName.trim().length > 0 &&
      (
        checklist.status === 'READY_FOR_FIRST_PAPER_SESSION' ||
        checklist.status === 'WARMUP_REQUIRED' ||
        checklist.status === 'SESSION_LIMIT_REACHED' ||
        checklist.status === 'SESSION_BLOCKED'
      ) &&
      typeof checklist.text === 'string' &&
      typeof checklist.json === 'object' &&
      checklist.json !== null &&
      Array.isArray(checklist.json.checklist) &&
      Array.isArray(checklist.json.blockers) &&
      Array.isArray(checklist.json.warnings) &&
      checklist.operatorDecisionRequired === true &&
      checklist.supervisedRecommendationOnly === true &&
      checklist.institutionalAnalysisMode === true &&
      checklist.json.governance.operatorDecisionRequired === true &&
      checklist.json.governance.supervisedRecommendationOnly === true &&
      checklist.json.governance.institutionalAnalysisMode === true
    );
  }

  private steps(checklist: FirstPaperSessionChecklistExportReport): readonly FirstPaperSessionRunbookStep[] {
    const steps: FirstPaperSessionRunbookStep[] = [
      this.step(1, 'PRE_SESSION', 'Confirmar modo operacional', 'Confirmar que o operador fará apenas observação manual e registro PAPER.', 'Confirmações do protocolo sem blockers operacionais.', true),
      this.step(2, 'PRE_SESSION', 'Abrir plataforma real apenas para observação', 'Abrir a mesa na plataforma real sem integração externa com o RL.SYS CORE.', 'Plataforma visível e RL.SYS recebendo apenas dados informados pelo operador.', true),
      this.step(3, 'WARMUP', 'Executar warmup mínimo', `Observar pelo menos ${checklist.json.warmup.minWarmupRounds} giros antes de considerar sessão PAPER.`, `${checklist.json.warmup.observedRounds}/${checklist.json.warmup.minWarmupRounds} giros observados.`, true),
      this.step(4, 'OBSERVATION', 'Registrar giros manualmente', 'Inserir cada giro observado no fluxo operacional do RL.SYS CORE.', 'Timeline por giro registrada na sessão CLI.', true),
      this.step(5, 'RECOMMENDATION', 'Ler recomendação supervisionada', 'Para cada giro, considerar apenas FAVORAVEL, AGUARDAR ou NAO_UTILIZAR conforme apresentado ao operador.', 'Mensagem operacional com status, confiança, risco e explicação.', true),
      this.step(6, 'PAPER_TRACKING', 'Registrar decisão PAPER', 'Registrar se o operador considerou a recomendação em modo PAPER, sem execução externa pelo sistema.', 'Registro PAPER manual da decisão do operador.', true),
      this.step(7, 'SHUTDOWN', 'Encerrar por blockers ou limite', 'Encerrar se blockers aparecerem, risco elevado dominar ou limite operacional for atingido.', 'Sessão finalizada com motivo rastreável.', true),
      this.step(8, 'EXPORT', 'Exportar relatório final', 'Exportar checklist, relatório da sessão e recomendações em TEXT/JSON.', 'Artefatos TEXT/JSON gerados para auditoria.', true),
    ];

    if (checklist.json.blockers.length > 0) {
      steps.unshift(this.step(0, 'PRE_SESSION', 'Resolver blockers antes de iniciar', 'Não iniciar a sessão PAPER enquanto houver blockers no protocolo.', checklist.json.blockers.join('; '), true));
      return Object.freeze(steps.map((step, index) => Object.freeze({ ...step, stepNumber: index + 1 })));
    }

    if (checklist.json.warnings.length > 0) {
      steps.push(this.step(9, 'PRE_SESSION', 'Revisar warnings operacionais', 'Revisar avisos antes de iniciar ou continuar a sessão PAPER.', checklist.json.warnings.join('; '), false));
    }

    return Object.freeze(steps);
  }

  private step(
    stepNumber: number,
    phase: FirstPaperSessionRunbookPhase,
    title: string,
    instruction: string,
    expectedEvidence: string,
    mandatory: boolean,
  ): FirstPaperSessionRunbookStep {
    return Object.freeze({
      stepNumber,
      phase,
      title,
      instruction,
      expectedEvidence,
      mandatory,
    });
  }

  private summary(checklist: FirstPaperSessionChecklistExportReport): string {
    if (checklist.status === 'READY_FOR_FIRST_PAPER_SESSION') {
      return `${checklist.strategyName}: runbook pronto para primeira sessão PAPER supervisionada.`;
    }

    if (checklist.status === 'WARMUP_REQUIRED') {
      return `${checklist.strategyName}: runbook gerado, mas warmup ainda é obrigatório antes da sessão.`;
    }

    if (checklist.status === 'SESSION_LIMIT_REACHED') {
      return `${checklist.strategyName}: runbook orienta encerramento e exportação da sessão.`;
    }

    return `${checklist.strategyName}: runbook gerado em estado bloqueado; resolver blockers antes de iniciar.`;
  }

  private render(report: Omit<FirstPaperSessionRunbookReport, 'renderedText'>): string {
    const lines: string[] = [
      'RL.SYS CORE — FIRST PAPER SESSION RUNBOOK',
      '========================================',
      `Runbook ID: ${report.runbookId}`,
      `Generated At Epoch Ms: ${report.generatedAtEpochMs}`,
      `Session ID: ${report.sessionId}`,
      `Strategy: ${report.strategyName}`,
      `Protocol Status: ${report.protocolStatus}`,
      `Can Start PAPER Session: ${report.canStartPaperSession}`,
      '',
      'OPERATOR SUMMARY',
      '----------------',
      report.operatorSummary,
      '',
      'RUNBOOK STEPS',
      '-------------',
    ];

    for (const step of report.steps) {
      lines.push(
        `${step.stepNumber}. [${step.phase}] ${step.title}`,
        `   Instruction: ${step.instruction}`,
        `   Expected Evidence: ${step.expectedEvidence}`,
        `   Mandatory: ${step.mandatory}`,
      );
    }

    lines.push('', 'BLOCKERS', '--------');
    lines.push(...this.listOrNone(report.blockers));

    lines.push('', 'WARNINGS', '--------');
    lines.push(...this.listOrNone(report.warnings));

    lines.push(
      '',
      'GOVERNANCE',
      '----------',
      'Operator Decision Required: true',
      'Supervised Recommendation Only: true',
      'Institutional Analysis Mode: true',
    );

    return lines.join('\n');
  }

  private listOrNone(items: readonly string[]): readonly string[] {
    if (items.length === 0) {
      return Object.freeze(['None']);
    }

    return Object.freeze(items.map((item, index) => `${index + 1}. ${item}`));
  }

  private failure(message: string): FirstPaperSessionRunbookComposerFailure {
    return Object.freeze({
      code: 'INVALID_FIRST_PAPER_SESSION_RUNBOOK_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
