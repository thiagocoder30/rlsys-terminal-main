export type InstitutionalPipelineDecision = 'PAPER_FAVORAVEL' | 'OBSERVAR' | 'NAO_UTILIZAR';

export type OperatorPresentationStatus = 'FAVORAVEL' | 'AGUARDAR' | 'NAO_UTILIZAR';

export type OperatorRiskLevel = 'CONTROLADO' | 'MODERADO' | 'ELEVADO';

export interface OperatorDecisionPresentationInput {
  readonly strategyName: string;
  readonly finalDecision: InstitutionalPipelineDecision;
  readonly confidenceScore?: number;
  readonly institutionalScore?: number;
  readonly riskScore?: number;
  readonly operatorSummary?: string;
  readonly reasons?: readonly string[];
  readonly warnings?: readonly string[];
  readonly blockers?: readonly string[];
  readonly currentRoundIndex?: number;
  readonly observedRounds?: number;
}

export interface OperatorDecisionPresentationReport {
  readonly strategyName: string;
  readonly status: OperatorPresentationStatus;
  readonly confidencePercent: number;
  readonly riskLevel: OperatorRiskLevel;
  readonly headline: string;
  readonly actionLabel:
    | 'CONSIDERAR_ENTRADA_MANUAL_SUPERVISIONADA'
    | 'AGUARDAR_NOVO_GIRO'
    | 'NAO_UTILIZAR_ESTRATEGIA_AGORA';
  readonly explanation: string;
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
  readonly blockers: readonly string[];
  readonly currentRoundIndex: number | null;
  readonly observedRounds: number | null;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly institutionalAnalysisMode: true;
}

export interface OperatorDecisionPresentationFailure {
  readonly code: 'INVALID_OPERATOR_PRESENTATION_INPUT';
  readonly stage: 'VALIDATION';
  readonly message: string;
}

export type OperatorDecisionPresentationResult =
  | { readonly ok: true; readonly value: OperatorDecisionPresentationReport }
  | { readonly ok: false; readonly error: OperatorDecisionPresentationFailure };

/**
 * Converts existing institutional pipeline decisions into a concise
 * operator-facing message for per-spin supervised use.
 *
 * This adapter does not create new intelligence. It presents the decision
 * already produced by the institutional pipeline/runtime adapter.
 *
 * Complexity:
 * - Time: O(n), where n is the number of reasons/warnings/blockers.
 * - Space: O(n), only for the operator-facing explanation arrays.
 */
export class OperatorDecisionPresentationAdapter {
  public present(input: OperatorDecisionPresentationInput): OperatorDecisionPresentationResult {
    const validationFailure = this.validate(input);
    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }

    const status = this.statusFromDecision(input.finalDecision);
    const confidencePercent = this.confidencePercent(input);
    const riskLevel = this.riskLevel(input.riskScore, input.blockers);
    const reasons = this.normalizeMessages(input.reasons, this.defaultReasons(status));
    const warnings = this.normalizeMessages(input.warnings, []);
    const blockers = this.normalizeMessages(input.blockers, []);

    return {
      ok: true,
      value: Object.freeze({
        strategyName: input.strategyName.trim(),
        status,
        confidencePercent,
        riskLevel,
        headline: this.headline(input.strategyName.trim(), status),
        actionLabel: this.actionLabel(status),
        explanation: this.explanation(input, status, confidencePercent, riskLevel, blockers),
        reasons: Object.freeze(reasons),
        warnings: Object.freeze(warnings),
        blockers: Object.freeze(blockers),
        currentRoundIndex: this.safeNullableInteger(input.currentRoundIndex),
        observedRounds: this.safeNullableInteger(input.observedRounds),
        operatorDecisionRequired: true,
        supervisedRecommendationOnly: true,
        institutionalAnalysisMode: true,
      }),
    };
  }

  private validate(
    input: OperatorDecisionPresentationInput,
  ): OperatorDecisionPresentationFailure | null {
    if (typeof input.strategyName !== 'string' || input.strategyName.trim().length === 0) {
      return this.failure('strategyName is required');
    }

    if (
      input.finalDecision !== 'PAPER_FAVORAVEL' &&
      input.finalDecision !== 'OBSERVAR' &&
      input.finalDecision !== 'NAO_UTILIZAR'
    ) {
      return this.failure('finalDecision must be PAPER_FAVORAVEL, OBSERVAR or NAO_UTILIZAR');
    }

    if (!this.isOptionalFinite(input.confidenceScore)) {
      return this.failure('confidenceScore must be finite when provided');
    }

    if (!this.isOptionalFinite(input.institutionalScore)) {
      return this.failure('institutionalScore must be finite when provided');
    }

    if (!this.isOptionalFinite(input.riskScore)) {
      return this.failure('riskScore must be finite when provided');
    }

    return null;
  }

  private statusFromDecision(decision: InstitutionalPipelineDecision): OperatorPresentationStatus {
    if (decision === 'PAPER_FAVORAVEL') {
      return 'FAVORAVEL';
    }

    if (decision === 'OBSERVAR') {
      return 'AGUARDAR';
    }

    return 'NAO_UTILIZAR';
  }

  private confidencePercent(input: OperatorDecisionPresentationInput): number {
    const source =
      typeof input.confidenceScore === 'number'
        ? input.confidenceScore
        : typeof input.institutionalScore === 'number'
          ? input.institutionalScore
          : this.defaultConfidence(input.finalDecision);

    if (source <= 1) {
      return this.clampPercent(Math.round(source * 100));
    }

    return this.clampPercent(Math.round(source));
  }

  private defaultConfidence(decision: InstitutionalPipelineDecision): number {
    if (decision === 'PAPER_FAVORAVEL') {
      return 0.78;
    }

    if (decision === 'OBSERVAR') {
      return 0.5;
    }

    return 0.28;
  }

  private riskLevel(riskScore: number | undefined, blockers: readonly string[] | undefined): OperatorRiskLevel {
    if (Array.isArray(blockers) && blockers.length > 0) {
      return 'ELEVADO';
    }

    if (typeof riskScore !== 'number') {
      return 'MODERADO';
    }

    const normalized = riskScore <= 1 ? riskScore : riskScore / 100;

    if (normalized >= 0.67) {
      return 'ELEVADO';
    }

    if (normalized >= 0.34) {
      return 'MODERADO';
    }

    return 'CONTROLADO';
  }

  private headline(strategyName: string, status: OperatorPresentationStatus): string {
    if (status === 'FAVORAVEL') {
      return `${strategyName}: contexto favorável para considerar entrada manual supervisionada.`;
    }

    if (status === 'AGUARDAR') {
      return `${strategyName}: aguardar novo giro antes de qualquer decisão.`;
    }

    return `${strategyName}: não utilizar a estratégia no contexto atual.`;
  }

  private actionLabel(status: OperatorPresentationStatus): OperatorDecisionPresentationReport['actionLabel'] {
    if (status === 'FAVORAVEL') {
      return 'CONSIDERAR_ENTRADA_MANUAL_SUPERVISIONADA';
    }

    if (status === 'AGUARDAR') {
      return 'AGUARDAR_NOVO_GIRO';
    }

    return 'NAO_UTILIZAR_ESTRATEGIA_AGORA';
  }

  private explanation(
    input: OperatorDecisionPresentationInput,
    status: OperatorPresentationStatus,
    confidencePercent: number,
    riskLevel: OperatorRiskLevel,
    blockers: readonly string[],
  ): string {
    if (typeof input.operatorSummary === 'string' && input.operatorSummary.trim().length > 0) {
      return input.operatorSummary.trim();
    }

    if (status === 'FAVORAVEL') {
      return `A leitura institucional indica contexto favorável, confiança de ${confidencePercent}% e risco ${riskLevel.toLowerCase()}. A decisão final continua com o operador.`;
    }

    if (status === 'AGUARDAR') {
      return `A leitura institucional ainda não confirmou vantagem contextual suficiente. Confiança atual: ${confidencePercent}%. Risco: ${riskLevel.toLowerCase()}.`;
    }

    if (blockers.length > 0) {
      return `A leitura institucional bloqueou o uso da estratégia neste momento por fatores críticos: ${blockers.join('; ')}.`;
    }

    return `A leitura institucional não recomenda utilizar a estratégia no contexto atual. Confiança atual: ${confidencePercent}%. Risco: ${riskLevel.toLowerCase()}.`;
  }

  private defaultReasons(status: OperatorPresentationStatus): readonly string[] {
    if (status === 'FAVORAVEL') {
      return [
        'DECISAO_INSTITUCIONAL_FAVORAVEL',
        'CONTEXTO_COMPATIVEL_COM_RECOMENDACAO_SUPERVISIONADA',
      ];
    }

    if (status === 'AGUARDAR') {
      return [
        'CONFIRMACAO_CONTEXTUAL_INSUFICIENTE',
        'AGUARDAR_NOVO_GIRO_PARA_REAVALIACAO',
      ];
    }

    return [
      'CONTEXTO_ATUAL_NAO_QUALIFICADO',
      'PROTECAO_OPERACIONAL_PRIORIZADA',
    ];
  }

  private normalizeMessages(
    provided: readonly string[] | undefined,
    fallback: readonly string[],
  ): readonly string[] {
    const source = Array.isArray(provided) && provided.length > 0 ? provided : fallback;
    const normalized: string[] = [];

    for (const message of source) {
      if (typeof message === 'string') {
        const trimmed = message.trim();
        if (trimmed.length > 0) {
          normalized.push(trimmed);
        }
      }
    }

    return normalized;
  }

  private isOptionalFinite(value: number | undefined): boolean {
    return typeof value === 'undefined' || Number.isFinite(value);
  }

  private safeNullableInteger(value: number | undefined): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    return Math.trunc(value);
  }

  private clampPercent(value: number): number {
    if (value < 0) {
      return 0;
    }

    if (value > 100) {
      return 100;
    }

    return value;
  }

  private failure(message: string): OperatorDecisionPresentationFailure {
    return Object.freeze({
      code: 'INVALID_OPERATOR_PRESENTATION_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
