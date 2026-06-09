export type OperatorHudRecommendation = 'ENTRAR' | 'AGUARDAR';
export type OperatorSupervisionDecision = 'CONFIRMAR' | 'RECUSAR';
export type OperatorEntrySupervisionStatus =
  | 'PAPER_ENTRY_AUTHORIZED'
  | 'PAPER_ENTRY_REJECTED_BY_OPERATOR'
  | 'PAPER_ENTRY_DENIED_BY_HUD';

export interface OperatorEntrySupervisionInput {
  readonly supervisionId: string;
  readonly generatedAtEpochMs: number;
  readonly sessionId: string;
  readonly strategyName: string;
  readonly hudRecommendation: OperatorHudRecommendation;
  readonly hudRenderedText: string;
  readonly operatorDecision: OperatorSupervisionDecision;
  readonly operatorNote?: string;
  readonly requestedStake: number;
  readonly confidencePercent: number;
  readonly evidence: readonly string[];
}

export interface OperatorEntrySupervisionReport {
  readonly supervisionId: string;
  readonly generatedAtEpochMs: number;
  readonly sessionId: string;
  readonly strategyName: string;
  readonly status: OperatorEntrySupervisionStatus;
  readonly paperEntryAuthorized: boolean;
  readonly hudRecommendation: OperatorHudRecommendation;
  readonly operatorDecision: OperatorSupervisionDecision;
  readonly operatorNote: string | null;
  readonly requestedStake: number;
  readonly authorizedStake: number;
  readonly confidencePercent: number;
  readonly evidence: readonly string[];
  readonly auditSummary: string;
  readonly renderedText: string;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly institutionalAnalysisMode: true;
  readonly paperOnly: true;
}

export interface OperatorEntrySupervisionFailure {
  readonly code: 'INVALID_OPERATOR_ENTRY_SUPERVISION_INPUT';
  readonly stage: 'VALIDATION';
  readonly message: string;
}

export type OperatorEntrySupervisionResult =
  | { readonly ok: true; readonly value: OperatorEntrySupervisionReport }
  | { readonly ok: false; readonly error: OperatorEntrySupervisionFailure };

/**
 * Registers the operator-supervised PAPER entry decision after HUD presentation.
 *
 * This controller does not click, bet, automate, integrate with casino APIs or
 * execute money operations. It only records whether the human operator confirmed
 * or rejected a HUD recommendation in PAPER mode.
 *
 * Complexity:
 * - Time: O(n), where n is evidence length.
 * - Space: O(n), because evidence is copied into the audit report.
 */
export class OperatorEntrySupervisionController {
  public supervise(input: OperatorEntrySupervisionInput): OperatorEntrySupervisionResult {
    const validationFailure = this.validate(input);
    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }

    const status = this.status(input.hudRecommendation, input.operatorDecision);
    const paperEntryAuthorized = status === 'PAPER_ENTRY_AUTHORIZED';
    const authorizedStake = paperEntryAuthorized ? this.roundMoney(input.requestedStake) : 0;

    const report: Omit<OperatorEntrySupervisionReport, 'renderedText'> = Object.freeze({
      supervisionId: input.supervisionId.trim(),
      generatedAtEpochMs: input.generatedAtEpochMs,
      sessionId: input.sessionId.trim(),
      strategyName: input.strategyName.trim(),
      status,
      paperEntryAuthorized,
      hudRecommendation: input.hudRecommendation,
      operatorDecision: input.operatorDecision,
      operatorNote: this.optionalText(input.operatorNote),
      requestedStake: this.roundMoney(input.requestedStake),
      authorizedStake,
      confidencePercent: this.roundMoney(input.confidencePercent),
      evidence: Object.freeze([...input.evidence]),
      auditSummary: this.summary(status, input.strategyName.trim()),
      operatorDecisionRequired: true,
      supervisedRecommendationOnly: true,
      institutionalAnalysisMode: true,
      paperOnly: true,
    });

    return {
      ok: true,
      value: Object.freeze({
        ...report,
        renderedText: this.render(report),
      }),
    };
  }

  private validate(input: OperatorEntrySupervisionInput): OperatorEntrySupervisionFailure | null {
    if (typeof input.supervisionId !== 'string' || input.supervisionId.trim().length === 0) {
      return this.failure('supervisionId is required');
    }

    if (!Number.isFinite(input.generatedAtEpochMs) || input.generatedAtEpochMs <= 0) {
      return this.failure('generatedAtEpochMs must be a positive finite number');
    }

    if (typeof input.sessionId !== 'string' || input.sessionId.trim().length === 0) {
      return this.failure('sessionId is required');
    }

    if (typeof input.strategyName !== 'string' || input.strategyName.trim().length === 0) {
      return this.failure('strategyName is required');
    }

    if (input.hudRecommendation !== 'ENTRAR' && input.hudRecommendation !== 'AGUARDAR') {
      return this.failure('hudRecommendation must be ENTRAR or AGUARDAR');
    }

    if (typeof input.hudRenderedText !== 'string' || input.hudRenderedText.trim().length === 0) {
      return this.failure('hudRenderedText is required');
    }

    if (input.operatorDecision !== 'CONFIRMAR' && input.operatorDecision !== 'RECUSAR') {
      return this.failure('operatorDecision must be CONFIRMAR or RECUSAR');
    }

    if (!Number.isFinite(input.requestedStake) || input.requestedStake <= 0) {
      return this.failure('requestedStake must be a positive finite number');
    }

    if (!Number.isFinite(input.confidencePercent) || input.confidencePercent < 0 || input.confidencePercent > 100) {
      return this.failure('confidencePercent must be between 0 and 100');
    }

    if (!Array.isArray(input.evidence)) {
      return this.failure('evidence must be an array');
    }

    for (let index = 0; index < input.evidence.length; index += 1) {
      if (typeof input.evidence[index] !== 'string' || input.evidence[index].trim().length === 0) {
        return this.failure(`evidence at index ${index} must be a non-empty string`);
      }
    }

    return null;
  }

  private status(
    hudRecommendation: OperatorHudRecommendation,
    operatorDecision: OperatorSupervisionDecision,
  ): OperatorEntrySupervisionStatus {
    if (hudRecommendation === 'AGUARDAR') {
      return 'PAPER_ENTRY_DENIED_BY_HUD';
    }

    if (operatorDecision === 'RECUSAR') {
      return 'PAPER_ENTRY_REJECTED_BY_OPERATOR';
    }

    return 'PAPER_ENTRY_AUTHORIZED';
  }

  private summary(status: OperatorEntrySupervisionStatus, strategyName: string): string {
    if (status === 'PAPER_ENTRY_AUTHORIZED') {
      return `${strategyName}: entrada PAPER autorizada pelo operador após HUD favorável.`;
    }

    if (status === 'PAPER_ENTRY_REJECTED_BY_OPERATOR') {
      return `${strategyName}: operador recusou a recomendação favorável; nenhuma entrada PAPER autorizada.`;
    }

    return `${strategyName}: HUD indicou AGUARDAR; entrada PAPER negada.`;
  }

  private render(report: Omit<OperatorEntrySupervisionReport, 'renderedText'>): string {
    return [
      'RL.SYS CORE — OPERATOR ENTRY SUPERVISION',
      '========================================',
      `Supervision ID: ${report.supervisionId}`,
      `Session ID: ${report.sessionId}`,
      `Strategy: ${report.strategyName}`,
      `Status: ${report.status}`,
      `PAPER Entry Authorized: ${report.paperEntryAuthorized}`,
      `HUD Recommendation: ${report.hudRecommendation}`,
      `Operator Decision: ${report.operatorDecision}`,
      `Requested Stake: R$ ${report.requestedStake.toFixed(2)}`,
      `Authorized Stake: R$ ${report.authorizedStake.toFixed(2)}`,
      `Confidence: ${report.confidencePercent.toFixed(2)}%`,
      '',
      'Resumo:',
      report.auditSummary,
      '',
      'Governança:',
      'PAPER only: true',
      'Execução automática: false',
      'Decisão final do operador: obrigatória',
    ].join('\n');
  }

  private optionalText(value: string | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private failure(message: string): OperatorEntrySupervisionFailure {
    return Object.freeze({
      code: 'INVALID_OPERATOR_ENTRY_SUPERVISION_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
