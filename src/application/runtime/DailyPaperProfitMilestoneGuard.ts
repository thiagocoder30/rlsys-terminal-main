export type DailyProfitMilestoneMode =
  | 'BASELINE'
  | 'DEFENSIVE'
  | 'STRICT'
  | 'ULTRA_DEFENSIVE'
  | 'STOP_WIN_LOCKED';

export type DailyProfitMilestoneDecision =
  | 'CONTINUE'
  | 'COOLDOWN_REQUIRED'
  | 'STRICT_CONSENSUS_REQUIRED'
  | 'ULTRA_DEFENSIVE_REQUIRED'
  | 'STOP_WIN_LOCKED';

export interface DailyProfitMilestonePolicy {
  readonly targetPercent: number;
  readonly milestonesPercent: readonly number[];
  readonly cooldownRoundsAfterMilestone: number;
  readonly strictModeAfterPercent: number;
  readonly ultraDefensiveAfterPercent: number;
  readonly paperOnly: true;
  readonly liveMoneyAuthorized: false;
  readonly productionMoneyAllowed: false;
}

export interface DailyProfitMilestone {
  readonly percent: number;
  readonly targetBankroll: number;
  readonly reached: boolean;
  readonly reachedAtBankroll: number | null;
  readonly reachedAtRoundIndex: number | null;
}

export interface DailyProfitMilestoneState {
  readonly openingBankroll: number;
  readonly currentBankroll: number;
  readonly realizedProfitLoss: number;
  readonly realizedProfitPercent: number;
  readonly targetBankroll: number;
  readonly milestones: readonly DailyProfitMilestone[];
  readonly activeMode: DailyProfitMilestoneMode;
  readonly decision: DailyProfitMilestoneDecision;
  readonly cooldownUntilRoundIndex: number | null;
  readonly lastReachedMilestonePercent: number | null;
  readonly nextMilestonePercent: number | null;
  readonly paperOnly: true;
  readonly liveMoneyAuthorized: false;
  readonly productionMoneyAllowed: false;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
}

export interface DailyProfitMilestoneEvaluation {
  readonly state: DailyProfitMilestoneState;
  readonly newlyReachedMilestones: readonly DailyProfitMilestone[];
  readonly allowedToOpenNewPaperSuggestion: boolean;
  readonly requiresCooldown: boolean;
  readonly requiresStrictConsensus: boolean;
  readonly requiresUltraDefensiveConsensus: boolean;
  readonly stopWinReached: boolean;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly reasons: readonly string[];
  readonly hudSummary: string;
}

const DEFAULT_TARGET_PERCENT = 8;
const DEFAULT_MILESTONES_PERCENT: readonly number[] = [2, 4, 6, 8];
const DEFAULT_COOLDOWN_ROUNDS_AFTER_MILESTONE = 2;
const DEFAULT_STRICT_MODE_AFTER_PERCENT = 4;
const DEFAULT_ULTRA_DEFENSIVE_AFTER_PERCENT = 6;

export class DailyPaperProfitMilestoneGuard {
  public createInitialState(
    openingBankroll: number,
    policy: Partial<DailyProfitMilestonePolicy> = {},
  ): DailyProfitMilestoneState {
    const normalizedPolicy = this.normalizePolicy(policy);
    const normalizedOpening = this.normalizeMoney(openingBankroll);

    return this.composeState({
      openingBankroll: normalizedOpening,
      currentBankroll: normalizedOpening,
      milestones: normalizedPolicy.milestonesPercent.map((percent) => this.createMilestone(percent, normalizedOpening, false, null, null)),
      cooldownUntilRoundIndex: null,
      policy: normalizedPolicy,
    });
  }

  public evaluate(
    state: DailyProfitMilestoneState,
    input: {
      readonly currentBankroll: number;
      readonly roundIndex: number;
    },
    policy: Partial<DailyProfitMilestonePolicy> = {},
  ): DailyProfitMilestoneEvaluation {
    const normalizedPolicy = this.normalizePolicy(policy);
    const currentBankroll = this.normalizeMoney(input.currentBankroll);

    const updatedMilestones: DailyProfitMilestone[] = [];
    const newlyReachedMilestones: DailyProfitMilestone[] = [];

    for (const milestone of state.milestones) {
      if (milestone.reached) {
        updatedMilestones.push(milestone);
        continue;
      }

      if (currentBankroll >= milestone.targetBankroll) {
        const reached = Object.freeze({
          ...milestone,
          reached: true,
          reachedAtBankroll: currentBankroll,
          reachedAtRoundIndex: input.roundIndex,
        });

        updatedMilestones.push(reached);
        newlyReachedMilestones.push(reached);
      } else {
        updatedMilestones.push(milestone);
      }
    }

    const highestReached = this.highestReachedPercent(updatedMilestones);
    const cooldownUntilRoundIndex =
      newlyReachedMilestones.length > 0
        ? input.roundIndex + normalizedPolicy.cooldownRoundsAfterMilestone
        : state.cooldownUntilRoundIndex;

    const nextState = this.composeState({
      openingBankroll: state.openingBankroll,
      currentBankroll,
      milestones: updatedMilestones,
      cooldownUntilRoundIndex,
      policy: normalizedPolicy,
    });

    const cooldownActive =
      nextState.cooldownUntilRoundIndex !== null &&
      input.roundIndex < nextState.cooldownUntilRoundIndex &&
      nextState.decision !== 'STOP_WIN_LOCKED';

    const blockers: string[] = [];
    const warnings: string[] = [];
    const reasons: string[] = [
      `MILESTONE_REALIZED_PERCENT:${nextState.realizedProfitPercent}`,
      `MILESTONE_MODE:${nextState.activeMode}`,
      `MILESTONE_DECISION:${nextState.decision}`,
    ];

    if (cooldownActive) {
      blockers.push('DAILY_PROFIT_MILESTONE_COOLDOWN_ACTIVE');
      reasons.push(`COOLDOWN_UNTIL_ROUND:${nextState.cooldownUntilRoundIndex}`);
    }

    if (newlyReachedMilestones.length > 0) {
      warnings.push('DAILY_PROFIT_MILESTONE_REACHED');
      reasons.push(`NEW_MILESTONE:${newlyReachedMilestones[newlyReachedMilestones.length - 1].percent}`);
    }

    if (nextState.decision === 'STRICT_CONSENSUS_REQUIRED') {
      warnings.push('DAILY_PROFIT_STRICT_CONSENSUS_REQUIRED');
    }

    if (nextState.decision === 'ULTRA_DEFENSIVE_REQUIRED') {
      warnings.push('DAILY_PROFIT_ULTRA_DEFENSIVE_REQUIRED');
    }

    if (nextState.decision === 'STOP_WIN_LOCKED') {
      blockers.push('DAILY_PROFIT_STOP_WIN_REACHED');
      reasons.push('DAILY_PROFIT_TARGET_COMPLETED');
    }

    const allowedToOpenNewPaperSuggestion =
      blockers.length === 0 &&
      nextState.decision !== 'STOP_WIN_LOCKED';

    return Object.freeze({
      state: nextState,
      newlyReachedMilestones: Object.freeze(newlyReachedMilestones),
      allowedToOpenNewPaperSuggestion,
      requiresCooldown: cooldownActive,
      requiresStrictConsensus: nextState.activeMode === 'STRICT',
      requiresUltraDefensiveConsensus: nextState.activeMode === 'ULTRA_DEFENSIVE',
      stopWinReached: nextState.decision === 'STOP_WIN_LOCKED',
      blockers: Object.freeze(blockers),
      warnings: Object.freeze(warnings),
      reasons: Object.freeze(reasons),
      hudSummary: this.getHudSummary(nextState, highestReached),
    });
  }

  public getHudSummary(
    state: DailyProfitMilestoneState,
    highestReachedPercent: number | null = this.highestReachedPercent(state.milestones),
  ): string {
    return [
      `profit=${state.realizedProfitPercent}%`,
      `mode=${state.activeMode}`,
      `decision=${state.decision}`,
      `highestMilestone=${highestReachedPercent ?? 'none'}`,
      `nextMilestone=${state.nextMilestonePercent ?? 'none'}`,
      `targetBankroll=${state.targetBankroll}`,
      `cooldownUntil=${state.cooldownUntilRoundIndex ?? 'none'}`,
      'paperOnly=true',
      'liveMoneyAuthorized=false',
    ].join(' | ');
  }

  private composeState(input: {
    readonly openingBankroll: number;
    readonly currentBankroll: number;
    readonly milestones: readonly DailyProfitMilestone[];
    readonly cooldownUntilRoundIndex: number | null;
    readonly policy: DailyProfitMilestonePolicy;
  }): DailyProfitMilestoneState {
    const realizedProfitLoss = this.normalizeMoney(input.currentBankroll - input.openingBankroll);
    const realizedProfitPercent = this.normalizePercent((realizedProfitLoss / Math.max(0.01, input.openingBankroll)) * 100);
    const highestReachedPercent = this.highestReachedPercent(input.milestones);
    const nextMilestonePercent = this.nextMilestonePercent(input.milestones);
    const activeMode = this.resolveMode(realizedProfitPercent, input.policy);
    const decision = this.resolveDecision(activeMode);

    return Object.freeze({
      openingBankroll: this.normalizeMoney(input.openingBankroll),
      currentBankroll: this.normalizeMoney(input.currentBankroll),
      realizedProfitLoss,
      realizedProfitPercent,
      targetBankroll: this.normalizeMoney(input.openingBankroll * (1 + (input.policy.targetPercent / 100))),
      milestones: Object.freeze([...input.milestones]),
      activeMode,
      decision,
      cooldownUntilRoundIndex: input.cooldownUntilRoundIndex,
      lastReachedMilestonePercent: highestReachedPercent,
      nextMilestonePercent,
      paperOnly: true,
      liveMoneyAuthorized: false,
      productionMoneyAllowed: false,
      operatorDecisionRequired: true,
      supervisedRecommendationOnly: true,
    });
  }

  private createMilestone(
    percent: number,
    openingBankroll: number,
    reached: boolean,
    reachedAtBankroll: number | null,
    reachedAtRoundIndex: number | null,
  ): DailyProfitMilestone {
    return Object.freeze({
      percent,
      targetBankroll: this.normalizeMoney(openingBankroll * (1 + (percent / 100))),
      reached,
      reachedAtBankroll,
      reachedAtRoundIndex,
    });
  }

  private resolveMode(
    realizedProfitPercent: number,
    policy: DailyProfitMilestonePolicy,
  ): DailyProfitMilestoneMode {
    if (realizedProfitPercent >= policy.targetPercent) {
      return 'STOP_WIN_LOCKED';
    }

    if (realizedProfitPercent >= policy.ultraDefensiveAfterPercent) {
      return 'ULTRA_DEFENSIVE';
    }

    if (realizedProfitPercent >= policy.strictModeAfterPercent) {
      return 'STRICT';
    }

    if (realizedProfitPercent >= Math.min(...policy.milestonesPercent)) {
      return 'DEFENSIVE';
    }

    return 'BASELINE';
  }

  private resolveDecision(mode: DailyProfitMilestoneMode): DailyProfitMilestoneDecision {
    if (mode === 'STOP_WIN_LOCKED') {
      return 'STOP_WIN_LOCKED';
    }

    if (mode === 'ULTRA_DEFENSIVE') {
      return 'ULTRA_DEFENSIVE_REQUIRED';
    }

    if (mode === 'STRICT') {
      return 'STRICT_CONSENSUS_REQUIRED';
    }

    if (mode === 'DEFENSIVE') {
      return 'COOLDOWN_REQUIRED';
    }

    return 'CONTINUE';
  }

  private highestReachedPercent(milestones: readonly DailyProfitMilestone[]): number | null {
    const reached = milestones.filter((milestone) => milestone.reached);

    if (reached.length === 0) {
      return null;
    }

    return Math.max(...reached.map((milestone) => milestone.percent));
  }

  private nextMilestonePercent(milestones: readonly DailyProfitMilestone[]): number | null {
    const next = milestones.find((milestone) => !milestone.reached);
    return next?.percent ?? null;
  }

  private normalizePolicy(policy: Partial<DailyProfitMilestonePolicy>): DailyProfitMilestonePolicy {
    const milestones = policy.milestonesPercent && policy.milestonesPercent.length > 0
      ? [...policy.milestonesPercent]
      : [...DEFAULT_MILESTONES_PERCENT];

    const sortedMilestones = milestones
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((left, right) => left - right);

    return Object.freeze({
      targetPercent: this.positiveNumberOrDefault(policy.targetPercent, DEFAULT_TARGET_PERCENT),
      milestonesPercent: Object.freeze(sortedMilestones.length > 0 ? sortedMilestones : [...DEFAULT_MILESTONES_PERCENT]),
      cooldownRoundsAfterMilestone: this.positiveIntegerOrDefault(
        policy.cooldownRoundsAfterMilestone,
        DEFAULT_COOLDOWN_ROUNDS_AFTER_MILESTONE,
      ),
      strictModeAfterPercent: this.positiveNumberOrDefault(policy.strictModeAfterPercent, DEFAULT_STRICT_MODE_AFTER_PERCENT),
      ultraDefensiveAfterPercent: this.positiveNumberOrDefault(policy.ultraDefensiveAfterPercent, DEFAULT_ULTRA_DEFENSIVE_AFTER_PERCENT),
      paperOnly: true,
      liveMoneyAuthorized: false,
      productionMoneyAllowed: false,
    });
  }

  private normalizeMoney(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(value * 100) / 100;
  }

  private normalizePercent(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(value * 100) / 100;
  }

  private positiveNumberOrDefault(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private positiveIntegerOrDefault(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
  }
}
