import { RouletteSectorName, RouletteStats } from '../services/RouletteStats';
import { StrategyEngine, StrategyEngineOptions } from '../services/StrategyEngine';

export type BacktestDecision = 'TRADE' | 'SKIP';
export type BaselinePolicy = 'RANDOM_SECTOR' | 'ALWAYS_VOISINS' | 'NO_TRADE';

export interface InstitutionalBacktestOptions {
  initialEquity: number;
  trainingWindow: number;
  testWindow: number;
  stepSize: number;
  maxStakeFraction: number;
  baselinePolicy: BaselinePolicy;
  engineOptions: Partial<StrategyEngineOptions>;
}

export interface InstitutionalTrade {
  index: number;
  windowId: number;
  decision: BacktestDecision;
  target: RouletteSectorName | 'none';
  stakeFraction: number;
  won: boolean;
  pnl: number;
  equity: number;
  drawdown: number;
}

export interface BacktestWindowSummary {
  id: number;
  trainStart: number;
  trainEnd: number;
  testStart: number;
  testEnd: number;
  trades: number;
  roi: number;
  maxDrawdown: number;
  expectancy: number;
}

export interface BaselineComparison {
  policy: BaselinePolicy;
  trades: number;
  roi: number;
  maxDrawdown: number;
  expectancy: number;
  strategyOutperformed: boolean;
  excessRoi: number;
}

export interface StressScenarioResult {
  name: string;
  equityMultiplier: number;
  roi: number;
  maxDrawdown: number;
  riskFlag: 'PASS' | 'WATCH' | 'FAIL';
}

export interface DrawdownSurfacePoint {
  stakeMultiplier: number;
  maxDrawdown: number;
  finalEquity: number;
  ruinProbabilityProxy: number;
}

export interface InstitutionalBacktestSummary {
  sampleSize: number;
  windows: number;
  trades: number;
  hitRate: number;
  roi: number;
  maxDrawdown: number;
  expectancy: number;
  finalEquity: number;
  profitFactor: number;
  stabilityScore: number;
  riskOfRuinProxy: number;
  approval: 'REJECTED' | 'RESEARCH_REVIEW' | 'CANDIDATE';
  blockers: string[];
}

export interface InstitutionalBacktestResult {
  summary: InstitutionalBacktestSummary;
  windows: BacktestWindowSummary[];
  trades: InstitutionalTrade[];
  baseline: BaselineComparison;
  stress: StressScenarioResult[];
  drawdownSurface: DrawdownSurfacePoint[];
}

const DEFAULT_OPTIONS: InstitutionalBacktestOptions = {
  initialEquity: 1,
  trainingWindow: 240,
  testWindow: 60,
  stepSize: 60,
  maxStakeFraction: 0.01,
  baselinePolicy: 'RANDOM_SECTOR',
  engineOptions: { minSampleSize: 120 }
};

export class InstitutionalBacktestEngine {
  private readonly stats = new RouletteStats();
  private readonly options: InstitutionalBacktestOptions;

  constructor(options: Partial<InstitutionalBacktestOptions> = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      engineOptions: { ...DEFAULT_OPTIONS.engineOptions, ...(options.engineOptions ?? {}) }
    };
  }

  public run(history: number[]): InstitutionalBacktestResult {
    const cleanHistory = this.validate(history);
    const strategyTrades = this.walkForward(cleanHistory, 'STRATEGY');
    const baselineTrades = this.walkForward(cleanHistory, this.options.baselinePolicy);
    const windows = this.windowSummaries(strategyTrades);
    const summary = this.summary(cleanHistory.length, windows, strategyTrades);
    const baseline = this.baselineComparison(summary, baselineTrades);
    const stress = this.stressScenarios(strategyTrades);
    const drawdownSurface = this.drawdownSurface(strategyTrades);

    return { summary: { ...summary, approval: this.approval(summary, baseline, stress), blockers: this.blockers(summary, baseline, stress) }, windows, trades: strategyTrades, baseline, stress, drawdownSurface };
  }

  private validate(history: number[]): number[] {
    const result = RouletteStats.validate(history);
    if (!result.ok) {
      throw new Error(`invalid_backtest_history: ${result.errors.slice(0, 3).join('; ')}`);
    }
    return result.values;
  }

  private walkForward(history: number[], mode: 'STRATEGY' | BaselinePolicy): InstitutionalTrade[] {
    const trades: InstitutionalTrade[] = [];
    let equity = this.options.initialEquity;
    let peak = equity;
    let windowId = 0;
    const engine = new StrategyEngine(this.options.engineOptions);

    for (let trainStart = 0; trainStart + this.options.trainingWindow + this.options.testWindow < history.length; trainStart += this.options.stepSize) {
      const trainEnd = trainStart + this.options.trainingWindow;
      const testEnd = trainEnd + this.options.testWindow;
      const training = history.slice(trainStart, trainEnd);
      const analysis = mode === 'STRATEGY' ? engine.analyze(training) : null;

      for (let index = trainEnd; index < testEnd; index += 1) {
        const decision = this.decision(mode, analysis, index);
        if (decision.target === 'none' || decision.stakeFraction <= 0) continue;

        const nextNumber = history[index];
        const won = this.stats.sectorOf(nextNumber) === decision.target;
        const pnl = this.pnl(decision.target, decision.stakeFraction, won);
        equity *= 1 + pnl;
        peak = Math.max(peak, equity);
        const drawdown = peak === 0 ? 0 : (peak - equity) / peak;

        trades.push({ index, windowId, decision: 'TRADE', target: decision.target, stakeFraction: decision.stakeFraction, won, pnl, equity, drawdown });
      }

      windowId += 1;
    }

    return trades;
  }

  private decision(mode: 'STRATEGY' | BaselinePolicy, analysis: ReturnType<StrategyEngine['analyze']>, index: number): { target: RouletteSectorName | 'none'; stakeFraction: number } {
    if (mode === 'NO_TRADE') return { target: 'none', stakeFraction: 0 };
    if (mode === 'ALWAYS_VOISINS') return { target: 'voisins', stakeFraction: this.options.maxStakeFraction / 2 };
    if (mode === 'RANDOM_SECTOR') {
      const sectors: RouletteSectorName[] = ['voisins', 'tiers', 'orphelins'];
      return { target: sectors[index % sectors.length], stakeFraction: this.options.maxStakeFraction / 2 };
    }

    if (!analysis || analysis.status !== 'ALLOWED' || analysis.signals.length === 0) return { target: 'none', stakeFraction: 0 };
    return {
      target: analysis.signals[0].target,
      stakeFraction: Math.min(this.options.maxStakeFraction, Math.max(0, analysis.suggestedFraction))
    };
  }

  private pnl(target: RouletteSectorName, stakeFraction: number, won: boolean): number {
    const sectorSize = target === 'unknown' ? 0 : RouletteStats.SECTORS[target]?.length ?? 0;
    if (!won) return -stakeFraction;
    const payout = sectorSize > 0 ? RouletteStats.EUROPEAN_WHEEL_SIZE / sectorSize - 1 : 0;
    return stakeFraction * payout;
  }

  private windowSummaries(trades: InstitutionalTrade[]): BacktestWindowSummary[] {
    const byWindow = new Map<number, InstitutionalTrade[]>();
    for (const trade of trades) byWindow.set(trade.windowId, [...(byWindow.get(trade.windowId) ?? []), trade]);

    return Array.from(byWindow.entries()).map(([id, rows]) => {
      const first = rows[0];
      const last = rows[rows.length - 1];
      const startEquity = id === 0 ? this.options.initialEquity : trades.find(t => t.windowId === id - 1)?.equity ?? this.options.initialEquity;
      const roi = last ? last.equity / startEquity - 1 : 0;
      return {
        id,
        trainStart: id * this.options.stepSize,
        trainEnd: id * this.options.stepSize + this.options.trainingWindow,
        testStart: id * this.options.stepSize + this.options.trainingWindow,
        testEnd: id * this.options.stepSize + this.options.trainingWindow + this.options.testWindow,
        trades: rows.length,
        roi: round(roi),
        maxDrawdown: round(Math.max(...rows.map(row => row.drawdown), 0)),
        expectancy: round(rows.reduce((sum, row) => sum + row.pnl, 0) / Math.max(1, rows.length))
      };
    });
  }

  private summary(sampleSize: number, windows: BacktestWindowSummary[], trades: InstitutionalTrade[]): Omit<InstitutionalBacktestSummary, 'approval' | 'blockers'> {
    const wins = trades.filter(trade => trade.won).length;
    const losses = trades.length - wins;
    const grossProfit = trades.filter(trade => trade.pnl > 0).reduce((sum, trade) => sum + trade.pnl, 0);
    const grossLoss = Math.abs(trades.filter(trade => trade.pnl < 0).reduce((sum, trade) => sum + trade.pnl, 0));
    const finalEquity = trades.length > 0 ? trades[trades.length - 1].equity : this.options.initialEquity;
    const positiveWindows = windows.filter(window => window.roi > 0).length;
    const roi = finalEquity / this.options.initialEquity - 1;
    const maxDrawdown = Math.max(...trades.map(trade => trade.drawdown), 0);
    const expectancy = trades.reduce((sum, trade) => sum + trade.pnl, 0) / Math.max(1, trades.length);
    const riskOfRuinProxy = round(Math.min(1, Math.max(0, maxDrawdown * 1.8 + (losses / Math.max(1, trades.length)) * 0.25 - Math.max(0, roi) * 0.1)));

    return {
      sampleSize,
      windows: windows.length,
      trades: trades.length,
      hitRate: round(wins / Math.max(1, trades.length)),
      roi: round(roi),
      maxDrawdown: round(maxDrawdown),
      expectancy: round(expectancy),
      finalEquity: round(finalEquity),
      profitFactor: grossLoss === 0 ? round(grossProfit) : round(grossProfit / grossLoss),
      stabilityScore: round((positiveWindows / Math.max(1, windows.length)) * 0.55 + Math.max(0, 1 - maxDrawdown) * 0.25 + Math.min(1, Math.max(0, roi)) * 0.2),
      riskOfRuinProxy
    };
  }

  private baselineComparison(summary: Omit<InstitutionalBacktestSummary, 'approval' | 'blockers'>, baselineTrades: InstitutionalTrade[]): BaselineComparison {
    const baselineSummary = this.summary(summary.sampleSize, this.windowSummaries(baselineTrades), baselineTrades);
    const excessRoi = round(summary.roi - baselineSummary.roi);
    return {
      policy: this.options.baselinePolicy,
      trades: baselineSummary.trades,
      roi: baselineSummary.roi,
      maxDrawdown: baselineSummary.maxDrawdown,
      expectancy: baselineSummary.expectancy,
      strategyOutperformed: excessRoi > 0,
      excessRoi
    };
  }

  private stressScenarios(trades: InstitutionalTrade[]): StressScenarioResult[] {
    return [
      this.replayStress('stake_half', trades, 0.5),
      this.replayStress('stake_base', trades, 1),
      this.replayStress('stake_double', trades, 2)
    ];
  }

  private replayStress(name: string, trades: InstitutionalTrade[], multiplier: number): StressScenarioResult {
    let equity = this.options.initialEquity;
    let peak = equity;
    let maxDrawdown = 0;
    for (const trade of trades) {
      const pnl = Math.max(-0.99, trade.pnl * multiplier);
      equity *= 1 + pnl;
      peak = Math.max(peak, equity);
      maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak);
    }
    const roi = equity / this.options.initialEquity - 1;
    return {
      name,
      equityMultiplier: multiplier,
      roi: round(roi),
      maxDrawdown: round(maxDrawdown),
      riskFlag: maxDrawdown > 0.35 || roi < -0.2 ? 'FAIL' : maxDrawdown > 0.18 || roi < 0 ? 'WATCH' : 'PASS'
    };
  }

  private drawdownSurface(trades: InstitutionalTrade[]): DrawdownSurfacePoint[] {
    return [0.25, 0.5, 1, 1.5, 2].map(multiplier => {
      const stress = this.replayStress(`surface_${multiplier}`, trades, multiplier);
      return {
        stakeMultiplier: multiplier,
        maxDrawdown: stress.maxDrawdown,
        finalEquity: round(1 + stress.roi),
        ruinProbabilityProxy: round(Math.min(1, stress.maxDrawdown * 1.7 + (stress.roi < 0 ? 0.15 : 0)))
      };
    });
  }

  private approval(summary: Omit<InstitutionalBacktestSummary, 'approval' | 'blockers'>, baseline: BaselineComparison, stress: StressScenarioResult[]): InstitutionalBacktestSummary['approval'] {
    if (summary.trades < 30 || summary.maxDrawdown > 0.35 || summary.riskOfRuinProxy > 0.35 || stress.some(item => item.riskFlag === 'FAIL')) return 'REJECTED';
    if (baseline.strategyOutperformed && summary.roi > 0 && summary.stabilityScore >= 0.55 && summary.riskOfRuinProxy <= 0.22) return 'CANDIDATE';
    return 'RESEARCH_REVIEW';
  }

  private blockers(summary: Omit<InstitutionalBacktestSummary, 'approval' | 'blockers'>, baseline: BaselineComparison, stress: StressScenarioResult[]): string[] {
    const blockers: string[] = [];
    if (summary.trades < 30) blockers.push('insufficient_out_of_sample_trades');
    if (summary.roi <= 0) blockers.push('non_positive_strategy_roi');
    if (!baseline.strategyOutperformed) blockers.push('baseline_not_outperformed');
    if (summary.maxDrawdown > 0.35) blockers.push('drawdown_above_institutional_limit');
    if (summary.riskOfRuinProxy > 0.35) blockers.push('risk_of_ruin_proxy_above_limit');
    if (stress.some(item => item.riskFlag === 'FAIL')) blockers.push('stress_scenario_failed');
    return blockers;
  }
}

function round(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(6));
}
