import { InstitutionalSuggestionComposer } from './institutional-suggestion-composer';
import type { InstitutionalSuggestionReport } from './institutional-suggestion-composer';

export type PaperSessionRunnerCommand = 'START' | 'ROUND' | 'SUGGEST' | 'FINISH';
export type PaperSessionRunnerLifecycle = 'ACTIVE' | 'FINISHED';
export type PaperSessionRoundColor = 'RED' | 'BLACK' | 'GREEN';

export type PaperSessionRunnerReason =
  | 'PAPER_SESSION_RUNNER_UPDATED'
  | 'INVALID_PAPER_SESSION_RUNNER_INPUT'
  | 'LIVE_MONEY_FORBIDDEN';

export interface PaperSessionRound {
  readonly index: number;
  readonly number: number;
  readonly color: PaperSessionRoundColor;
  readonly occurredAtEpochMs: number;
}

export interface PaperSessionRunnerState {
  readonly sessionId: string;
  readonly tableId: string;
  readonly strategyId: string;
  readonly lifecycle: PaperSessionRunnerLifecycle;
  readonly startedAtEpochMs: number;
  readonly updatedAtEpochMs: number;
  readonly rounds: readonly PaperSessionRound[];
  readonly lastSuggestion?: InstitutionalSuggestionReport;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
}

export interface PaperSessionRunnerSuggestionInput {
  readonly finalConfidence: number;
  readonly consensusDecision: string;
  readonly confidenceDecision: string;
  readonly strategyReputation: string;
  readonly tableReputation: string;
  readonly readinessStatus: string;
  readonly operatorStatus: string;
  readonly explanationItems: readonly string[];
}

export interface PaperSessionRunnerInput {
  readonly command: PaperSessionRunnerCommand;
  readonly sessionId: string;
  readonly tableId: string;
  readonly strategyId: string;
  readonly nowEpochMs: number;
  readonly maxRounds: number;
  readonly state?: PaperSessionRunnerState;
  readonly round?: {
    readonly number: number;
    readonly color: PaperSessionRoundColor;
  };
  readonly suggestion?: PaperSessionRunnerSuggestionInput;
  readonly productionMoneyAllowed?: boolean;
  readonly liveMoneyAuthorization?: boolean;
}

export interface PaperSessionRunnerEvent {
  readonly type: PaperSessionRunnerCommand;
  readonly sessionId: string;
  readonly roundCount: number;
  readonly occurredAtEpochMs: number;
  readonly message: string;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
}

export interface PaperSessionRunnerReport {
  readonly state: PaperSessionRunnerState;
  readonly event: PaperSessionRunnerEvent;
  readonly suggestion?: InstitutionalSuggestionReport;
  readonly productionMoneyAllowed: false;
  readonly liveMoneyAuthorization: false;
}

export type PaperSessionRunnerResult =
  | {
      readonly ok: true;
      readonly value: PaperSessionRunnerReport;
    }
  | {
      readonly ok: false;
      readonly error: {
        readonly reason: PaperSessionRunnerReason;
        readonly message: string;
        readonly productionMoneyAllowed: false;
        readonly liveMoneyAuthorization: false;
      };
    };

/**
 * PaperSessionRunner
 *
 * Orquestrador operacional leve para sessão PAPER:
 * START -> ROUND -> SUGGEST -> FINISH.
 *
 * Ele não executa aposta, não automatiza plataforma, não controla banca real e
 * não autoriza live money. Apenas mantém estado de sessão e compõe sugestão
 * institucional para decisão humana.
 *
 * Complexidade por comando:
 * - START: O(1)
 * - ROUND: O(n) por cópia imutável bounded dos rounds
 * - SUGGEST: O(k) sobre explicações
 * - FINISH: O(1)
 */
export class PaperSessionRunner {
  private readonly composer: InstitutionalSuggestionComposer;

  public constructor(composer: InstitutionalSuggestionComposer = new InstitutionalSuggestionComposer()) {
    this.composer = composer;
  }

  public run(input: PaperSessionRunnerInput): PaperSessionRunnerResult {
    if (input.productionMoneyAllowed === true || input.liveMoneyAuthorization === true) {
      return this.fail('LIVE_MONEY_FORBIDDEN', 'Paper session runner cannot run with live money flags enabled.');
    }

    const invalidReason = this.validateInput(input);

    if (invalidReason !== null) {
      return this.fail('INVALID_PAPER_SESSION_RUNNER_INPUT', invalidReason);
    }

    if (input.command === 'START') {
      return this.start(input);
    }

    if (input.state === undefined) {
      return this.fail('INVALID_PAPER_SESSION_RUNNER_INPUT', 'state is required after START.');
    }

    if (input.state.lifecycle === 'FINISHED') {
      return this.fail('INVALID_PAPER_SESSION_RUNNER_INPUT', 'finished session cannot receive new commands.');
    }

    if (input.command === 'ROUND') {
      return this.round(input, input.state);
    }

    if (input.command === 'SUGGEST') {
      return this.suggest(input, input.state);
    }

    return this.finish(input, input.state);
  }

  private start(input: PaperSessionRunnerInput): PaperSessionRunnerResult {
    const state: PaperSessionRunnerState = {
      sessionId: input.sessionId,
      tableId: input.tableId,
      strategyId: input.strategyId,
      lifecycle: 'ACTIVE',
      startedAtEpochMs: input.nowEpochMs,
      updatedAtEpochMs: input.nowEpochMs,
      rounds: [],
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    };

    return this.success(state, {
      type: 'START',
      sessionId: input.sessionId,
      roundCount: 0,
      occurredAtEpochMs: input.nowEpochMs,
      message: 'Sessão PAPER iniciada para operação manual supervisionada.',
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });
  }

  private round(input: PaperSessionRunnerInput, state: PaperSessionRunnerState): PaperSessionRunnerResult {
    if (input.round === undefined) {
      return this.fail('INVALID_PAPER_SESSION_RUNNER_INPUT', 'round payload is required for ROUND command.');
    }

    if (state.rounds.length >= input.maxRounds) {
      return this.fail('INVALID_PAPER_SESSION_RUNNER_INPUT', 'maximum round capacity reached.');
    }

    const nextRound: PaperSessionRound = {
      index: state.rounds.length + 1,
      number: input.round.number,
      color: input.round.color,
      occurredAtEpochMs: input.nowEpochMs,
    };

    const nextState: PaperSessionRunnerState = {
      ...state,
      updatedAtEpochMs: input.nowEpochMs,
      rounds: [...state.rounds, nextRound],
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    };

    return this.success(nextState, {
      type: 'ROUND',
      sessionId: input.sessionId,
      roundCount: nextState.rounds.length,
      occurredAtEpochMs: input.nowEpochMs,
      message: `Rodada manual registrada: ${nextRound.number}/${nextRound.color}.`,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });
  }

  private suggest(input: PaperSessionRunnerInput, state: PaperSessionRunnerState): PaperSessionRunnerResult {
    if (input.suggestion === undefined) {
      return this.fail('INVALID_PAPER_SESSION_RUNNER_INPUT', 'suggestion payload is required for SUGGEST command.');
    }

    const composed = this.composer.compose({
      sessionId: input.sessionId,
      tableId: input.tableId,
      strategyId: input.strategyId,
      finalConfidence: input.suggestion.finalConfidence,
      consensusDecision: input.suggestion.consensusDecision,
      confidenceDecision: input.suggestion.confidenceDecision,
      strategyReputation: input.suggestion.strategyReputation,
      tableReputation: input.suggestion.tableReputation,
      readinessStatus: input.suggestion.readinessStatus,
      operatorStatus: input.suggestion.operatorStatus,
      explanationItems: input.suggestion.explanationItems,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });

    if (!composed.ok) {
      return this.fail('INVALID_PAPER_SESSION_RUNNER_INPUT', composed.error.message);
    }

    const nextState: PaperSessionRunnerState = {
      ...state,
      updatedAtEpochMs: input.nowEpochMs,
      lastSuggestion: composed.value,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    };

    return this.success(
      nextState,
      {
        type: 'SUGGEST',
        sessionId: input.sessionId,
        roundCount: nextState.rounds.length,
        occurredAtEpochMs: input.nowEpochMs,
        message: `Sugestão institucional composta: ${composed.value.status}.`,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      },
      composed.value,
    );
  }

  private finish(input: PaperSessionRunnerInput, state: PaperSessionRunnerState): PaperSessionRunnerResult {
    const nextState: PaperSessionRunnerState = {
      ...state,
      lifecycle: 'FINISHED',
      updatedAtEpochMs: input.nowEpochMs,
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    };

    return this.success(nextState, {
      type: 'FINISH',
      sessionId: input.sessionId,
      roundCount: nextState.rounds.length,
      occurredAtEpochMs: input.nowEpochMs,
      message: 'Sessão PAPER finalizada com execução manual preservada.',
      productionMoneyAllowed: false,
      liveMoneyAuthorization: false,
    });
  }

  private validateInput(input: PaperSessionRunnerInput): string | null {
    if (typeof input !== 'object' || input === null) {
      return 'input must be an object.';
    }

    if (input.command !== 'START' && input.command !== 'ROUND' && input.command !== 'SUGGEST' && input.command !== 'FINISH') {
      return 'command is invalid.';
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

    if (!Number.isInteger(input.nowEpochMs) || input.nowEpochMs <= 0) {
      return 'nowEpochMs must be a positive integer.';
    }

    if (!Number.isInteger(input.maxRounds) || input.maxRounds < 1 || input.maxRounds > 500) {
      return 'maxRounds must be between 1 and 500.';
    }

    if (input.state !== undefined) {
      const stateValidation = this.validateState(input.state, input);

      if (stateValidation !== null) {
        return stateValidation;
      }
    }

    if (input.round !== undefined) {
      if (!Number.isInteger(input.round.number) || input.round.number < 0 || input.round.number > 36) {
        return 'round.number must be an integer between 0 and 36.';
      }

      if (input.round.color !== 'RED' && input.round.color !== 'BLACK' && input.round.color !== 'GREEN') {
        return 'round.color is invalid.';
      }
    }

    if (input.suggestion !== undefined) {
      const suggestionValidation = this.validateSuggestion(input.suggestion);

      if (suggestionValidation !== null) {
        return suggestionValidation;
      }
    }

    return null;
  }

  private validateState(state: PaperSessionRunnerState, input: PaperSessionRunnerInput): string | null {
    if (state.sessionId !== input.sessionId || state.tableId !== input.tableId || state.strategyId !== input.strategyId) {
      return 'state identity does not match command identity.';
    }

    if (state.lifecycle !== 'ACTIVE' && state.lifecycle !== 'FINISHED') {
      return 'state lifecycle is invalid.';
    }

    if (!Array.isArray(state.rounds) || state.rounds.length > input.maxRounds) {
      return 'state rounds exceed capacity.';
    }

    for (const round of state.rounds) {
      if (!Number.isInteger(round.index) || round.index < 1) {
        return 'state round index is invalid.';
      }

      if (!Number.isInteger(round.number) || round.number < 0 || round.number > 36) {
        return 'state round number is invalid.';
      }

      if (round.color !== 'RED' && round.color !== 'BLACK' && round.color !== 'GREEN') {
        return 'state round color is invalid.';
      }
    }

    return null;
  }

  private validateSuggestion(suggestion: PaperSessionRunnerSuggestionInput): string | null {
    if (!Number.isFinite(suggestion.finalConfidence) || suggestion.finalConfidence < 0 || suggestion.finalConfidence > 100) {
      return 'suggestion.finalConfidence must be between 0 and 100.';
    }

    if (
      !this.isMeaningful(suggestion.consensusDecision) ||
      !this.isMeaningful(suggestion.confidenceDecision) ||
      !this.isMeaningful(suggestion.strategyReputation) ||
      !this.isMeaningful(suggestion.tableReputation) ||
      !this.isMeaningful(suggestion.readinessStatus) ||
      !this.isMeaningful(suggestion.operatorStatus)
    ) {
      return 'suggestion status fields must be meaningful.';
    }

    if (!Array.isArray(suggestion.explanationItems) || suggestion.explanationItems.length > 20) {
      return 'suggestion.explanationItems must be an array with at most 20 items.';
    }

    for (const item of suggestion.explanationItems) {
      if (!this.isMeaningful(item)) {
        return 'suggestion explanation items must be meaningful.';
      }
    }

    return null;
  }

  private success(
    state: PaperSessionRunnerState,
    event: PaperSessionRunnerEvent,
    suggestion?: InstitutionalSuggestionReport,
  ): PaperSessionRunnerResult {
    return {
      ok: true,
      value: {
        state,
        event,
        suggestion,
        productionMoneyAllowed: false,
        liveMoneyAuthorization: false,
      },
    };
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

  private fail(reason: PaperSessionRunnerReason, message: string): PaperSessionRunnerResult {
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
