export type PaperTargetColor = 'RED' | 'BLACK';
export type PaperSettlementResult = 'GREEN' | 'RED' | 'VOID';
export type PaperSuggestionStatus = 'PENDING' | 'SETTLED' | 'CANCELLED';
export type PaperLedgerEventType = 'SUGGESTION_OPENED' | 'SUGGESTION_SETTLED' | 'SUGGESTION_CANCELLED';

export interface PaperSuggestionInput {
  readonly suggestionId: string;
  readonly strategyId: string;
  readonly targetColor: PaperTargetColor;
  readonly stakeAmount: number;
  readonly openedAtRoundIndex: number;
  readonly confidenceScore: number;
  readonly riskScore: number;
  readonly reasons?: readonly string[];
  readonly warnings?: readonly string[];
}

export interface PendingPaperSuggestion {
  readonly suggestionId: string;
  readonly strategyId: string;
  readonly targetColor: PaperTargetColor;
  readonly stakeAmount: number;
  readonly openedAtRoundIndex: number;
  readonly confidenceScore: number;
  readonly riskScore: number;
  readonly status: 'PENDING';
  readonly liveMoneyAuthorized: false;
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
}

export interface SettledPaperSuggestion {
  readonly suggestionId: string;
  readonly strategyId: string;
  readonly targetColor: PaperTargetColor;
  readonly stakeAmount: number;
  readonly openedAtRoundIndex: number;
  readonly settledAtRoundIndex: number;
  readonly settlementNumber: number;
  readonly settlementColor: PaperTargetColor | 'ZERO';
  readonly result: PaperSettlementResult;
  readonly profitLossAmount: number;
  readonly bankrollBefore: number;
  readonly bankrollAfter: number;
  readonly status: 'SETTLED';
  readonly liveMoneyAuthorized: false;
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
}

export interface PaperLedgerEvent {
  readonly eventId: string;
  readonly type: PaperLedgerEventType;
  readonly suggestionId: string;
  readonly roundIndex: number;
  readonly amount: number;
  readonly bankrollAfter: number;
  readonly result?: PaperSettlementResult;
  readonly liveMoneyAuthorized: false;
  readonly createdAtIso: string;
}

export interface PaperSettlementSessionState {
  readonly bankroll: number;
  readonly pendingSuggestion: PendingPaperSuggestion | null;
  readonly settledSuggestions: readonly SettledPaperSuggestion[];
  readonly ledger: readonly PaperLedgerEvent[];
  readonly liveMoneyAuthorized: false;
  readonly productionMoneyAllowed: false;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
}

export interface PaperRoundSettlementOutput {
  readonly state: PaperSettlementSessionState;
  readonly settledSuggestion: SettledPaperSuggestion | null;
  readonly autoSettled: boolean;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly reasons: readonly string[];
}

const RED_NUMBERS: ReadonlySet<number> = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

const BLACK_NUMBERS: ReadonlySet<number> = new Set([
  2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35,
]);

export class PaperSuggestionSettlementEngine {
  public createInitialState(initialBankroll: number): PaperSettlementSessionState {
    return Object.freeze({
      bankroll: this.normalizeMoney(initialBankroll),
      pendingSuggestion: null,
      settledSuggestions: Object.freeze([]),
      ledger: Object.freeze([]),
      liveMoneyAuthorized: false,
      productionMoneyAllowed: false,
      operatorDecisionRequired: true,
      supervisedRecommendationOnly: true,
    });
  }

  public openSuggestion(
    state: PaperSettlementSessionState,
    input: PaperSuggestionInput,
    createdAtIso: string = new Date().toISOString(),
  ): PaperSettlementSessionState {
    if (state.pendingSuggestion !== null) {
      throw new Error('PAPER_SUGGESTION_ALREADY_PENDING');
    }

    if (!Number.isFinite(input.stakeAmount) || input.stakeAmount <= 0) {
      throw new Error('PAPER_SUGGESTION_INVALID_STAKE');
    }

    if (input.stakeAmount > state.bankroll) {
      throw new Error('PAPER_SUGGESTION_STAKE_EXCEEDS_BANKROLL');
    }

    const pendingSuggestion: PendingPaperSuggestion = Object.freeze({
      suggestionId: input.suggestionId,
      strategyId: input.strategyId,
      targetColor: input.targetColor,
      stakeAmount: this.normalizeMoney(input.stakeAmount),
      openedAtRoundIndex: input.openedAtRoundIndex,
      confidenceScore: this.clampRatio(input.confidenceScore),
      riskScore: this.clampRatio(input.riskScore),
      status: 'PENDING',
      liveMoneyAuthorized: false,
      reasons: Object.freeze([...(input.reasons ?? [])]),
      warnings: Object.freeze([...(input.warnings ?? [])]),
    });

    const ledgerEvent: PaperLedgerEvent = Object.freeze({
      eventId: `${input.suggestionId}:opened`,
      type: 'SUGGESTION_OPENED',
      suggestionId: input.suggestionId,
      roundIndex: input.openedAtRoundIndex,
      amount: 0,
      bankrollAfter: state.bankroll,
      liveMoneyAuthorized: false,
      createdAtIso,
    });

    return this.freezeState({
      ...state,
      pendingSuggestion,
      ledger: [...state.ledger, ledgerEvent],
    });
  }

  public settleOnRound(
    state: PaperSettlementSessionState,
    roundNumber: number,
    roundIndex: number,
    createdAtIso: string = new Date().toISOString(),
  ): PaperRoundSettlementOutput {
    if (state.pendingSuggestion === null) {
      return Object.freeze({
        state,
        settledSuggestion: null,
        autoSettled: false,
        blockers: Object.freeze([]),
        warnings: Object.freeze([]),
        reasons: Object.freeze(['NO_PENDING_PAPER_SUGGESTION']),
      });
    }

    if (!Number.isInteger(roundNumber) || roundNumber < 0 || roundNumber > 36) {
      throw new Error('PAPER_SETTLEMENT_INVALID_ROUND_NUMBER');
    }

    const pending = state.pendingSuggestion;
    const settlementColor = this.toColor(roundNumber);
    const result = this.resolveResult(pending.targetColor, settlementColor);
    const profitLossAmount = this.calculateProfitLoss(pending.stakeAmount, result);
    const bankrollBefore = state.bankroll;
    const bankrollAfter = this.normalizeMoney(bankrollBefore + profitLossAmount);

    const settledSuggestion: SettledPaperSuggestion = Object.freeze({
      suggestionId: pending.suggestionId,
      strategyId: pending.strategyId,
      targetColor: pending.targetColor,
      stakeAmount: pending.stakeAmount,
      openedAtRoundIndex: pending.openedAtRoundIndex,
      settledAtRoundIndex: roundIndex,
      settlementNumber: roundNumber,
      settlementColor,
      result,
      profitLossAmount,
      bankrollBefore,
      bankrollAfter,
      status: 'SETTLED',
      liveMoneyAuthorized: false,
      reasons: Object.freeze([
        ...pending.reasons,
        `PAPER_SETTLED:${result}`,
        `TARGET:${pending.targetColor}`,
        `ROUND:${roundNumber}`,
      ]),
      warnings: Object.freeze([...pending.warnings]),
    });

    const ledgerEvent: PaperLedgerEvent = Object.freeze({
      eventId: `${pending.suggestionId}:settled:${roundIndex}`,
      type: 'SUGGESTION_SETTLED',
      suggestionId: pending.suggestionId,
      roundIndex,
      amount: profitLossAmount,
      bankrollAfter,
      result,
      liveMoneyAuthorized: false,
      createdAtIso,
    });

    const newState = this.freezeState({
      ...state,
      bankroll: bankrollAfter,
      pendingSuggestion: null,
      settledSuggestions: [...state.settledSuggestions, settledSuggestion],
      ledger: [...state.ledger, ledgerEvent],
    });

    return Object.freeze({
      state: newState,
      settledSuggestion,
      autoSettled: true,
      blockers: Object.freeze([]),
      warnings: Object.freeze(
        result === 'VOID'
          ? ['ZERO_RESULT_VOID_NO_PROFIT_LOSS']
          : [],
      ),
      reasons: Object.freeze([
        'PAPER_SUGGESTION_AUTO_SETTLED',
        `RESULT:${result}`,
        `BANKROLL_BEFORE:${bankrollBefore}`,
        `BANKROLL_AFTER:${bankrollAfter}`,
      ]),
    });
  }

  public cancelPendingSuggestion(
    state: PaperSettlementSessionState,
    reason: string,
    roundIndex: number,
    createdAtIso: string = new Date().toISOString(),
  ): PaperSettlementSessionState {
    if (state.pendingSuggestion === null) {
      return state;
    }

    const pending = state.pendingSuggestion;

    const ledgerEvent: PaperLedgerEvent = Object.freeze({
      eventId: `${pending.suggestionId}:cancelled:${roundIndex}`,
      type: 'SUGGESTION_CANCELLED',
      suggestionId: pending.suggestionId,
      roundIndex,
      amount: 0,
      bankrollAfter: state.bankroll,
      liveMoneyAuthorized: false,
      createdAtIso,
    });

    return this.freezeState({
      ...state,
      pendingSuggestion: null,
      ledger: [...state.ledger, ledgerEvent],
    });
  }

  public toColor(value: number): PaperTargetColor | 'ZERO' {
    if (value === 0) {
      return 'ZERO';
    }

    if (RED_NUMBERS.has(value)) {
      return 'RED';
    }

    if (BLACK_NUMBERS.has(value)) {
      return 'BLACK';
    }

    throw new Error('PAPER_SETTLEMENT_INVALID_ROUND_NUMBER');
  }

  private resolveResult(
    targetColor: PaperTargetColor,
    settlementColor: PaperTargetColor | 'ZERO',
  ): PaperSettlementResult {
    if (settlementColor === 'ZERO') {
      return 'VOID';
    }

    return targetColor === settlementColor ? 'GREEN' : 'RED';
  }

  private calculateProfitLoss(stakeAmount: number, result: PaperSettlementResult): number {
    if (result === 'GREEN') {
      return this.normalizeMoney(stakeAmount);
    }

    if (result === 'RED') {
      return this.normalizeMoney(-stakeAmount);
    }

    return 0;
  }

  private freezeState(input: {
    readonly bankroll: number;
    readonly pendingSuggestion: PendingPaperSuggestion | null;
    readonly settledSuggestions: readonly SettledPaperSuggestion[];
    readonly ledger: readonly PaperLedgerEvent[];
    readonly liveMoneyAuthorized: false;
    readonly productionMoneyAllowed: false;
    readonly operatorDecisionRequired: true;
    readonly supervisedRecommendationOnly: true;
  }): PaperSettlementSessionState {
    return Object.freeze({
      bankroll: this.normalizeMoney(input.bankroll),
      pendingSuggestion: input.pendingSuggestion,
      settledSuggestions: Object.freeze([...input.settledSuggestions]),
      ledger: Object.freeze([...input.ledger]),
      liveMoneyAuthorized: false,
      productionMoneyAllowed: false,
      operatorDecisionRequired: true,
      supervisedRecommendationOnly: true,
    });
  }

  private normalizeMoney(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(value * 100) / 100;
  }

  private clampRatio(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
  }
}
