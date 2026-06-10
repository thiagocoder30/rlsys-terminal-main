export type PaperPerformanceResult = 'GREEN' | 'RED' | 'VOID';
export type PaperPerformanceScope = 'allTime' | 'last7Days' | 'last30Days';

export interface PaperPerformanceSettlementEvent {
  readonly eventId: string;
  readonly strategyId: string;
  readonly result: PaperPerformanceResult;
  readonly profitLossAmount: number;
  readonly stakeAmount: number;
  readonly bankrollBefore: number;
  readonly bankrollAfter: number;
  readonly settledAtIso: string;
  readonly consensusStrategyIds?: readonly string[];
  readonly milestonePercent?: number;
  readonly sessionId?: string;
  readonly dayKey?: string;
}

export interface PaperSessionPerformanceEvent {
  readonly sessionId: string;
  readonly dayKey: string;
  readonly openingBankroll: number;
  readonly closingBankroll: number;
  readonly stopReason: 'NONE' | 'STOP_WIN' | 'STOP_LOSS';
  readonly startedAtIso: string;
  readonly finishedAtIso: string;
}

export interface StrategyPerformanceSummary {
  readonly strategyId: string;
  readonly total: number;
  readonly wins: number;
  readonly losses: number;
  readonly voids: number;
  readonly hitRatePercent: number;
  readonly roiPercent: number;
  readonly totalStake: number;
  readonly profitLossAmount: number;
  readonly averageProfitLoss: number;
  readonly maxConsecutiveWins: number;
  readonly maxConsecutiveLosses: number;
}

export interface ConsensusPerformanceSummary {
  readonly total: number;
  readonly wins: number;
  readonly losses: number;
  readonly voids: number;
  readonly hitRatePercent: number;
  readonly roiPercent: number;
  readonly profitLossAmount: number;
}

export interface BankrollGrowthSummary {
  readonly openingBankroll: number;
  readonly currentBankroll: number;
  readonly peakBankroll: number;
  readonly troughBankroll: number;
  readonly growthAmount: number;
  readonly growthPercent: number;
  readonly maxDrawdownAmount: number;
  readonly maxDrawdownPercent: number;
}

export interface SessionPerformanceSummary {
  readonly totalSessions: number;
  readonly stopWinSessions: number;
  readonly stopLossSessions: number;
  readonly neutralSessions: number;
  readonly averageSessionProfitLoss: number;
}

export interface MilestonePerformanceSummary {
  readonly milestonePercent: number;
  readonly hits: number;
  readonly winsAfterMilestone: number;
  readonly lossesAfterMilestone: number;
  readonly hitRateAfterMilestonePercent: number;
  readonly profitLossAfterMilestone: number;
}

export interface PaperPerformanceAnalyticsReport {
  readonly scope: PaperPerformanceScope;
  readonly generatedAtIso: string;
  readonly settlementCount: number;
  readonly strategySummaries: readonly StrategyPerformanceSummary[];
  readonly consensusSummary: ConsensusPerformanceSummary;
  readonly bankrollGrowth: BankrollGrowthSummary;
  readonly sessionSummary: SessionPerformanceSummary;
  readonly milestoneSummaries: readonly MilestonePerformanceSummary[];
  readonly falsePositiveCount: number;
  readonly falseNegativeCount: number;
  readonly hudSummary: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorized: false;
  readonly productionMoneyAllowed: false;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
}

export class PaperPerformanceAnalyticsEngine {
  public analyze(input: {
    readonly settlements: readonly PaperPerformanceSettlementEvent[];
    readonly sessions?: readonly PaperSessionPerformanceEvent[];
    readonly generatedAtIso?: string;
    readonly nowIso?: string;
  }): {
    readonly allTime: PaperPerformanceAnalyticsReport;
    readonly last7Days: PaperPerformanceAnalyticsReport;
    readonly last30Days: PaperPerformanceAnalyticsReport;
  } {
    const generatedAtIso = input.generatedAtIso ?? new Date().toISOString();
    const nowIso = input.nowIso ?? generatedAtIso;
    const sessions = input.sessions ?? [];

    return Object.freeze({
      allTime: this.composeReport('allTime', input.settlements, sessions, generatedAtIso),
      last7Days: this.composeReport('last7Days', this.filterRecent(input.settlements, nowIso, 7), this.filterRecentSessions(sessions, nowIso, 7), generatedAtIso),
      last30Days: this.composeReport('last30Days', this.filterRecent(input.settlements, nowIso, 30), this.filterRecentSessions(sessions, nowIso, 30), generatedAtIso),
    });
  }

  private composeReport(
    scope: PaperPerformanceScope,
    settlements: readonly PaperPerformanceSettlementEvent[],
    sessions: readonly PaperSessionPerformanceEvent[],
    generatedAtIso: string,
  ): PaperPerformanceAnalyticsReport {
    const strategySummaries = this.strategySummaries(settlements);
    const consensusSummary = this.consensusSummary(settlements);
    const bankrollGrowth = this.bankrollGrowth(settlements, sessions);
    const sessionSummary = this.sessionSummary(sessions);
    const milestoneSummaries = this.milestoneSummaries(settlements);
    const falsePositiveCount = settlements.filter((event) => event.result === 'RED').length;
    const falseNegativeCount = 0;

    return Object.freeze({
      scope,
      generatedAtIso,
      settlementCount: settlements.length,
      strategySummaries,
      consensusSummary,
      bankrollGrowth,
      sessionSummary,
      milestoneSummaries,
      falsePositiveCount,
      falseNegativeCount,
      hudSummary: this.hudSummary(strategySummaries, consensusSummary, bankrollGrowth, sessionSummary),
      paperOnly: true,
      liveMoneyAuthorized: false,
      productionMoneyAllowed: false,
      operatorDecisionRequired: true,
      supervisedRecommendationOnly: true,
    });
  }

  private strategySummaries(settlements: readonly PaperPerformanceSettlementEvent[]): readonly StrategyPerformanceSummary[] {
    const strategyIds = [...new Set(settlements.map((event) => event.strategyId))].sort();

    return Object.freeze(strategyIds.map((strategyId) => {
      const events = settlements.filter((event) => event.strategyId === strategyId);
      return this.strategySummary(strategyId, events);
    }));
  }

  private strategySummary(strategyId: string, events: readonly PaperPerformanceSettlementEvent[]): StrategyPerformanceSummary {
    const wins = events.filter((event) => event.result === 'GREEN').length;
    const losses = events.filter((event) => event.result === 'RED').length;
    const voids = events.filter((event) => event.result === 'VOID').length;
    const resolved = wins + losses;
    const totalStake = this.money(events.reduce((sum, event) => sum + event.stakeAmount, 0));
    const profitLossAmount = this.money(events.reduce((sum, event) => sum + event.profitLossAmount, 0));

    return Object.freeze({
      strategyId,
      total: events.length,
      wins,
      losses,
      voids,
      hitRatePercent: this.percent(wins, resolved),
      roiPercent: totalStake > 0 ? this.percentValue((profitLossAmount / totalStake) * 100) : 0,
      totalStake,
      profitLossAmount,
      averageProfitLoss: events.length > 0 ? this.money(profitLossAmount / events.length) : 0,
      maxConsecutiveWins: this.maxConsecutive(events, 'GREEN'),
      maxConsecutiveLosses: this.maxConsecutive(events, 'RED'),
    });
  }

  private consensusSummary(settlements: readonly PaperPerformanceSettlementEvent[]): ConsensusPerformanceSummary {
    const consensusEvents = settlements.filter((event) => (event.consensusStrategyIds ?? []).length >= 2);
    const wins = consensusEvents.filter((event) => event.result === 'GREEN').length;
    const losses = consensusEvents.filter((event) => event.result === 'RED').length;
    const voids = consensusEvents.filter((event) => event.result === 'VOID').length;
    const resolved = wins + losses;
    const totalStake = consensusEvents.reduce((sum, event) => sum + event.stakeAmount, 0);
    const profitLossAmount = this.money(consensusEvents.reduce((sum, event) => sum + event.profitLossAmount, 0));

    return Object.freeze({
      total: consensusEvents.length,
      wins,
      losses,
      voids,
      hitRatePercent: this.percent(wins, resolved),
      roiPercent: totalStake > 0 ? this.percentValue((profitLossAmount / totalStake) * 100) : 0,
      profitLossAmount,
    });
  }

  private bankrollGrowth(
    settlements: readonly PaperPerformanceSettlementEvent[],
    sessions: readonly PaperSessionPerformanceEvent[],
  ): BankrollGrowthSummary {
    if (settlements.length === 0 && sessions.length === 0) {
      return Object.freeze({
        openingBankroll: 0,
        currentBankroll: 0,
        peakBankroll: 0,
        troughBankroll: 0,
        growthAmount: 0,
        growthPercent: 0,
        maxDrawdownAmount: 0,
        maxDrawdownPercent: 0,
      });
    }

    const orderedSettlements = [...settlements].sort((a, b) => a.settledAtIso.localeCompare(b.settledAtIso));
    const openingBankroll = orderedSettlements[0]?.bankrollBefore ?? sessions[0]?.openingBankroll ?? 0;
    const currentBankroll = orderedSettlements[orderedSettlements.length - 1]?.bankrollAfter ?? sessions[sessions.length - 1]?.closingBankroll ?? openingBankroll;
    const curve = [
      openingBankroll,
      ...orderedSettlements.map((event) => event.bankrollAfter),
      ...sessions.map((session) => session.closingBankroll),
    ];
    const peakBankroll = Math.max(...curve);
    const troughBankroll = Math.min(...curve);
    const growthAmount = this.money(currentBankroll - openingBankroll);
    const growthPercent = openingBankroll > 0 ? this.percentValue((growthAmount / openingBankroll) * 100) : 0;
    const drawdown = this.maxDrawdown(curve);

    return Object.freeze({
      openingBankroll: this.money(openingBankroll),
      currentBankroll: this.money(currentBankroll),
      peakBankroll: this.money(peakBankroll),
      troughBankroll: this.money(troughBankroll),
      growthAmount,
      growthPercent,
      maxDrawdownAmount: drawdown.amount,
      maxDrawdownPercent: drawdown.percent,
    });
  }

  private sessionSummary(sessions: readonly PaperSessionPerformanceEvent[]): SessionPerformanceSummary {
    const stopWinSessions = sessions.filter((session) => session.stopReason === 'STOP_WIN').length;
    const stopLossSessions = sessions.filter((session) => session.stopReason === 'STOP_LOSS').length;
    const neutralSessions = sessions.filter((session) => session.stopReason === 'NONE').length;
    const totalProfitLoss = sessions.reduce((sum, session) => sum + (session.closingBankroll - session.openingBankroll), 0);

    return Object.freeze({
      totalSessions: sessions.length,
      stopWinSessions,
      stopLossSessions,
      neutralSessions,
      averageSessionProfitLoss: sessions.length > 0 ? this.money(totalProfitLoss / sessions.length) : 0,
    });
  }

  private milestoneSummaries(settlements: readonly PaperPerformanceSettlementEvent[]): readonly MilestonePerformanceSummary[] {
    const milestonePercents = [...new Set(settlements
      .map((event) => event.milestonePercent)
      .filter((value): value is number => typeof value === 'number'))].sort((a, b) => a - b);

    return Object.freeze(milestonePercents.map((milestonePercent) => {
      const events = settlements.filter((event) => event.milestonePercent === milestonePercent);
      const wins = events.filter((event) => event.result === 'GREEN').length;
      const losses = events.filter((event) => event.result === 'RED').length;
      const resolved = wins + losses;

      return Object.freeze({
        milestonePercent,
        hits: events.length,
        winsAfterMilestone: wins,
        lossesAfterMilestone: losses,
        hitRateAfterMilestonePercent: this.percent(wins, resolved),
        profitLossAfterMilestone: this.money(events.reduce((sum, event) => sum + event.profitLossAmount, 0)),
      });
    }));
  }

  private maxConsecutive(events: readonly PaperPerformanceSettlementEvent[], result: PaperPerformanceResult): number {
    let max = 0;
    let current = 0;

    for (const event of events) {
      if (event.result === result) {
        current += 1;
        max = Math.max(max, current);
      } else if (event.result !== 'VOID') {
        current = 0;
      }
    }

    return max;
  }

  private maxDrawdown(curve: readonly number[]): { readonly amount: number; readonly percent: number } {
    let peak = curve[0] ?? 0;
    let maxDrawdownAmount = 0;

    for (const value of curve) {
      peak = Math.max(peak, value);
      maxDrawdownAmount = Math.max(maxDrawdownAmount, peak - value);
    }

    return Object.freeze({
      amount: this.money(maxDrawdownAmount),
      percent: peak > 0 ? this.percentValue((maxDrawdownAmount / peak) * 100) : 0,
    });
  }

  private filterRecent(settlements: readonly PaperPerformanceSettlementEvent[], nowIso: string, days: number): readonly PaperPerformanceSettlementEvent[] {
    const cutoff = new Date(nowIso).getTime() - (days * 24 * 60 * 60 * 1000);
    return Object.freeze(settlements.filter((event) => new Date(event.settledAtIso).getTime() >= cutoff));
  }

  private filterRecentSessions(sessions: readonly PaperSessionPerformanceEvent[], nowIso: string, days: number): readonly PaperSessionPerformanceEvent[] {
    const cutoff = new Date(nowIso).getTime() - (days * 24 * 60 * 60 * 1000);
    return Object.freeze(sessions.filter((session) => new Date(session.finishedAtIso).getTime() >= cutoff));
  }

  private hudSummary(
    strategySummaries: readonly StrategyPerformanceSummary[],
    consensusSummary: ConsensusPerformanceSummary,
    bankrollGrowth: BankrollGrowthSummary,
    sessionSummary: SessionPerformanceSummary,
  ): string {
    const strategyText = strategySummaries
      .map((summary) => `${summary.strategyId}:${summary.hitRatePercent}%/${summary.profitLossAmount}`)
      .join(',');

    return [
      `strategies=${strategyText || 'none'}`,
      `consensus=${consensusSummary.hitRatePercent}%/${consensusSummary.profitLossAmount}`,
      `bankroll=${bankrollGrowth.openingBankroll}->${bankrollGrowth.currentBankroll}`,
      `growth=${bankrollGrowth.growthPercent}%`,
      `drawdown=${bankrollGrowth.maxDrawdownPercent}%`,
      `sessions=${sessionSummary.totalSessions}`,
      'paperOnly=true',
      'liveMoneyAuthorized=false',
    ].join(' | ');
  }

  private percent(part: number, total: number): number {
    if (total <= 0) {
      return 0;
    }

    return this.percentValue((part / total) * 100);
  }

  private percentValue(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(value * 100) / 100;
  }

  private money(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(value * 100) / 100;
  }
}
