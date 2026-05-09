import { RouletteSectorName, RouletteStats } from './RouletteStats';
import { StrategyEngine, StrategyEngineOptions } from './StrategyEngine';

export interface BacktestTrade {
  index: number;
  target: RouletteSectorName;
  stakeFraction: number;
  won: boolean;
  payout: number;
  equity: number;
}

export interface BacktestSummary {
  trades: number;
  wins: number;
  losses: number;
  hitRate: number;
  roi: number;
  maxDrawdown: number;
  expectancyPerTrade: number;
  finalEquity: number;
}

export interface BacktestResult {
  summary: BacktestSummary;
  trades: BacktestTrade[];
}

export class BacktestEngine {
  private readonly stats = new RouletteStats();

  constructor(
    private readonly engineOptions: Partial<StrategyEngineOptions> = {},
    private readonly initialEquity = 1
  ) {}

  public runWalkForward(history: number[]): BacktestResult {
    const minSampleSize = this.engineOptions.minSampleSize ?? 120;
    const engine = new StrategyEngine(this.engineOptions);
    const trades: BacktestTrade[] = [];
    let equity = this.initialEquity;
    let peak = equity;
    let maxDrawdown = 0;

    for (let i = minSampleSize; i < history.length - 1; i++) {
      const trainingWindow = history.slice(0, i);
      const decision = engine.analyze(trainingWindow);
      if (!decision || decision.status !== 'ALLOWED' || decision.signals.length === 0) continue;

      const primarySignal = decision.signals[0];
      const nextNumber = history[i + 1];
      const nextSector = this.stats.sectorOf(nextNumber);
      const won = nextSector === primarySignal.target;
      const stakeFraction = decision.suggestedFraction;
      const sectorSize = primarySignal.target === 'unknown' ? 0 : RouletteStats.SECTORS[primarySignal.target]?.length ?? 0;
      const fairPayoutProxy = sectorSize > 0 ? RouletteStats.EUROPEAN_WHEEL_SIZE / sectorSize - 1 : 0;
      const pnl = won ? stakeFraction * fairPayoutProxy : -stakeFraction;
      equity *= 1 + pnl;
      peak = Math.max(peak, equity);
      maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak);

      trades.push({
        index: i + 1,
        target: primarySignal.target,
        stakeFraction,
        won,
        payout: pnl,
        equity
      });
    }

    const wins = trades.filter(trade => trade.won).length;
    const losses = trades.length - wins;
    const roi = equity / this.initialEquity - 1;
    const expectancyPerTrade = trades.length === 0 ? 0 : trades.reduce((sum, trade) => sum + trade.payout, 0) / trades.length;

    return {
      summary: {
        trades: trades.length,
        wins,
        losses,
        hitRate: trades.length === 0 ? 0 : wins / trades.length,
        roi,
        maxDrawdown,
        expectancyPerTrade,
        finalEquity: equity
      },
      trades
    };
  }
}
