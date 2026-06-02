export type InstitutionalSuggestionStatus =
  | 'PAPER_NAO_UTILIZAR'
  | 'PAPER_OBSERVAR'
  | 'PAPER_FAVORAVEL'
  | 'PAPER_CERTIFICADO';

export type InstitutionalSuggestionReason =
  | 'INSTITUTIONAL_SUGGESTION_COMPOSED'
  | 'INVALID_INSTITUTIONAL_SUGGESTION_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface InstitutionalSuggestionInput {
  readonly sessionId: string;
  readonly tableId: string;
  readonly strategyId: string;
  readonly finalConfidence: number;
  readonly consensusDecision: string;
  readonly confidenceDecision: string;
  readonly strategyReputation: string;
  readonly tableReputation: string;
  readonly readinessStatus: string;
  readonly operatorStatus: string;
  readonly explanationItems: readonly string[];
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface InstitutionalSuggestionReport {
  readonly sessionId: string;
  readonly tableId: string;
  readonly strategyId: string;
  readonly status: InstitutionalSuggestionStatus;
  readonly finalConfidence: number;
  readonly headline: string;
  readonly operatorMessage: string;
  readonly reasons: readonly string[];
  readonly manualUseAllowed: boolean;
  readonly requiresHumanDecision: true;
  readonly automaticExecutionAllowed: false;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
}

export type InstitutionalSuggestionResult =
  | {
      readonly ok: true;
      readonly value: InstitutionalSuggestionReport;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: InstitutionalSuggestionReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

const SCORE_PRECISION = 10_000;

/**
 * InstitutionalSuggestionComposer
 *
 * Camada de composição de mensagem operacional. Transforma decisões já
 * calculadas por consenso, confiança, reputação da estratégia e reputação da
 * mesa em uma sugestão clara para o operador humano.
 *
 * Não executa aposta, não controla plataforma, não usa API externa e não
 * autoriza live money. A saída "PAPER_FAVORAVEL" significa apenas contexto
 * favorável para utilização manual.
 *
 * Complexidade: O(n) sobre os itens explicativos, memória O(1) adicional.
 */
export class InstitutionalSuggestionComposer {
  public compose(input: InstitutionalSuggestionInput): InstitutionalSuggestionResult {
    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Institutional suggestion cannot run with live money flags enabled.');
    }

    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_INSTITUTIONAL_SUGGESTION_INPUT', invalidReason);
    }

    const status = this.classify(input);
    const reasons = this.buildReasons(input, status);

    return {
      ok: true,
      value: {
        sessionId: input.sessionId,
        tableId: input.tableId,
        strategyId: input.strategyId,
        status,
        finalConfidence: this.roundScore(input.finalConfidence),
        headline: this.headline(input.strategyId, status),
        operatorMessage: this.message(input.strategyId, status),
        reasons,
        manualUseAllowed: status === 'PAPER_FAVORAVEL' || status === 'PAPER_CERTIFICADO',
        requiresHumanDecision: true,
        automaticExecutionAllowed: false,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      },
    };
  }

  private classify(input: InstitutionalSuggestionInput): InstitutionalSuggestionStatus {
    if (
      input.readinessStatus.includes('BLOCKED') ||
      input.operatorStatus.includes('BLOCKED') ||
      input.consensusDecision.includes('BLOCKED') ||
      input.confidenceDecision === 'PAPER_NAO_UTILIZAR' ||
      input.strategyReputation.includes('BLOCKING') ||
      input.tableReputation.includes('BLOCKING')
    ) {
      return 'PAPER_NAO_UTILIZAR';
    }

    if (
      input.tableReputation.includes('VOLATILE') ||
      input.strategyReputation.includes('CAUTION') ||
      input.operatorStatus.includes('COOLDOWN') ||
      input.consensusDecision.includes('OBSERVE') ||
      input.confidenceDecision === 'PAPER_OBSERVAR' ||
      input.finalConfidence < 80
    ) {
      return 'PAPER_OBSERVAR';
    }

    if (
      input.finalConfidence >= 88 &&
      input.consensusDecision.includes('CERTIFIED') &&
      input.confidenceDecision === 'PAPER_CERTIFICADO' &&
      (input.strategyReputation.includes('STRONG') || input.strategyReputation.includes('STABLE')) &&
      (input.tableReputation.includes('STRONG') || input.tableReputation.includes('STABLE'))
    ) {
      return 'PAPER_CERTIFICADO';
    }

    return 'PAPER_FAVORAVEL';
  }

  private buildReasons(input: InstitutionalSuggestionInput, status: InstitutionalSuggestionStatus): readonly string[] {
    const reasons: string[] = [
      `Confiança final: ${this.roundScore(input.finalConfidence)}%`,
      `Consenso: ${input.consensusDecision}`,
      `Confiança estratégica: ${input.confidenceDecision}`,
      `Reputação da estratégia: ${input.strategyReputation}`,
      `Reputação da mesa: ${input.tableReputation}`,
      `Readiness: ${input.readinessStatus}`,
      `Operador: ${input.operatorStatus}`,
    ];

    for (const item of input.explanationItems) {
      reasons.push(item);
    }

    if (status === 'PAPER_NAO_UTILIZAR') {
      reasons.push('Bloqueio institucional: não utilizar a estratégia nesta rodada.');
    } else if (status === 'PAPER_OBSERVAR') {
      reasons.push('Aguardar evidência adicional antes de utilização manual.');
    } else if (status === 'PAPER_CERTIFICADO') {
      reasons.push('Contexto certificado para sugestão manual PAPER; decisão final humana.');
    } else {
      reasons.push('Contexto favorável para sugestão manual PAPER; decisão final humana.');
    }

    return reasons;
  }

  private headline(strategyId: string, status: InstitutionalSuggestionStatus): string {
    return `${strategyId.toUpperCase()}: ${status}`;
  }

  private message(strategyId: string, status: InstitutionalSuggestionStatus): string {
    if (status === 'PAPER_CERTIFICADO') {
      return `Estratégia ${strategyId} certificada para utilização manual nesta rodada.`;
    }

    if (status === 'PAPER_FAVORAVEL') {
      return `Estratégia ${strategyId} favorável para utilização manual nesta rodada.`;
    }

    if (status === 'PAPER_OBSERVAR') {
      return `Estratégia ${strategyId} em observação. Aguardar melhor contexto.`;
    }

    return `Estratégia ${strategyId} não qualificada para utilização nesta rodada.`;
  }

  private validateInput(input: InstitutionalSuggestionInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'input must be an object.';
    }

    if (!this.isSafeToken(input.sessionId, 3, 96)) {
      return 'sessionId must be a safe token with 3 to 96 characters.';
    }

    if (!this.isSafeToken(input.tableId, 3, 96)) {
      return 'tableId must be a safe token with 3 to 96 characters.';
    }

    if (!this.isSafeToken(input.strategyId, 3, 96)) {
      return 'strategyId must be a safe token with 3 to 96 characters.';
    }

    if (!Number.isFinite(input.finalConfidence) || input.finalConfidence < 0 || input.finalConfidence > 100) {
      return 'finalConfidence must be between 0 and 100.';
    }

    if (!this.isMeaningful(input.consensusDecision)) {
      return 'consensusDecision must be meaningful.';
    }

    if (!this.isMeaningful(input.confidenceDecision)) {
      return 'confidenceDecision must be meaningful.';
    }

    if (!this.isMeaningful(input.strategyReputation)) {
      return 'strategyReputation must be meaningful.';
    }

    if (!this.isMeaningful(input.tableReputation)) {
      return 'tableReputation must be meaningful.';
    }

    if (!this.isMeaningful(input.readinessStatus)) {
      return 'readinessStatus must be meaningful.';
    }

    if (!this.isMeaningful(input.operatorStatus)) {
      return 'operatorStatus must be meaningful.';
    }

    if (!Array.isArray(input.explanationItems) || input.explanationItems.length > 20) {
      return 'explanationItems must be an array with at most 20 items.';
    }

    for (const item of input.explanationItems) {
      if (!this.isMeaningful(item)) {
        return 'each explanation item must be meaningful.';
      }
    }

    return null;
  }

  private isMeaningful(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length >= 3 && value.length <= 240;
  }

  private isSafeToken(value: unknown, min: number, max: number): value is string {
    return (
      typeof value === 'string' &&
      value.length >= min &&
      value.length <= max &&
      /^[0-9A-Za-z._:-]+$/.test(value)
    );
  }

  private roundScore(value: number): number {
    return Math.round(value * SCORE_PRECISION) / SCORE_PRECISION;
  }

  private fail(reason: InstitutionalSuggestionReason, message: string): InstitutionalSuggestionResult {
    return {
      ok: false,
      error: {
        reason,
        message,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      },
    };
  }
}
