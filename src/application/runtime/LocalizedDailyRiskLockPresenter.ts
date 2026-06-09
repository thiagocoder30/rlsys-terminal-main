import type {
  DailyRiskLockOperationalGateReport,
} from './DailyRiskLockOperationalGateIntegration.js';

export type LocalizedDailyRiskLockPresenterStatus =
  | 'PRESENTATION_BLOCKED'
  | 'PRESENTATION_ALLOWED'
  | 'PRESENTATION_INFORMATIONAL_LOCK';

export interface LocalizedDailyRiskLockPresenterInput {
  readonly presentationId: string;
  readonly generatedAtEpochMs: number;
  readonly gate: DailyRiskLockOperationalGateReport;
}

export interface LocalizedDailyRiskLockPresenterReport {
  readonly presentationId: string;
  readonly generatedAtEpochMs: number;
  readonly status: LocalizedDailyRiskLockPresenterStatus;
  readonly title: string;
  readonly subtitle: string;
  readonly mainMessage: string;
  readonly reasonLabel: string;
  readonly actionLabel: string;
  readonly unlockAtEpochMs: number | null;
  readonly renderedText: string;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly institutionalAnalysisMode: true;
}

export interface LocalizedDailyRiskLockPresenterFailure {
  readonly code: 'INVALID_LOCALIZED_DAILY_RISK_LOCK_PRESENTER_INPUT';
  readonly stage: 'VALIDATION';
  readonly message: string;
}

export type LocalizedDailyRiskLockPresenterResult =
  | { readonly ok: true; readonly value: LocalizedDailyRiskLockPresenterReport }
  | { readonly ok: false; readonly error: LocalizedDailyRiskLockPresenterFailure };

/**
 * Presents Daily Risk Lock operational gate results in operator-friendly pt-BR.
 *
 * This presenter does not evaluate risk, does not persist locks and does not
 * decide runtime behavior. It only converts existing gate results into readable
 * operator-facing text.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class LocalizedDailyRiskLockPresenter {
  public present(input: LocalizedDailyRiskLockPresenterInput): LocalizedDailyRiskLockPresenterResult {
    const validationFailure = this.validate(input);
    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }

    const report = this.compose(input);

    return {
      ok: true,
      value: Object.freeze({
        ...report,
        renderedText: this.render(report),
      }),
    };
  }

  private validate(
    input: LocalizedDailyRiskLockPresenterInput,
  ): LocalizedDailyRiskLockPresenterFailure | null {
    if (typeof input.presentationId !== 'string' || input.presentationId.trim().length === 0) {
      return this.failure('presentationId is required');
    }

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.failure('generatedAtEpochMs must be a positive finite number');
    }

    if (!this.isValidGate(input.gate)) {
      return this.failure('gate is invalid or violates supervised recommendation semantics');
    }

    return null;
  }

  private isValidGate(gate: DailyRiskLockOperationalGateReport): boolean {
    return (
      typeof gate === 'object' &&
      gate !== null &&
      (
        gate.status === 'OPERATION_ALLOWED' ||
        gate.status === 'OPERATION_BLOCKED_BY_DAILY_RISK_LOCK'
      ) &&
      typeof gate.allowed === 'boolean' &&
      typeof gate.intent === 'string' &&
      typeof gate.recoveryStatus === 'string' &&
      typeof gate.isDailyRiskLocked === 'boolean' &&
      (
        gate.lockReason === null ||
        gate.lockReason === 'STOP_WIN_REACHED' ||
        gate.lockReason === 'STOP_LOSS_REACHED' ||
        gate.lockReason === 'BANKROLL_BLOCKED'
      ) &&
      (gate.unlockAtEpochMs === null || Number.isFinite(gate.unlockAtEpochMs)) &&
      typeof gate.operatorSummary === 'string' &&
      Array.isArray(gate.reasons) &&
      gate.operatorDecisionRequired === true &&
      gate.supervisedRecommendationOnly === true &&
      gate.institutionalAnalysisMode === true
    );
  }

  private compose(
    input: LocalizedDailyRiskLockPresenterInput,
  ): Omit<LocalizedDailyRiskLockPresenterReport, 'renderedText'> {
    const gate = input.gate;

    if (!gate.allowed) {
      return Object.freeze({
        presentationId: input.presentationId.trim(),
        generatedAtEpochMs: input.generatedAtEpochMs,
        status: 'PRESENTATION_BLOCKED',
        title: 'Sessão PAPER bloqueada',
        subtitle: 'Trava diária de banca ativa',
        mainMessage: this.blockedMessage(gate),
        reasonLabel: this.reasonLabel(gate.lockReason),
        actionLabel: 'Não iniciar nova sessão PAPER. Aguarde o desbloqueio diário.',
        unlockAtEpochMs: gate.unlockAtEpochMs,
        operatorDecisionRequired: true,
        supervisedRecommendationOnly: true,
        institutionalAnalysisMode: true,
      });
    }

    if (gate.isDailyRiskLocked) {
      return Object.freeze({
        presentationId: input.presentationId.trim(),
        generatedAtEpochMs: input.generatedAtEpochMs,
        status: 'PRESENTATION_INFORMATIONAL_LOCK',
        title: 'Trava diária ativa',
        subtitle: 'Comando informativo permitido',
        mainMessage: 'A trava diária ainda está ativa, mas este comando é apenas informativo e pode ser exibido ao operador.',
        reasonLabel: this.reasonLabel(gate.lockReason),
        actionLabel: 'Consultar status, relatório ou encerramento. Não iniciar nova sessão.',
        unlockAtEpochMs: gate.unlockAtEpochMs,
        operatorDecisionRequired: true,
        supervisedRecommendationOnly: true,
        institutionalAnalysisMode: true,
      });
    }

    return Object.freeze({
      presentationId: input.presentationId.trim(),
      generatedAtEpochMs: input.generatedAtEpochMs,
      status: 'PRESENTATION_ALLOWED',
      title: 'Operação permitida',
      subtitle: 'Nenhuma trava diária de banca bloqueando a sessão',
      mainMessage: 'A operação pode seguir para nova avaliação institucional.',
      reasonLabel: 'Sem bloqueio diário ativo',
      actionLabel: 'Prosseguir somente se os demais gates institucionais também aprovarem.',
      unlockAtEpochMs: gate.unlockAtEpochMs,
      operatorDecisionRequired: true,
      supervisedRecommendationOnly: true,
      institutionalAnalysisMode: true,
    });
  }

  private blockedMessage(gate: DailyRiskLockOperationalGateReport): string {
    if (gate.lockReason === 'STOP_WIN_REACHED') {
      return 'Stop Win diário atingido. O lucro deve ser preservado e novas entradas ficam bloqueadas.';
    }

    if (gate.lockReason === 'STOP_LOSS_REACHED') {
      return 'Stop Loss diário atingido. A banca deve ser protegida e novas entradas ficam bloqueadas.';
    }

    return 'Controle diário de banca bloqueou a operação. Novas entradas ficam impedidas até o desbloqueio.';
  }

  private reasonLabel(reason: DailyRiskLockOperationalGateReport['lockReason']): string {
    if (reason === 'STOP_WIN_REACHED') {
      return 'Stop Win diário atingido';
    }

    if (reason === 'STOP_LOSS_REACHED') {
      return 'Stop Loss diário atingido';
    }

    if (reason === 'BANKROLL_BLOCKED') {
      return 'Bloqueio diário de banca';
    }

    return 'Sem motivo de bloqueio ativo';
  }

  private render(report: Omit<LocalizedDailyRiskLockPresenterReport, 'renderedText'>): string {
    const unlockLine = report.unlockAtEpochMs === null
      ? 'Desbloqueio: não aplicável'
      : `Desbloqueio: ${report.unlockAtEpochMs}`;

    return [
      'RL.SYS CORE — TRAVA DIÁRIA DE BANCA',
      '===================================',
      `Status: ${report.title}`,
      `Detalhe: ${report.subtitle}`,
      '',
      'Motivo:',
      report.reasonLabel,
      '',
      'Mensagem:',
      report.mainMessage,
      '',
      'Ação recomendada:',
      report.actionLabel,
      '',
      unlockLine,
      '',
      'Governança:',
      'Decisão final do operador: obrigatória',
      'Recomendação supervisionada: sim',
      'Modo institucional PAPER: sim',
    ].join('\n');
  }

  private failure(message: string): LocalizedDailyRiskLockPresenterFailure {
    return Object.freeze({
      code: 'INVALID_LOCALIZED_DAILY_RISK_LOCK_PRESENTER_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
