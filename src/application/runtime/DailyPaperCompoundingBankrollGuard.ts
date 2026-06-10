export type DailyPaperSessionStatus =
  | 'READY'
  | 'ACTIVE'
  | 'STOP_WIN_LOCKED'
  | 'STOP_LOSS_LOCKED'
  | 'BLOCKED_UNTIL_NEXT_DAY';

export type DailyPaperStopReason =
  | 'NONE'
  | 'STOP_WIN'
  | 'STOP_LOSS'
  | 'DAILY_REENTRY_BLOCK';

export interface DailyPaperCompoundingPolicy {
  readonly stopWinPercent: number;
  readonly stopLossPercent: number;
  readonly timezone: string;
  readonly carryBankrollToNextDay: true;
  readonly blockReentryUntilNextLocalDay: true;
  readonly paperOnly: true;
  readonly liveMoneyAuthorized: false;
  readonly productionMoneyAllowed: false;
}

export interface DailyPaperBankrollDaySnapshot {
  readonly localDate: string;
  readonly openingBankroll: number;
  readonly currentBankroll: number;
  readonly stopWinAmount: number;
  readonly stopLossAmount: number;
  readonly stopWinBankroll: number;
  readonly stopLossBankroll: number;
  readonly realizedProfitLoss: number;
  readonly status: DailyPaperSessionStatus;
  readonly stopReason: DailyPaperStopReason;
  readonly lockedUntilLocalDate: string | null;
  readonly sessionCount: number;
  readonly paperOnly: true;
  readonly liveMoneyAuthorized: false;
  readonly productionMoneyAllowed: false;
}

export interface DailyPaperBankrollGuardState {
  readonly policy: DailyPaperCompoundingPolicy;
  readonly currentDay: DailyPaperBankrollDaySnapshot;
  readonly history: readonly DailyPaperBankrollDaySnapshot[];
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
  readonly paperOnly: true;
  readonly liveMoneyAuthorized: false;
  readonly productionMoneyAllowed: false;
}

export interface DailyPaperBankrollEvaluation {
  readonly state: DailyPaperBankrollGuardState;
  readonly allowedToStartSession: boolean;
  readonly allowedToContinueSession: boolean;
  readonly stopTriggered: boolean;
  readonly stopReason: DailyPaperStopReason;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly reasons: readonly string[];
}

export interface DailyPaperCompoundingInput {
  readonly currentBankroll: number;
  readonly nowIso: string;
}

const DEFAULT_STOP_WIN_PERCENT = 8;
const DEFAULT_STOP_LOSS_PERCENT = 4;
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

export class DailyPaperCompoundingBankrollGuard {
  public createInitialState(
    initialBankroll: number,
    nowIso: string,
    policy: Partial<DailyPaperCompoundingPolicy> = {},
  ): DailyPaperBankrollGuardState {
    const normalizedPolicy = this.normalizePolicy(policy);
    const localDate = this.localDateFromIso(nowIso, normalizedPolicy.timezone);

    return Object.freeze({
      policy: normalizedPolicy,
      currentDay: this.createDaySnapshot(localDate, initialBankroll, initialBankroll, 'READY', 'NONE', null, 0, normalizedPolicy),
      history: Object.freeze([]),
      operatorDecisionRequired: true,
      supervisedRecommendationOnly: true,
      paperOnly: true,
      liveMoneyAuthorized: false,
      productionMoneyAllowed: false,
    });
  }

  public startSession(
    state: DailyPaperBankrollGuardState,
    nowIso: string,
  ): DailyPaperBankrollEvaluation {
    const rolledState = this.rolloverIfNeeded(state, nowIso);

    if (rolledState.currentDay.status === 'STOP_WIN_LOCKED' || rolledState.currentDay.status === 'STOP_LOSS_LOCKED') {
      return this.composeEvaluation(rolledState, false, false, false, 'DAILY_REENTRY_BLOCK', [
        'DAILY_PAPER_REENTRY_BLOCKED_UNTIL_NEXT_LOCAL_DAY',
      ], [], [
        `LOCKED_UNTIL:${rolledState.currentDay.lockedUntilLocalDate ?? 'NEXT_DAY'}`,
      ]);
    }

    const activeDay = Object.freeze({
      ...rolledState.currentDay,
      status: 'ACTIVE' as const,
      sessionCount: rolledState.currentDay.sessionCount + 1,
    });

    const nextState = this.freezeState({
      ...rolledState,
      currentDay: activeDay,
    });

    return this.composeEvaluation(nextState, true, true, false, 'NONE', [], [], [
      'DAILY_PAPER_SESSION_STARTED',
      `OPENING_BANKROLL:${activeDay.openingBankroll}`,
      `STOP_WIN_BANKROLL:${activeDay.stopWinBankroll}`,
      `STOP_LOSS_BANKROLL:${activeDay.stopLossBankroll}`,
    ]);
  }

  public evaluateBankroll(
    state: DailyPaperBankrollGuardState,
    input: DailyPaperCompoundingInput,
  ): DailyPaperBankrollEvaluation {
    const rolledState = this.rolloverIfNeeded(state, input.nowIso);
    const localDate = this.localDateFromIso(input.nowIso, rolledState.policy.timezone);
    const currentBankroll = this.normalizeMoney(input.currentBankroll);
    const openingBankroll = rolledState.currentDay.openingBankroll;
    const realizedProfitLoss = this.normalizeMoney(currentBankroll - openingBankroll);

    let status: DailyPaperSessionStatus = rolledState.currentDay.status;
    let stopReason: DailyPaperStopReason = 'NONE';
    let lockedUntilLocalDate: string | null = rolledState.currentDay.lockedUntilLocalDate;
    const blockers: string[] = [];
    const warnings: string[] = [];
    const reasons: string[] = [
      `DAILY_PAPER_LOCAL_DATE:${localDate}`,
      `OPENING_BANKROLL:${openingBankroll}`,
      `CURRENT_BANKROLL:${currentBankroll}`,
      `REALIZED_PL:${realizedProfitLoss}`,
    ];

    if (currentBankroll >= rolledState.currentDay.stopWinBankroll) {
      status = 'STOP_WIN_LOCKED';
      stopReason = 'STOP_WIN';
      lockedUntilLocalDate = this.nextLocalDate(localDate);
      blockers.push('DAILY_PAPER_STOP_WIN_REACHED');
      reasons.push('DAILY_PAPER_STOP_WIN_TRIGGERED');
    } else if (currentBankroll <= rolledState.currentDay.stopLossBankroll) {
      status = 'STOP_LOSS_LOCKED';
      stopReason = 'STOP_LOSS';
      lockedUntilLocalDate = this.nextLocalDate(localDate);
      blockers.push('DAILY_PAPER_STOP_LOSS_REACHED');
      warnings.push('DAILY_PAPER_PROTECTIVE_LOCK_ACTIVE');
      reasons.push('DAILY_PAPER_STOP_LOSS_TRIGGERED');
    }

    const nextDay = Object.freeze({
      ...rolledState.currentDay,
      currentBankroll,
      realizedProfitLoss,
      status,
      stopReason,
      lockedUntilLocalDate,
    });

    const nextState = this.freezeState({
      ...rolledState,
      currentDay: nextDay,
    });

    const stopTriggered = stopReason === 'STOP_WIN' || stopReason === 'STOP_LOSS';

    return this.composeEvaluation(
      nextState,
      !stopTriggered,
      !stopTriggered,
      stopTriggered,
      stopReason,
      blockers,
      warnings,
      reasons,
    );
  }

  public rolloverIfNeeded(
    state: DailyPaperBankrollGuardState,
    nowIso: string,
  ): DailyPaperBankrollGuardState {
    const localDate = this.localDateFromIso(nowIso, state.policy.timezone);

    if (localDate === state.currentDay.localDate) {
      return state;
    }

    const previousDay = state.currentDay;
    const openingBankroll = previousDay.currentBankroll;

    const nextDay = this.createDaySnapshot(
      localDate,
      openingBankroll,
      openingBankroll,
      'READY',
      'NONE',
      null,
      0,
      state.policy,
    );

    return this.freezeState({
      ...state,
      currentDay: nextDay,
      history: [...state.history, previousDay],
    });
  }

  public getHudSummary(state: DailyPaperBankrollGuardState): string {
    return [
      `date=${state.currentDay.localDate}`,
      `status=${state.currentDay.status}`,
      `opening=${state.currentDay.openingBankroll}`,
      `current=${state.currentDay.currentBankroll}`,
      `stopWin=${state.currentDay.stopWinBankroll}`,
      `stopLoss=${state.currentDay.stopLossBankroll}`,
      `pl=${state.currentDay.realizedProfitLoss}`,
      `lockedUntil=${state.currentDay.lockedUntilLocalDate ?? 'none'}`,
      'paperOnly=true',
      'liveMoneyAuthorized=false',
    ].join(' | ');
  }

  private createDaySnapshot(
    localDate: string,
    openingBankrollInput: number,
    currentBankrollInput: number,
    status: DailyPaperSessionStatus,
    stopReason: DailyPaperStopReason,
    lockedUntilLocalDate: string | null,
    sessionCount: number,
    policy: DailyPaperCompoundingPolicy,
  ): DailyPaperBankrollDaySnapshot {
    const openingBankroll = this.normalizeMoney(openingBankrollInput);
    const currentBankroll = this.normalizeMoney(currentBankrollInput);
    const stopWinAmount = this.normalizeMoney(openingBankroll * (policy.stopWinPercent / 100));
    const stopLossAmount = this.normalizeMoney(openingBankroll * (policy.stopLossPercent / 100));

    return Object.freeze({
      localDate,
      openingBankroll,
      currentBankroll,
      stopWinAmount,
      stopLossAmount,
      stopWinBankroll: this.normalizeMoney(openingBankroll + stopWinAmount),
      stopLossBankroll: this.normalizeMoney(openingBankroll - stopLossAmount),
      realizedProfitLoss: this.normalizeMoney(currentBankroll - openingBankroll),
      status,
      stopReason,
      lockedUntilLocalDate,
      sessionCount,
      paperOnly: true,
      liveMoneyAuthorized: false,
      productionMoneyAllowed: false,
    });
  }

  private normalizePolicy(policy: Partial<DailyPaperCompoundingPolicy>): DailyPaperCompoundingPolicy {
    return Object.freeze({
      stopWinPercent: this.positiveNumberOrDefault(policy.stopWinPercent, DEFAULT_STOP_WIN_PERCENT),
      stopLossPercent: this.positiveNumberOrDefault(policy.stopLossPercent, DEFAULT_STOP_LOSS_PERCENT),
      timezone: policy.timezone ?? DEFAULT_TIMEZONE,
      carryBankrollToNextDay: true,
      blockReentryUntilNextLocalDay: true,
      paperOnly: true,
      liveMoneyAuthorized: false,
      productionMoneyAllowed: false,
    });
  }

  private composeEvaluation(
    state: DailyPaperBankrollGuardState,
    allowedToStartSession: boolean,
    allowedToContinueSession: boolean,
    stopTriggered: boolean,
    stopReason: DailyPaperStopReason,
    blockers: readonly string[],
    warnings: readonly string[],
    reasons: readonly string[],
  ): DailyPaperBankrollEvaluation {
    return Object.freeze({
      state,
      allowedToStartSession,
      allowedToContinueSession,
      stopTriggered,
      stopReason,
      blockers: Object.freeze([...blockers]),
      warnings: Object.freeze([...warnings]),
      reasons: Object.freeze([...reasons]),
    });
  }

  private freezeState(input: {
    readonly policy: DailyPaperCompoundingPolicy;
    readonly currentDay: DailyPaperBankrollDaySnapshot;
    readonly history: readonly DailyPaperBankrollDaySnapshot[];
    readonly operatorDecisionRequired: true;
    readonly supervisedRecommendationOnly: true;
    readonly paperOnly: true;
    readonly liveMoneyAuthorized: false;
    readonly productionMoneyAllowed: false;
  }): DailyPaperBankrollGuardState {
    return Object.freeze({
      policy: input.policy,
      currentDay: input.currentDay,
      history: Object.freeze([...input.history]),
      operatorDecisionRequired: true,
      supervisedRecommendationOnly: true,
      paperOnly: true,
      liveMoneyAuthorized: false,
      productionMoneyAllowed: false,
    });
  }

  private localDateFromIso(nowIso: string, timezone: string): string {
    const date = new Date(nowIso);

    if (Number.isNaN(date.getTime())) {
      throw new Error('DAILY_PAPER_INVALID_ISO_DATE');
    }

    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    if (!year || !month || !day) {
      throw new Error('DAILY_PAPER_LOCAL_DATE_FORMAT_FAILED');
    }

    return `${year}-${month}-${day}`;
  }

  private nextLocalDate(localDate: string): string {
    const date = new Date(`${localDate}T12:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      throw new Error('DAILY_PAPER_INVALID_LOCAL_DATE');
    }

    date.setUTCDate(date.getUTCDate() + 1);

    return date.toISOString().slice(0, 10);
  }

  private normalizeMoney(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(value * 100) / 100;
  }

  private positiveNumberOrDefault(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
