import type {
  InstitutionalMemoryIndexRecord,
  InstitutionalMemorySessionRecord,
} from './institutional-memory-repository';

export type SessionLearningReason =
  | 'SESSION_LEARNING_ANALYZED'
  | 'INVALID_SESSION_LEARNING_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface SessionLearningSuggestion {
  readonly status: string;
  readonly finalConfidence: number;
  readonly manualUseAllowed: boolean;
  readonly occurredAtEpochMs: number;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface SessionLearningInput {
  readonly sessionId: string;
  readonly tableId: string;
  readonly strategyId: string;
  readonly startedAtEpochMs: number;
  readonly finishedAtEpochMs: number;
  readonly roundCount: number;
  readonly operatorStatus: string;
  readonly consensusDecision: string;
  readonly strategyReputation: string;
  readonly tableReputation: string;
  readonly suggestions: readonly SessionLearningSuggestion[];
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface SessionLearningReport {
  readonly sessionRecord: InstitutionalMemorySessionRecord;
  readonly strategyIndex: InstitutionalMemoryIndexRecord;
  readonly tableIndex: InstitutionalMemoryIndexRecord;
  readonly learningScore: number;
  readonly favorableRate: number;
  readonly averageConfidence: number;
  readonly manualSuggestionRate: number;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
}

export type SessionLearningResult =
  | {
      readonly ok: true;
      readonly value: SessionLearningReport;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: SessionLearningReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

const SCORE_PRECISION = 10_000;

/**
 * SessionLearningEngine
 *
 * Converte uma sessão PAPER finalizada em payloads de memória institucional.
 * Ele não persiste diretamente; prepara registros para o
 * InstitutionalMemoryRepository, mantendo Clean Architecture e separando
 * cálculo de I/O.
 *
 * Não executa aposta, não automatiza plataforma e não autoriza live money.
 * Complexidade O(n) sobre sugestões, memória O(1).
 */
export class SessionLearningEngine {
  public analyze(input: SessionLearningInput): SessionLearningResult {
    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Session learning cannot run with live money flags enabled.');
    }

    if (Array.isArray(input.suggestions)) {
      for (const suggestion of input.suggestions) {
        if (suggestion.productionMoneyAllowed === true || suggestion.liveMoneyAuthorization === true) {
          return this.fail('LIVE_MONEY_FORBIDDEN', 'Session learning suggestion cannot contain live money flags.');
        }
      }
    }

    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_SESSION_LEARNING_INPUT', invalidReason);
    }

    let confidenceSum = 0;
    let favorableCount = 0;
    let manualAllowedCount = 0;

    for (const suggestion of input.suggestions) {
      confidenceSum += suggestion.finalConfidence;

      if (suggestion.status === 'PAPER_FAVORAVEL' || suggestion.status === 'PAPER_CERTIFICADO') {
        favorableCount += 1;
      }

      if (suggestion.manualUseAllowed) {
        manualAllowedCount += 1;
      }
    }

    const suggestionCount = input.suggestions.length;
    const averageConfidence = suggestionCount > 0 ? confidenceSum / suggestionCount : 0;
    const favorableRate = suggestionCount > 0 ? favorableCount / suggestionCount : 0;
    const manualSuggestionRate = suggestionCount > 0 ? manualAllowedCount / suggestionCount : 0;

    const consensusWeight = input.consensusDecision.includes('CERTIFIED')
      ? 1
      : input.consensusDecision.includes('READY')
        ? 0.85
        : input.consensusDecision.includes('OBSERVE')
          ? 0.55
          : 0.25;

    const strategyWeight = input.strategyReputation.includes('STRONG')
      ? 1
      : input.strategyReputation.includes('STABLE')
        ? 0.85
        : input.strategyReputation.includes('CAUTION')
          ? 0.45
          : input.strategyReputation.includes('BLOCKING')
            ? 0.15
            : 0.65;

    const tableWeight = input.tableReputation.includes('STRONG')
      ? 1
      : input.tableReputation.includes('STABLE')
        ? 0.85
        : input.tableReputation.includes('VOLATILE')
          ? 0.45
          : input.tableReputation.includes('BLOCKING')
            ? 0.15
            : 0.65;

    const operatorWeight = input.operatorStatus.includes('STABLE') || input.operatorStatus.includes('APT')
      ? 1
      : input.operatorStatus.includes('COOLDOWN')
        ? 0.45
        : input.operatorStatus.includes('BLOCK')
          ? 0.15
          : 0.65;

    const learningScore = this.clamp(
      favorableRate * 0.25 +
      (averageConfidence / 100) * 0.25 +
      manualSuggestionRate * 0.15 +
      consensusWeight * 0.15 +
      strategyWeight * 0.10 +
      tableWeight * 0.05 +
      operatorWeight * 0.05,
      0,
      1,
    );

    const finalStatus = this.classifySession(learningScore, favorableRate, averageConfidence);

    const sessionRecord: InstitutionalMemorySessionRecord = {
      sessionId: input.sessionId,
      tableId: input.tableId,
      strategyId: input.strategyId,
      startedAtEpochMs: input.startedAtEpochMs,
      finishedAtEpochMs: input.finishedAtEpochMs,
      roundCount: input.roundCount,
      finalStatus,
      finalConfidence: this.roundScore(averageConfidence),
      suggestionCount,
      favorableSuggestionCount: favorableCount,
      operatorStatus: input.operatorStatus,
      consensusDecision: input.consensusDecision,
      strategyReputation: input.strategyReputation,
      tableReputation: input.tableReputation,
      notes: [
        `learningScore=${this.roundScore(learningScore)}`,
        `favorableRate=${this.roundScore(favorableRate)}`,
        `manualSuggestionRate=${this.roundScore(manualSuggestionRate)}`,
      ],
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    };

    const strategyIndex = this.buildIndex({
      key: `strategy:${input.strategyId}`,
      updatedAtEpochMs: input.finishedAtEpochMs,
      sampleSize: suggestionCount,
      score: learningScore,
      decision: this.classifyStrategyIndex(learningScore, strategyWeight),
    });

    const tableIndex = this.buildIndex({
      key: `table:${input.tableId}`,
      updatedAtEpochMs: input.finishedAtEpochMs,
      sampleSize: suggestionCount,
      score: learningScore,
      decision: this.classifyTableIndex(learningScore, tableWeight),
    });

    return {
      ok: true,
      value: {
        sessionRecord,
        strategyIndex,
        tableIndex,
        learningScore: this.roundScore(learningScore),
        favorableRate: this.roundScore(favorableRate),
        averageConfidence: this.roundScore(averageConfidence),
        manualSuggestionRate: this.roundScore(manualSuggestionRate),
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      },
    };
  }

  private buildIndex(input: {
    readonly key: string;
    readonly updatedAtEpochMs: number;
    readonly sampleSize: number;
    readonly score: number;
    readonly decision: string;
  }): InstitutionalMemoryIndexRecord {
    return {
      key: input.key,
      updatedAtEpochMs: input.updatedAtEpochMs,
      sampleSize: input.sampleSize,
      score: this.roundScore(input.score),
      suggestedWeight: this.roundScore(this.clamp(0.75 + input.score * 0.5, 0.75, 1.25)),
      decision: input.decision,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    };
  }

  private classifySession(score: number, favorableRate: number, averageConfidence: number): string {
    if (score >= 0.78 && favorableRate >= 0.5 && averageConfidence >= 80) {
      return 'PAPER_LEARNING_STRONG';
    }

    if (score >= 0.62 && averageConfidence >= 70) {
      return 'PAPER_LEARNING_STABLE';
    }

    if (score >= 0.45) {
      return 'PAPER_LEARNING_NEUTRAL';
    }

    return 'PAPER_LEARNING_CAUTION';
  }

  private classifyStrategyIndex(score: number, priorWeight: number): string {
    if (score >= 0.78 && priorWeight >= 0.85) return 'REPUTATION_STRONG';
    if (score >= 0.62) return 'REPUTATION_STABLE';
    if (score >= 0.45) return 'REPUTATION_NEUTRAL';
    return 'REPUTATION_CAUTION';
  }

  private classifyTableIndex(score: number, priorWeight: number): string {
    if (score >= 0.78 && priorWeight >= 0.85) return 'TABLE_REPUTATION_STRONG';
    if (score >= 0.62) return 'TABLE_REPUTATION_STABLE';
    if (score >= 0.45) return 'TABLE_REPUTATION_NEUTRAL';
    return 'TABLE_REPUTATION_VOLATILE';
  }

  private validateInput(input: SessionLearningInput): string | null {
    if (typeof input !== 'object' || input === null) return 'input must be an object.';
    if (!this.isSafeToken(input.sessionId, 3, 96)) return 'sessionId must be a safe token.';
    if (!this.isSafeToken(input.tableId, 3, 96)) return 'tableId must be a safe token.';
    if (!this.isSafeToken(input.strategyId, 3, 96)) return 'strategyId must be a safe token.';

    if (!Number.isInteger(input.startedAtEpochMs) || input.startedAtEpochMs <= 0) return 'startedAtEpochMs must be positive integer.';
    if (!Number.isInteger(input.finishedAtEpochMs) || input.finishedAtEpochMs < input.startedAtEpochMs) return 'finishedAtEpochMs must be >= startedAtEpochMs.';
    if (!Number.isInteger(input.roundCount) || input.roundCount < 0 || input.roundCount > 10000) return 'roundCount must be between 0 and 10000.';

    if (!this.isMeaningful(input.operatorStatus)) return 'operatorStatus must be meaningful.';
    if (!this.isMeaningful(input.consensusDecision)) return 'consensusDecision must be meaningful.';
    if (!this.isMeaningful(input.strategyReputation)) return 'strategyReputation must be meaningful.';
    if (!this.isMeaningful(input.tableReputation)) return 'tableReputation must be meaningful.';

    if (!Array.isArray(input.suggestions) || input.suggestions.length > 1000) return 'suggestions must contain at most 1000 items.';

    for (const suggestion of input.suggestions) {
      const validation = this.validateSuggestion(suggestion);
      if (validation !== null) return validation;
    }

    return null;
  }

  private validateSuggestion(suggestion: SessionLearningSuggestion): string | null {
    if (typeof suggestion !== 'object' || suggestion === null) return 'each suggestion must be an object.';
    if (!this.isMeaningful(suggestion.status)) return 'suggestion.status must be meaningful.';
    if (!Number.isFinite(suggestion.finalConfidence) || suggestion.finalConfidence < 0 || suggestion.finalConfidence > 100) return 'suggestion.finalConfidence must be between 0 and 100.';
    if (typeof suggestion.manualUseAllowed !== 'boolean') return 'suggestion.manualUseAllowed must be boolean.';
    if (!Number.isInteger(suggestion.occurredAtEpochMs) || suggestion.occurredAtEpochMs <= 0) return 'suggestion.occurredAtEpochMs must be positive integer.';
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

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private roundScore(value: number): number {
    return Math.round(value * SCORE_PRECISION) / SCORE_PRECISION;
  }

  private fail(reason: SessionLearningReason, message: string): SessionLearningResult {
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
