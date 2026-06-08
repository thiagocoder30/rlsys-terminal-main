import type {
  FirstPaperSessionExecutionBundleReport,
  FirstPaperSessionExecutionBundleStatus,
} from './FirstPaperSessionExecutionBundle.js';

export type OperatorGuidedSessionPhase =
  | 'PRECHECK'
  | 'START'
  | 'WARMUP'
  | 'LIVE_OBSERVATION'
  | 'PER_SPIN_RECOMMENDATION'
  | 'PAPER_DECISION_LOG'
  | 'STOP_CONDITION'
  | 'EXPORT_AND_REVIEW';

export type OperatorGuidedSessionPackageStatus =
  | 'GUIDED_PACKAGE_READY'
  | 'GUIDED_PACKAGE_WARMUP_REQUIRED'
  | 'GUIDED_PACKAGE_BLOCKED'
  | 'GUIDED_PACKAGE_SESSION_LIMIT_REACHED';

export interface OperatorGuidedSessionInstruction {
  readonly order: number;
  readonly phase: OperatorGuidedSessionPhase;
  readonly title: string;
  readonly operatorAction: string;
  readonly systemExpectation: string;
  readonly completionSignal: string;
  readonly mandatory: boolean;
}

export interface OperatorGuidedSessionPackageInput {
  readonly packageId: string;
  readonly generatedAtEpochMs: number;
  readonly bundle: FirstPaperSessionExecutionBundleReport;
}

export interface OperatorGuidedSessionPackageReport {
  readonly packageId: string;
  readonly generatedAtEpochMs: number;
  readonly bundleId: string;
  readonly sessionId: string;
  readonly strategyName: string;
  readonly status: OperatorGuidedSessionPackageStatus;
  readonly canStartPaperSession: boolean;
  readonly bundleStatus: FirstPaperSessionExecutionBundleStatus;
  readonly instructions: readonly OperatorGuidedSessionInstruction[];
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly operatorSummary: string;
  readonly renderedText: string;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly institutionalAnalysisMode: true;
}

export interface OperatorGuidedSessionPackageFailure {
  readonly code: 'INVALID_OPERATOR_GUIDED_SESSION_PACKAGE_INPUT';
  readonly stage: 'VALIDATION';
  readonly message: string;
}

export type OperatorGuidedSessionPackageResult =
  | { readonly ok: true; readonly value: OperatorGuidedSessionPackageReport }
  | { readonly ok: false; readonly error: OperatorGuidedSessionPackageFailure };

/**
 * Converts the first PAPER session execution bundle into an operator-guided package.
 *
 * This package does not evaluate strategy, protocol or risk. It gives the human
 * operator a deterministic sequence to start, observe, log, stop and export the
 * first supervised PAPER session.
 *
 * Complexity:
 * - Time: O(n), where n is bundle checklist + blockers + warnings.
 * - Space: O(n), because instructions and rendered text are materialized.
 */
export class OperatorGuidedSessionPackage {
  public compose(input: OperatorGuidedSessionPackageInput): OperatorGuidedSessionPackageResult {
    const validationFailure = this.validate(input);
    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }

    const instructions = this.instructions(input.bundle);
    const status = this.status(input.bundle.status);
    const report: Omit<OperatorGuidedSessionPackageReport, 'renderedText'> = Object.freeze({
      packageId: input.packageId.trim(),
      generatedAtEpochMs: input.generatedAtEpochMs,
      bundleId: input.bundle.bundleId,
      sessionId: input.bundle.sessionId,
      strategyName: input.bundle.strategyName,
      status,
      canStartPaperSession: input.bundle.canStartPaperSession && status === 'GUIDED_PACKAGE_READY',
      bundleStatus: input.bundle.status,
      instructions: Object.freeze(instructions),
      blockers: Object.freeze([...input.bundle.blockers]),
      warnings: Object.freeze([...input.bundle.warnings]),
      operatorSummary: this.summary(status, input.bundle.strategyName, input.bundle.blockers.length, input.bundle.warnings.length),
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

  private validate(input: OperatorGuidedSessionPackageInput): OperatorGuidedSessionPackageFailure | null {
    if (typeof input.packageId !== 'string' || input.packageId.trim().length === 0) {
      return this.failure('packageId is required');
    }

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.failure('generatedAtEpochMs must be a positive finite number');
    }

    if (!this.isValidBundle(input.bundle)) {
      return this.failure('bundle is invalid or violates supervised recommendation semantics');
    }

    return null;
  }

  private isValidBundle(bundle: FirstPaperSessionExecutionBundleReport): boolean {
    return (
      typeof bundle === 'object' &&
      bundle !== null &&
      typeof bundle.bundleId === 'string' &&
      bundle.bundleId.trim().length > 0 &&
      typeof bundle.sessionId === 'string' &&
      bundle.sessionId.trim().length > 0 &&
      typeof bundle.strategyName === 'string' &&
      bundle.strategyName.trim().length > 0 &&
      (
        bundle.status === 'BUNDLE_READY' ||
        bundle.status === 'BUNDLE_WARMUP_REQUIRED' ||
        bundle.status === 'BUNDLE_BLOCKED' ||
        bundle.status === 'BUNDLE_SESSION_LIMIT_REACHED'
      ) &&
      typeof bundle.canStartPaperSession === 'boolean' &&
      Array.isArray(bundle.operatorReadinessChecklist) &&
      Array.isArray(bundle.blockers) &&
      Array.isArray(bundle.warnings) &&
      bundle.operatorDecisionRequired === true &&
      bundle.supervisedRecommendationOnly === true &&
      bundle.institutionalAnalysisMode === true
    );
  }

  private status(bundleStatus: FirstPaperSessionExecutionBundleStatus): OperatorGuidedSessionPackageStatus {
    if (bundleStatus === 'BUNDLE_READY') {
      return 'GUIDED_PACKAGE_READY';
    }

    if (bundleStatus === 'BUNDLE_WARMUP_REQUIRED') {
      return 'GUIDED_PACKAGE_WARMUP_REQUIRED';
    }

    if (bundleStatus === 'BUNDLE_SESSION_LIMIT_REACHED') {
      return 'GUIDED_PACKAGE_SESSION_LIMIT_REACHED';
    }

    return 'GUIDED_PACKAGE_BLOCKED';
  }

  private instructions(bundle: FirstPaperSessionExecutionBundleReport): readonly OperatorGuidedSessionInstruction[] {
    const base: OperatorGuidedSessionInstruction[] = [];

    if (bundle.blockers.length > 0) {
      base.push(this.instruction(
        1,
        'PRECHECK',
        'Resolver blockers antes de iniciar',
        'Não iniciar a sessão PAPER enquanto houver blockers ativos.',
        'Todos os blockers devem ser removidos ou justificados em nova avaliação.',
        bundle.blockers.join('; '),
        true,
      ));
    }

    base.push(
      this.instruction(
        base.length + 1,
        'PRECHECK',
        'Confirmar pacote operacional',
        'Verificar protocolo, checklist, runbook e bundle antes de abrir a mesa.',
        'Bundle validado e status revisado pelo operador.',
        `Bundle status: ${bundle.status}`,
        true,
      ),
      this.instruction(
        base.length + 2,
        'START',
        'Preparar sessão PAPER',
        'Abrir a plataforma real apenas para observação manual e preparar o RL.SYS CORE.',
        'Mesa visível e RL.SYS pronto para registrar giros manualmente.',
        'Operador confirmou observação manual.',
        true,
      ),
      this.instruction(
        base.length + 3,
        'WARMUP',
        'Executar ou confirmar warmup',
        'Confirmar que o warmup mínimo foi cumprido antes de considerar recomendações.',
        'Warmup concluído conforme protocolo.',
        `Protocolo: ${bundle.protocolStatus}`,
        true,
      ),
      this.instruction(
        base.length + 4,
        'LIVE_OBSERVATION',
        'Registrar cada giro observado',
        'Inserir os resultados observados manualmente no fluxo operacional.',
        'Timeline por giro atualizada.',
        'Cada giro possui registro rastreável.',
        true,
      ),
      this.instruction(
        base.length + 5,
        'PER_SPIN_RECOMMENDATION',
        'Ler recomendação por giro',
        'Avaliar somente FAVORAVEL, AGUARDAR ou NAO_UTILIZAR apresentados pelo sistema.',
        'Recomendação exibida com confiança, risco e explicação.',
        'Operador compreendeu a recomendação.',
        true,
      ),
      this.instruction(
        base.length + 6,
        'PAPER_DECISION_LOG',
        'Registrar decisão PAPER do operador',
        'Registrar a decisão tomada em modo PAPER após cada recomendação.',
        'Decisão PAPER registrada sem integração externa.',
        'Registro PAPER salvo na sessão.',
        true,
      ),
      this.instruction(
        base.length + 7,
        'STOP_CONDITION',
        'Aplicar condições de parada',
        'Encerrar se blockers surgirem, risco elevado dominar ou limite operacional for atingido.',
        'Sessão encerrada com motivo rastreável.',
        bundle.blockers.length > 0 ? bundle.blockers.join('; ') : 'Sem blockers ativos no pacote.',
        true,
      ),
      this.instruction(
        base.length + 8,
        'EXPORT_AND_REVIEW',
        'Exportar e revisar artefatos',
        'Exportar relatórios TEXT/JSON, revisar o resumo e arquivar evidências.',
        'Artefatos exportados para auditoria.',
        'Checklist, runbook, bundle e sessão exportados.',
        true,
      ),
    );

    if (bundle.warnings.length > 0) {
      base.push(this.instruction(
        base.length + 1,
        'PRECHECK',
        'Revisar warnings antes da sessão',
        'Ler os warnings e decidir se a sessão ainda deve seguir em modo PAPER.',
        'Warnings revisados pelo operador.',
        bundle.warnings.join('; '),
        false,
      ));
    }

    return Object.freeze(base);
  }

  private instruction(
    order: number,
    phase: OperatorGuidedSessionPhase,
    title: string,
    operatorAction: string,
    systemExpectation: string,
    completionSignal: string,
    mandatory: boolean,
  ): OperatorGuidedSessionInstruction {
    return Object.freeze({
      order,
      phase,
      title,
      operatorAction,
      systemExpectation,
      completionSignal,
      mandatory,
    });
  }

  private summary(
    status: OperatorGuidedSessionPackageStatus,
    strategyName: string,
    blockerCount: number,
    warningCount: number,
  ): string {
    if (status === 'GUIDED_PACKAGE_READY') {
      return `${strategyName}: pacote guiado pronto para primeira sessão PAPER supervisionada. Warnings: ${warningCount}.`;
    }

    if (status === 'GUIDED_PACKAGE_WARMUP_REQUIRED') {
      return `${strategyName}: pacote guiado criado, mas warmup ainda é obrigatório. Blockers: ${blockerCount}.`;
    }

    if (status === 'GUIDED_PACKAGE_SESSION_LIMIT_REACHED') {
      return `${strategyName}: pacote guiado orienta encerramento e revisão da sessão.`;
    }

    return `${strategyName}: pacote guiado bloqueado para início. Blockers: ${blockerCount}.`;
  }

  private render(report: Omit<OperatorGuidedSessionPackageReport, 'renderedText'>): string {
    const lines: string[] = [
      'RL.SYS CORE — OPERATOR GUIDED SESSION PACKAGE',
      '============================================',
      `Package ID: ${report.packageId}`,
      `Bundle ID: ${report.bundleId}`,
      `Session ID: ${report.sessionId}`,
      `Strategy: ${report.strategyName}`,
      `Status: ${report.status}`,
      `Can Start PAPER Session: ${report.canStartPaperSession}`,
      '',
      'OPERATOR SUMMARY',
      '----------------',
      report.operatorSummary,
      '',
      'GUIDED INSTRUCTIONS',
      '-------------------',
    ];

    for (const item of report.instructions) {
      lines.push(
        `${item.order}. [${item.phase}] ${item.title}`,
        `   Operator Action: ${item.operatorAction}`,
        `   System Expectation: ${item.systemExpectation}`,
        `   Completion Signal: ${item.completionSignal}`,
        `   Mandatory: ${item.mandatory}`,
      );
    }

    lines.push('', 'BLOCKERS', '--------', ...this.listOrNone(report.blockers));
    lines.push('', 'WARNINGS', '--------', ...this.listOrNone(report.warnings));
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

  private failure(message: string): OperatorGuidedSessionPackageFailure {
    return Object.freeze({
      code: 'INVALID_OPERATOR_GUIDED_SESSION_PACKAGE_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
