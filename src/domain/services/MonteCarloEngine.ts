import { BacktestSummary } from './BacktestEngine';

export interface MonteCarloOptions {
  simulations: number;
  horizonTrades: number;
  ruinThreshold: number;
  seed?: number;
}

export interface MonteCarloSummary {
  simulations: number;
  horizonTrades: number;
  ruinThreshold: number;
  probabilityOfRuin: number;
  medianFinalEquity: number;
  p05FinalEquity: number;
  p95FinalEquity: number;
  expectedMaxDrawdown: number;
  p95MaxDrawdown: number;
}

const DEFAULT_OPTIONS: MonteCarloOptions = {
  simulations: 2000,
  horizonTrades: 250,
  ruinThreshold: 0.7,
  seed: 1337
};

export class MonteCarloEngine {
  public runFromBacktest(backtest: BacktestSummary, options: Partial<MonteCarloOptions> = {}): MonteCarloSummary {
    const config = { ...DEFAULT_OPTIONS, ...options };
    if (backtest.trades === 0) {
      return this.empty(config);
    }

    const winRate = this.clamp(backtest.hitRate);
    const averageWin = winRate > 0
      ? Math.max(0, backtest.expectancyPerTrade + (1 - winRate) * Math.abs(backtest.expectancyPerTrade || 0.001)) / winRate
      : 0;
    const averageLoss = Math.max(0.001, Math.abs(Math.min(0, backtest.expectancyPerTrade)) || 0.005);
    const rng = this.seededRandom(config.seed ?? 1337);
    const finals: number[] = [];
    const drawdowns: number[] = [];
    let ruined = 0;

    for (let simulation = 0; simulation < config.simulations; simulation++) {
      let equity = 1;
      let peak = 1;
      let maxDrawdown = 0;

      for (let trade = 0; trade < config.horizonTrades; trade++) {
        const pnl = rng() < winRate ? averageWin : -averageLoss;
        equity *= Math.max(0.01, 1 + pnl);
        peak = Math.max(peak, equity);
        maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak);
      }

      if (equity <= config.ruinThreshold) ruined++;
      finals.push(equity);
      drawdowns.push(maxDrawdown);
    }

    finals.sort((a, b) => a - b);
    drawdowns.sort((a, b) => a - b);

    return {
      simulations: config.simulations,
      horizonTrades: config.horizonTrades,
      ruinThreshold: config.ruinThreshold,
      probabilityOfRuin: ruined / config.simulations,
      medianFinalEquity: this.percentile(finals, 0.5),
      p05FinalEquity: this.percentile(finals, 0.05),
      p95FinalEquity: this.percentile(finals, 0.95),
      expectedMaxDrawdown: drawdowns.reduce((sum, value) => sum + value, 0) / drawdowns.length,
      p95MaxDrawdown: this.percentile(drawdowns, 0.95)
    };
  }

  private empty(config: MonteCarloOptions): MonteCarloSummary {
    return {
      simulations: config.simulations,
      horizonTrades: config.horizonTrades,
      ruinThreshold: config.ruinThreshold,
      probabilityOfRuin: 1,
      medianFinalEquity: 1,
      p05FinalEquity: 1,
      p95FinalEquity: 1,
      expectedMaxDrawdown: 0,
      p95MaxDrawdown: 0
    };
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const index = Math.min(values.length - 1, Math.max(0, Math.floor(p * (values.length - 1))));
    return values[index];
  }

  private seededRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  }

  private clamp(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
  }
}
