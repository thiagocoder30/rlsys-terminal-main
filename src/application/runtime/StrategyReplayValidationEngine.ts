export type ReplayStrategyId = 'fusion-reduzida' | 'triplicacao' | 'consensus';
export type ReplaySignalTarget = 'RED' | 'BLACK';
export type ReplaySettlementResult = 'GREEN' | 'RED' | 'VOID';
export type ReplayReadinessClassification =
  | 'NOT_READY'
  | 'REVIEW_REQUIRED'
  | 'PAPER_READY'
  | 'PAPER_READY_HIGH_CONFIDENCE';

export interface ReplaySignal {
  readonly strategyId: ReplayStrategyId | string;
  readonly roundIndex: number;
  readonly target: ReplaySignalTarget;
  readonly confidenceScore: number;
  readonly riskScore: number;
  readonly stakeAmount?: number;
  readonly reasons?: readonly string[];
}

export interface ReplayOptions {
  readonly initialBankroll?: number;
  readonly stakeAmount?: number;
  readonly minSignalsForPaperReady?: number;
  readonly minWinRateForPaperReady?: number;
  readonly minProfitFactorForPaperReady?: number;
  readonly maxDrawdownPercentForPaperReady?: number;
}

export interface ReplaySettledSignal {
  readonly strategyId: string;
  readonly signalRoundIndex: number;
  readonly settlementRoundIndex: number;
  readonly target: ReplaySignalTarget;
  readonly settlementNumber: number;
  readonly settlementColor: ReplaySignalTarget | 'ZERO';
  readonly result: ReplaySettlementResult;
  readonly confidenceScore: number;
  readonly riskScore: number;
  readonly stakeAmount: number;
  readonly profitLossAmount: number;
  readonly bankrollBefore: number;
  readonly bankrollAfter: number;
}

export interface ReplayStrategyMetrics {
  readonly strategyId: string;
  readonly totalSignals: number;
  readonly greens: number;
  readonly reds: number;
  readonly voids: number;
  readonly winRatePercent: number;
  readonly lossRatePercent: number;
  readonly profitFactor: number;
  readonly profitLossAmount: number;
  readonly roiPercent: number;
  readonly maxDrawdownPercent: number;
  readonly longestGreenStreak: number;
  readonly longestRedStreak: number;
  readonly averageConfidence: number;
  readonly averageRisk: number;
  readonly confidenceAccuracyPercent: number;
}

export interface StrategyReplayValidationReport {
  readonly sampleSize: number;
  readonly initialBankroll: number;
  readonly finalBankroll: number;
  readonly totalProfitLossAmount: number;
  readonly totalRoiPercent: number;
  readonly maxDrawdownPercent: number;
  readonly settledSignals: readonly ReplaySettledSignal[];
  readonly strategyMetrics: readonly ReplayStrategyMetrics[];
  readonly classification: ReplayReadinessClassification;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly reasons: readonly string[];
  readonly auditText: string;
  readonly paperOnly: true;
  readonly liveMoneyAuthorized: false;
  readonly productionMoneyAllowed: false;
  readonly operatorDecisionRequired: true;
  readonly supervisedRecommendationOnly: true;
}

const RED_NUMBERS: ReadonlySet<number> = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

const BLACK_NUMBERS: ReadonlySet<number> = new Set([
  2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35,
]);

export class StrategyReplayValidationEngine {
  public validate(
    history: readonly number[],
    signals: readonly ReplaySignal[],
    options: ReplayOptions = {},
  ): StrategyReplayValidationReport {
    const normalizedHistory = this.normalizeHistory(history);
    const initialBankroll = this.money(options.initialBankroll ?? 100);
    const defaultStakeAmount = this.money(options.stakeAmount ?? 1);

    const settledSignals: ReplaySettledSignal[] = [];
    let bankroll = initialBankroll;
    let peakBankroll = initialBankroll;
    let maxDrawdownPercent = 0;

    const orderedSignals = [...signals]
      .filter((signal) => signal.roundIndex >= 0 && signal.roundIndex + 1 < normalizedHistory.length)
      .sort((left, right) => left.roundIndex - right.roundIndex);

    for (const signal of orderedSignals) {
      const settlementRoundIndex = signal.roundIndex + 1;
      const settlementNumber = normalizedHistory[settlementRoundIndex];
      const settlementColor = this.toColor(settlementNumber);
      const result = this.resolve(signal.target, settlementColor);
      const stakeAmount = this.money(signal.stakeAmount ?? defaultStakeAmount);
      const bankrollBefore = bankroll;
      const profitLossAmount = this.profitLoss(stakeAmount, result);

      bankroll = this.money(bankroll + profitLossAmount);
      peakBankroll = Math.max(peakBankroll, bankroll);
      maxDrawdownPercent = Math.max(maxDrawdownPercent, this.percentValue(((peakBankroll - bankroll) / Math.max(0.01, peakBankroll)) * 100));

      settledSignals.push(Object.freeze({
        strategyId: signal.strategyId,
        signalRoundIndex: signal.roundIndex,
        settlementRoundIndex,
        target: signal.target,
        settlementNumber,
        settlementColor,
        result,
        confidenceScore: this.clampRatio(signal.confidenceScore),
        riskScore: this.clampRatio(signal.riskScore),
        stakeAmount,
        profitLossAmount,
        bankrollBefore,
        bankrollAfter: bankroll,
      }));
    }

    const strategyMetrics = this.strategyMetrics(settledSignals, initialBankroll);
    const totalProfitLossAmount = this.money(bankroll - initialBankroll);
    const totalRoiPercent = this.percentValue((totalProfitLossAmount / Math.max(0.01, initialBankroll)) * 100);
    const classification = this.classify(strategyMetrics, maxDrawdownPercent, options);
    const blockers = this.blockers(strategyMetrics, maxDrawdownPercent, classification, options);
    const warnings = this.warnings(strategyMetrics, maxDrawdownPercent);
    const reasons = Object.freeze([
      `REPLAY_SAMPLE_SIZE:${normalizedHistory.length}`,
      `REPLAY_SIGNAL_COUNT:${settledSignals.length}`,
      `REPLAY_TOTAL_PL:${totalProfitLossAmount}`,
      `REPLAY_TOTAL_ROI:${totalRoiPercent}`,
      `REPLAY_MAX_DRAWDOWN:${maxDrawdownPercent}`,
      `REPLAY_CLASSIFICATION:${classification}`,
    ]);

    const reportBase = {
      sampleSize: normalizedHistory.length,
      initialBankroll,
      finalBankroll: bankroll,
      totalProfitLossAmount,
      totalRoiPercent,
      maxDrawdownPercent,
      settledSignals: Object.freeze(settledSignals),
      strategyMetrics,
      classification,
      blockers,
      warnings,
      reasons,
      paperOnly: true as const,
      liveMoneyAuthorized: false as const,
      productionMoneyAllowed: false as const,
      operatorDecisionRequired: true as const,
      supervisedRecommendationOnly: true as const,
    };

    return Object.freeze({
      ...reportBase,
      auditText: this.composeAuditText(reportBase),
    });
  }

  public generateNaiveColorSignals(
    history: readonly number[],
    strategyId: ReplayStrategyId | string,
    startRoundIndex: number,
    everyRounds: number = 3,
  ): readonly ReplaySignal[] {
    const normalizedHistory = this.normalizeHistory(history);
    const output: ReplaySignal[] = [];

    for (let index = startRoundIndex; index + 1 < normalizedHistory.length; index += Math.max(1, everyRounds)) {
      const color = this.toColor(normalizedHistory[index]);
      if (color === 'ZERO') continue;

      output.push(Object.freeze({
        strategyId,
        roundIndex: index,
        target: color,
        confidenceScore: 0.6,
        riskScore: 0.4,
        reasons: Object.freeze(['NAIVE_REPLAY_SIGNAL_FOR_ENGINE_VALIDATION']),
      }));
    }

    return Object.freeze(output);
  }

  private strategyMetrics(
    settledSignals: readonly ReplaySettledSignal[],
    initialBankroll: number,
  ): readonly ReplayStrategyMetrics[] {
    const strategyIds = [...new Set(settledSignals.map((signal) => signal.strategyId))].sort();

    return Object.freeze(strategyIds.map((strategyId) => {
      const items = settledSignals.filter((signal) => signal.strategyId === strategyId);
      const greens = items.filter((signal) => signal.result === 'GREEN').length;
      const reds = items.filter((signal) => signal.result === 'RED').length;
      const voids = items.filter((signal) => signal.result === 'VOID').length;
      const resolved = greens + reds;
      const grossProfit = items.filter((signal) => signal.profitLossAmount > 0).reduce((sum, signal) => sum + signal.profitLossAmount, 0);
      const grossLoss = Math.abs(items.filter((signal) => signal.profitLossAmount < 0).reduce((sum, signal) => sum + signal.profitLossAmount, 0));
      const profitLossAmount = this.money(items.reduce((sum, signal) => sum + signal.profitLossAmount, 0));

      return Object.freeze({
        strategyId,
        totalSignals: items.length,
        greens,
        reds,
        voids,
        winRatePercent: this.percent(greens, resolved),
        lossRatePercent: this.percent(reds, resolved),
        profitFactor: grossLoss === 0 ? (grossProfit > 0 ? 999 : 0) : this.round(grossProfit / grossLoss),
        profitLossAmount,
        roiPercent: this.percentValue((profitLossAmount / Math.max(0.01, initialBankroll)) * 100),
        maxDrawdownPercent: this.strategyDrawdown(items),
        longestGreenStreak: this.longestStreak(items, 'GREEN'),
        longestRedStreak: this.longestStreak(items, 'RED'),
        averageConfidence: this.averageRatio(items.map((signal) => signal.confidenceScore)),
        averageRisk: this.averageRatio(items.map((signal) => signal.riskScore)),
        confidenceAccuracyPercent: this.confidenceAccuracy(items),
      });
    }));
  }

  private classify(
    metrics: readonly ReplayStrategyMetrics[],
    maxDrawdownPercent: number,
    options: ReplayOptions,
  ): ReplayReadinessClassification {
    const minSignals = options.minSignalsForPaperReady ?? 20;
    const minWinRate = options.minWinRateForPaperReady ?? 52;
    const minProfitFactor = options.minProfitFactorForPaperReady ?? 1.05;
    const maxDrawdown = options.maxDrawdownPercentForPaperReady ?? 12;

    const consensus = metrics.find((metric) => metric.strategyId === 'consensus');
    const best = consensus ?? [...metrics].sort((a, b) => b.profitFactor - a.profitFactor)[0];

    if (!best || best.totalSignals < Math.max(5, Math.floor(minSignals / 2))) {
      return 'NOT_READY';
    }

    if (best.totalSignals >= minSignals && best.winRatePercent >= 58 && best.profitFactor >= 1.25 && maxDrawdownPercent <= maxDrawdown * 0.75) {
      return 'PAPER_READY_HIGH_CONFIDENCE';
    }

    if (best.totalSignals >= minSignals && best.winRatePercent >= minWinRate && best.profitFactor >= minProfitFactor && maxDrawdownPercent <= maxDrawdown) {
      return 'PAPER_READY';
    }

    return 'REVIEW_REQUIRED';
  }

  private blockers(
    metrics: readonly ReplayStrategyMetrics[],
    maxDrawdownPercent: number,
    classification: ReplayReadinessClassification,
    options: ReplayOptions,
  ): readonly string[] {
    const blockers: string[] = [];
    const minSignals = options.minSignalsForPaperReady ?? 20;
    const maxDrawdown = options.maxDrawdownPercentForPaperReady ?? 12;
    const totalSignals = metrics.reduce((sum, metric) => sum + metric.totalSignals, 0);

    if (totalSignals < minSignals) blockers.push('REPLAY_SIGNAL_SAMPLE_INSUFFICIENT');
    if (maxDrawdownPercent > maxDrawdown) blockers.push('REPLAY_DRAWDOWN_ABOVE_THRESHOLD');
    if (classification === 'NOT_READY') blockers.push('REPLAY_CLASSIFICATION_NOT_READY');

    return Object.freeze(blockers);
  }

  private warnings(
    metrics: readonly ReplayStrategyMetrics[],
    maxDrawdownPercent: number,
  ): readonly string[] {
    const warnings: string[] = [];

    if (metrics.some((metric) => metric.longestRedStreak >= 4)) {
      warnings.push('REPLAY_LONG_RED_STREAK_DETECTED');
    }

    if (metrics.some((metric) => metric.confidenceAccuracyPercent < 50)) {
      warnings.push('REPLAY_CONFIDENCE_ACCURACY_WEAK');
    }

    if (maxDrawdownPercent >= 8) {
      warnings.push('REPLAY_DRAWDOWN_REQUIRES_REVIEW');
    }

    return Object.freeze(warnings);
  }

  private composeAuditText(report: {
    readonly sampleSize: number;
    readonly initialBankroll: number;
    readonly finalBankroll: number;
    readonly totalProfitLossAmount: number;
    readonly totalRoiPercent: number;
    readonly maxDrawdownPercent: number;
    readonly strategyMetrics: readonly ReplayStrategyMetrics[];
    readonly classification: ReplayReadinessClassification;
    readonly blockers: readonly string[];
    readonly warnings: readonly string[];
  }): string {
    return [
      'STRATEGY REPLAY VALIDATION',
      `SAMPLE_SIZE=${report.sampleSize}`,
      `INITIAL_BANKROLL=${report.initialBankroll}`,
      `FINAL_BANKROLL=${report.finalBankroll}`,
      `TOTAL_PL=${report.totalProfitLossAmount}`,
      `TOTAL_ROI=${report.totalRoiPercent}%`,
      `MAX_DRAWDOWN=${report.maxDrawdownPercent}%`,
      `CLASSIFICATION=${report.classification}`,
      'STRATEGIES:',
      ...report.strategyMetrics.map((metric) => `${metric.strategyId}: signals=${metric.totalSignals} green=${metric.greens} red=${metric.reds} void=${metric.voids} winRate=${metric.winRatePercent}% profitFactor=${metric.profitFactor} drawdown=${metric.maxDrawdownPercent}% confidenceAccuracy=${metric.confidenceAccuracyPercent}%`),
      `BLOCKERS=${report.blockers.join(',') || 'none'}`,
      `WARNINGS=${report.warnings.join(',') || 'none'}`,
      'paperOnly=true',
      'liveMoneyAuthorized=false',
    ].join('\n');
  }

  private normalizeHistory(history: readonly number[]): readonly number[] {
    return Object.freeze(history.filter((value) => Number.isInteger(value) && value >= 0 && value <= 36));
  }

  private toColor(value: number): ReplaySignalTarget | 'ZERO' {
    if (value === 0) return 'ZERO';
    if (RED_NUMBERS.has(value)) return 'RED';
    if (BLACK_NUMBERS.has(value)) return 'BLACK';
    return 'ZERO';
  }

  private resolve(target: ReplaySignalTarget, color: ReplaySignalTarget | 'ZERO'): ReplaySettlementResult {
    if (color === 'ZERO') return 'VOID';
    return target === color ? 'GREEN' : 'RED';
  }

  private profitLoss(stakeAmount: number, result: ReplaySettlementResult): number {
    if (result === 'GREEN') return this.money(stakeAmount);
    if (result === 'RED') return this.money(-stakeAmount);
    return 0;
  }

  private strategyDrawdown(items: readonly ReplaySettledSignal[]): number {
    if (items.length === 0) return 0;

    let peak = items[0].bankrollBefore;
    let maxDrawdown = 0;

    for (const item of items) {
      peak = Math.max(peak, item.bankrollAfter);
      maxDrawdown = Math.max(maxDrawdown, this.percentValue(((peak - item.bankrollAfter) / Math.max(0.01, peak)) * 100));
    }

    return maxDrawdown;
  }

  private longestStreak(items: readonly ReplaySettledSignal[], result: ReplaySettlementResult): number {
    let current = 0;
    let max = 0;

    for (const item of items) {
      if (item.result === result) {
        current += 1;
        max = Math.max(max, current);
      } else if (item.result !== 'VOID') {
        current = 0;
      }
    }

    return max;
  }

  private confidenceAccuracy(items: readonly ReplaySettledSignal[]): number {
    const resolved = items.filter((item) => item.result !== 'VOID');
    if (resolved.length === 0) return 0;

    const score = resolved.reduce((sum, item) => {
      const expectedWin = item.confidenceScore >= 0.5;
      const wasGreen = item.result === 'GREEN';
      return sum + (expectedWin === wasGreen ? 1 : 0);
    }, 0);

    return this.percent(score, resolved.length);
  }

  private averageRatio(values: readonly number[]): number {
    if (values.length === 0) return 0;
    return this.clampRatio(values.reduce((sum, value) => sum + this.clampRatio(value), 0) / values.length);
  }

  private percent(part: number, total: number): number {
    if (total <= 0) return 0;
    return this.percentValue((part / total) * 100);
  }

  private percentValue(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100) / 100;
  }

  private round(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100) / 100;
  }

  private money(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100) / 100;
  }

  private clampRatio(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(Math.max(0, Math.min(1, value)) * 1000) / 1000;
  }
}
