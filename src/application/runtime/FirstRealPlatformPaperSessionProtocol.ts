export type FirstPaperSessionStatus =
  | 'READY_FOR_FIRST_PAPER_SESSION'
  | 'WARMUP_REQUIRED'
  | 'SESSION_LIMIT_REACHED'
  | 'SESSION_BLOCKED';

export interface FirstRealPlatformPaperSessionProtocolConfig {
  readonly minWarmupRounds: number;
  readonly maxObservedRounds: number;
  readonly maxFavorableRecommendations: number;
  readonly maxElevatedRiskRecommendations: number;
  readonly minAverageConfidencePercent: number;
}

export interface FirstRealPlatformPaperSessionProtocolInput {
  readonly sessionId: string;
  readonly strategyName: string;
  readonly observedRounds: number;
  readonly favorableCount: number;
  readonly waitCount: number;
  readonly noUseCount: number;
  readonly elevatedRiskCount: number;
  readonly averageConfidencePercent: number;
  readonly operatorConfirmedManualMode: boolean;
  readonly operatorConfirmedNoExternalIntegration: boolean;
  readonly operatorConfirmedPaperTracking: boolean;
  readonly config?: Partial<FirstRealPlatformPaperSessionProtocolConfig>;
}

export interface FirstRealPlatformPaperSessionProtocolReport {
  readonly sessionId: string;
  readonly strategyName: string;
  readonly status: FirstPaperSessionStatus;
  readonly canStartPaperSession: boolean;
  readonly warmupComplete: boolean;
  readonly observedRounds: number;
  readonly minWarmupRounds: number;
  readonly maxObservedRounds: number;
  readonly favorableCount: number;
  readonly waitCount: number;
  readonly noUseCount: number;
  readonly elevatedRiskCount: number;
  readonly averageConfidencePercent: number;
  readonly checklist: readonly string[];
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly operatorSummary: string;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly institutionalAnalysisMode: true;
}

export interface FirstRealPlatformPaperSessionProtocolFailure {
  readonly code: 'INVALID_FIRST_PAPER_SESSION_PROTOCOL_INPUT';
  readonly stage: 'VALIDATION';
  readonly message: string;
}

export type FirstRealPlatformPaperSessionProtocolResult =
  | { readonly ok: true; readonly value: FirstRealPlatformPaperSessionProtocolReport }
  | { readonly ok: false; readonly error: FirstRealPlatformPaperSessionProtocolFailure };

/**
 * Defines the operational protocol for the first PAPER session observed on a real platform.
 *
 * It does not integrate with external platforms and does not execute actions.
 * It validates whether the operator can start a controlled PAPER session using
 * manual observation and supervised recommendations only.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class FirstRealPlatformPaperSessionProtocol {
  private readonly defaultConfig: FirstRealPlatformPaperSessionProtocolConfig = Object.freeze({
    minWarmupRounds: 100,
    maxObservedRounds: 300,
    maxFavorableRecommendations: 5,
    maxElevatedRiskRecommendations: 2,
    minAverageConfidencePercent: 55,
  });

  public evaluate(
    input: FirstRealPlatformPaperSessionProtocolInput,
  ): FirstRealPlatformPaperSessionProtocolResult {
    const validationFailure = this.validate(input);
    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }

    const config = this.resolveConfig(input.config);
    const blockers: string[] = [];
    const warnings: string[] = [];

    const warmupComplete = input.observedRounds >= config.minWarmupRounds;

    if (!warmupComplete) {
      blockers.push('WARMUP_MINIMO_NAO_CONCLUIDO');
    }

    if (input.observedRounds > config.maxObservedRounds) {
      blockers.push('LIMITE_DE_GIROS_DA_SESSAO_EXCEDIDO');
    }

    if (input.favorableCount > config.maxFavorableRecommendations) {
      warnings.push('LIMITE_DE_RECOMENDACOES_FAVORAVEIS_PROXIMO_DO_EXCESSO_OPERACIONAL');
    }

    if (input.elevatedRiskCount > config.maxElevatedRiskRecommendations) {
      blockers.push('RISCO_ELEVADO_EXCESSIVO_NA_SESSAO');
    }

    if (input.averageConfidencePercent < config.minAverageConfidencePercent) {
      warnings.push('CONFIANCA_MEDIA_ABAIXO_DO_MINIMO_RECOMENDADO');
    }

    if (!input.operatorConfirmedManualMode) {
      blockers.push('OPERADOR_NAO_CONFIRMOU_MODO_MANUAL');
    }

    if (!input.operatorConfirmedNoExternalIntegration) {
      blockers.push('OPERADOR_NAO_CONFIRMOU_AUSENCIA_DE_INTEGRACAO_EXTERNA');
    }

    if (!input.operatorConfirmedPaperTracking) {
      blockers.push('OPERADOR_NAO_CONFIRMOU_REGISTRO_PAPER');
    }

    const status = this.status(input, config, warmupComplete, blockers);
    const canStartPaperSession = status === 'READY_FOR_FIRST_PAPER_SESSION';

    return {
      ok: true,
      value: Object.freeze({
        sessionId: input.sessionId.trim(),
        strategyName: input.strategyName.trim(),
        status,
        canStartPaperSession,
        warmupComplete,
        observedRounds: input.observedRounds,
        minWarmupRounds: config.minWarmupRounds,
        maxObservedRounds: config.maxObservedRounds,
        favorableCount: input.favorableCount,
        waitCount: input.waitCount,
        noUseCount: input.noUseCount,
        elevatedRiskCount: input.elevatedRiskCount,
        averageConfidencePercent: input.averageConfidencePercent,
        checklist: Object.freeze(this.checklist()),
        blockers: Object.freeze(blockers),
        warnings: Object.freeze(warnings),
        operatorSummary: this.operatorSummary(status, input.strategyName.trim(), input.observedRounds, config.minWarmupRounds),
        operatorDecisionRequired: true,
        supervisedRecommendationOnly: true,
        institutionalAnalysisMode: true,
      }),
    };
  }

  private validate(
    input: FirstRealPlatformPaperSessionProtocolInput,
  ): FirstRealPlatformPaperSessionProtocolFailure | null {
    if (typeof input.sessionId !== 'string' || input.sessionId.trim().length === 0) {
      return this.failure('sessionId is required');
    }

    if (typeof input.strategyName !== 'string' || input.strategyName.trim().length === 0) {
      return this.failure('strategyName is required');
    }

    if (!this.isNonNegativeInteger(input.observedRounds)) {
      return this.failure('observedRounds must be a non-negative integer');
    }

    if (!this.isNonNegativeInteger(input.favorableCount)) {
      return this.failure('favorableCount must be a non-negative integer');
    }

    if (!this.isNonNegativeInteger(input.waitCount)) {
      return this.failure('waitCount must be a non-negative integer');
    }

    if (!this.isNonNegativeInteger(input.noUseCount)) {
      return this.failure('noUseCount must be a non-negative integer');
    }

    if (!this.isNonNegativeInteger(input.elevatedRiskCount)) {
      return this.failure('elevatedRiskCount must be a non-negative integer');
    }

    if (!Number.isFinite(input.averageConfidencePercent) || input.averageConfidencePercent < 0 || input.averageConfidencePercent > 100) {
      return this.failure('averageConfidencePercent must be between 0 and 100');
    }

    const totalRecommendations = input.favorableCount + input.waitCount + input.noUseCount;
    if (totalRecommendations > input.observedRounds) {
      return this.failure('recommendation counters cannot exceed observedRounds');
    }

    if (typeof input.operatorConfirmedManualMode !== 'boolean') {
      return this.failure('operatorConfirmedManualMode must be boolean');
    }

    if (typeof input.operatorConfirmedNoExternalIntegration !== 'boolean') {
      return this.failure('operatorConfirmedNoExternalIntegration must be boolean');
    }

    if (typeof input.operatorConfirmedPaperTracking !== 'boolean') {
      return this.failure('operatorConfirmedPaperTracking must be boolean');
    }

    return this.validateConfig(input.config);
  }

  private validateConfig(
    config: Partial<FirstRealPlatformPaperSessionProtocolConfig> | undefined,
  ): FirstRealPlatformPaperSessionProtocolFailure | null {
    if (typeof config === 'undefined') {
      return null;
    }

    const resolved = this.resolveConfig(config);

    if (resolved.minWarmupRounds <= 0) {
      return this.failure('minWarmupRounds must be positive');
    }

    if (resolved.maxObservedRounds < resolved.minWarmupRounds) {
      return this.failure('maxObservedRounds must be greater than or equal to minWarmupRounds');
    }

    if (resolved.maxFavorableRecommendations < 0) {
      return this.failure('maxFavorableRecommendations must be non-negative');
    }

    if (resolved.maxElevatedRiskRecommendations < 0) {
      return this.failure('maxElevatedRiskRecommendations must be non-negative');
    }

    if (resolved.minAverageConfidencePercent < 0 || resolved.minAverageConfidencePercent > 100) {
      return this.failure('minAverageConfidencePercent must be between 0 and 100');
    }

    return null;
  }

  private resolveConfig(
    config: Partial<FirstRealPlatformPaperSessionProtocolConfig> | undefined,
  ): FirstRealPlatformPaperSessionProtocolConfig {
    return Object.freeze({
      minWarmupRounds: Math.trunc(config?.minWarmupRounds ?? this.defaultConfig.minWarmupRounds),
      maxObservedRounds: Math.trunc(config?.maxObservedRounds ?? this.defaultConfig.maxObservedRounds),
      maxFavorableRecommendations: Math.trunc(config?.maxFavorableRecommendations ?? this.defaultConfig.maxFavorableRecommendations),
      maxElevatedRiskRecommendations: Math.trunc(config?.maxElevatedRiskRecommendations ?? this.defaultConfig.maxElevatedRiskRecommendations),
      minAverageConfidencePercent: config?.minAverageConfidencePercent ?? this.defaultConfig.minAverageConfidencePercent,
    });
  }

  private status(
    input: FirstRealPlatformPaperSessionProtocolInput,
    config: FirstRealPlatformPaperSessionProtocolConfig,
    warmupComplete: boolean,
    blockers: readonly string[],
  ): FirstPaperSessionStatus {
    if (blockers.length > 0) {
      if (!warmupComplete && blockers.length === 1 && blockers[0] === 'WARMUP_MINIMO_NAO_CONCLUIDO') {
        return 'WARMUP_REQUIRED';
      }

      return 'SESSION_BLOCKED';
    }

    if (input.observedRounds >= config.maxObservedRounds) {
      return 'SESSION_LIMIT_REACHED';
    }

    return 'READY_FOR_FIRST_PAPER_SESSION';
  }

  private checklist(): readonly string[] {
    return Object.freeze([
      'OPERADOR_OBSERVA_PLATAFORMA_REAL_MANUALMENTE',
      'RL_SYS_RECEBE_APENAS_DADOS_OBSERVADOS',
      'RECOMENDACAO_SUPERVISIONADA_POR_GIRO',
      'REGISTRAR_RESULTADO_PAPER_APOS_CADA_GIRO',
      'ENCERRAR_SE_RISCO_ELEVADO_DOMINAR',
      'EXPORTAR_RELATORIO_TEXT_JSON_AO_FINAL',
    ]);
  }

  private operatorSummary(
    status: FirstPaperSessionStatus,
    strategyName: string,
    observedRounds: number,
    minWarmupRounds: number,
  ): string {
    if (status === 'READY_FOR_FIRST_PAPER_SESSION') {
      return `${strategyName}: protocolo aprovado para primeira sessão PAPER supervisionada observando plataforma real.`;
    }

    if (status === 'WARMUP_REQUIRED') {
      return `${strategyName}: warmup insuficiente. Observados ${observedRounds}/${minWarmupRounds} giros mínimos.`;
    }

    if (status === 'SESSION_LIMIT_REACHED') {
      return `${strategyName}: limite operacional da sessão atingido. Encerrar e exportar relatório.`;
    }

    return `${strategyName}: protocolo bloqueado. Corrigir blockers antes da primeira sessão PAPER.`;
  }

  private isNonNegativeInteger(value: number): boolean {
    return Number.isInteger(value) && value >= 0;
  }

  private failure(message: string): FirstRealPlatformPaperSessionProtocolFailure {
    return Object.freeze({
      code: 'INVALID_FIRST_PAPER_SESSION_PROTOCOL_INPUT',
      stage: 'VALIDATION',
      message,
    });
  }
}
