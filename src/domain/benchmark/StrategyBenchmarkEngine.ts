import crypto from 'crypto';
import { RouletteStats, RouletteSectorName } from '../services/RouletteStats';

export type BenchmarkStrategyId =
  | 'NO_BET'
  | 'RANDOM_SECTOR'
  | 'FIXED_VOISINS'
  | 'FIXED_TIERS'
  | 'FIXED_ORPHELINS'
  | 'ADAPTIVE_HOT_SECTOR'
  | 'ADAPTIVE_TRANSITION_SECTOR';

export type BenchmarkVerdict = 'REJECTED' | 'RESEARCH_REVIEW' | 'BENCHMARK_CANDIDATE';
export type RelativeEdgeGrade = 'NEGATIVE' | 'NEUTRAL' | 'MODEST' | 'STRONG';
export type RoulettePlayableSector = Exclude<RouletteSectorName, 'zero' | 'unknown'>;

export interface BenchmarkEngineOptions {
  readonly initialCapital: number;
  readonly stakeFraction: number;
  readonly windowSize: number;
  readonly randomRuns: number;
  readonly seed: string;
  readonly minimumTrades: number;
}

export interface BenchmarkTrade {
  readonly index: number;
  readonly target: RoulettePlayableSector | 'NONE';
  readonly outcome: number;
  readonly profit: number;
  readonly capital: number;
  readonly hit: boolean;
}

export interface BenchmarkStrategyResult {
  readonly strategyId: BenchmarkStrategyId;
  readonly label: string;
  readonly trades: number;
  readonly hitRate: number;
  readonly roi: number;
  readonly finalCapital: number;
  readonly maxDrawdown: number;
  readonly profitFactor: number;
  readonly expectancyPerTrade: number;
  readonly capitalEfficiency: number;
  readonly sampleTrades: BenchmarkTrade[];
}

export interface BaselineDistributionSummary {
  readonly runs: number;
  readonly medianRoi: number;
  readonly p05Roi: number;
  readonly p95Roi: number;
  readonly medianMaxDrawdown: number;
  readonly p95MaxDrawdown: number;
  readonly beatRateByCandidate: number;
}

export interface StrategyBenchmarkReport {
  readonly engineVersion: 'strategy-benchmark-v1';
  readonly reportId: string;
  readonly sampleSize: number;
  readonly options: BenchmarkEngineOptions;
  readonly candidates: BenchmarkStrategyResult[];
  readonly baselines: BenchmarkStrategyResult[];
  readonly randomBaseline: BaselineDistributionSummary;
  readonly comparison: {
    readonly bestCandidate?: BenchmarkStrategyResult;
    readonly bestBaseline: BenchmarkStrategyResult;
    readonly relativeEdge: number;
    readonly relativeEdgeGrade: RelativeEdgeGrade;
    readonly benchmarkScore: number;
    readonly overfitPenalty: number;
    readonly baselineDominanceRisk: number;
  };
  readonly governance: {
    readonly operationalGate: 'BLOCKED';
    readonly verdict: BenchmarkVerdict;
    readonly blockers: string[];
  };
}

interface BenchmarkStrategy {
  readonly id: BenchmarkStrategyId;
  readonly label: string;
  selectTarget(historyWindow: readonly number[], globalHistory: readonly number[], index: number): RoulettePlayableSector | 'NONE';
}

const DEFAULT_OPTIONS: BenchmarkEngineOptions = {
  initialCapital: 1000,
  stakeFraction: 0.01,
  windowSize: 60,
  randomRuns: 96,
  seed: 'rlsys-strategy-benchmark-v1',
  minimumTrades: 24
};

const SECTOR_NAMES: RoulettePlayableSector[] = ['voisins', 'tiers', 'orphelins'];

/**
 * Institutional benchmark engine for comparing candidate roulette hypotheses against simple baselines.
 *
 * Architectural decision:
 * - Domain-only component, no Express, filesystem, or framework dependency.
 * - Strategy Pattern allows adding 100+ candidate/baseline strategies without changing the engine core.
 * - Deterministic seeded random baseline makes the operation idempotent and reproducible.
 * - Time complexity is O(n * s + n * r), where n is history size, s is deterministic strategies and r random runs.
 * - Space complexity is O(s + r + sampledTrades), avoiding full random equity curve retention on mobile hardware.
 */
export class StrategyBenchmarkEngine {
  private readonly stats = new RouletteStats();
  private readonly options: BenchmarkEngineOptions;
  private readonly candidateStrategies: BenchmarkStrategy[];
  private readonly baselineStrategies: BenchmarkStrategy[];

  public constructor(options: Partial<BenchmarkEngineOptions> = {}) {
    this.options = this.normalizeOptions(options);
    this.candidateStrategies = StrategyRegistry.candidates(this.stats);
    this.baselineStrategies = StrategyRegistry.baselines();
  }

  public run(history: readonly number[]): StrategyBenchmarkReport {
    const values = this.validate(history);
    const candidates = this.candidateStrategies.map(strategy => this.simulate(values, strategy));
    const deterministicBaselines = this.baselineStrategies.map(strategy => this.simulate(values, strategy));
    const randomResults = this.randomBaseline(values);
    const baselines = [...deterministicBaselines, ...randomResults.slice(0, 3)];
    const bestCandidate = candidates.slice().sort(byRoiThenDrawdown)[0];
    const bestBaseline = [...deterministicBaselines, ...randomResults].sort(byRoiThenDrawdown)[0] ?? this.noBetBaseline(values);
    const randomRois = randomResults.map(result => result.roi).sort(ascending);
    const randomDrawdowns = randomResults.map(result => result.maxDrawdown).sort(ascending);
    const relativeEdge = round((bestCandidate?.roi ?? 0) - bestBaseline.roi);
    const beatRateByCandidate = bestCandidate ? round(average(randomRois.map(roi => bestCandidate.roi > roi ? 1 : 0))) : 0;
    const overfitPenalty = this.overfitPenalty(bestCandidate, bestBaseline, beatRateByCandidate);
    const baselineDominanceRisk = round(Math.max(0, Math.min(1, 1 - beatRateByCandidate + Math.max(0, bestBaseline.roi - (bestCandidate?.roi ?? 0)) * 0.8)));
    const benchmarkScore = round(Math.max(0, Math.min(1,
      beatRateByCandidate * 0.34 +
      Math.max(0, Math.min(1, relativeEdge * 2.5)) * 0.28 +
      (1 - (bestCandidate?.maxDrawdown ?? 1)) * 0.18 +
      Math.min(1, Math.max(0, (bestCandidate?.profitFactor ?? 0) / 2)) * 0.12 +
      (1 - overfitPenalty) * 0.08
    )));
    const relativeEdgeGrade = this.edgeGrade(relativeEdge, beatRateByCandidate, benchmarkScore);
    const blockers = this.blockers(bestCandidate, bestBaseline, relativeEdge, beatRateByCandidate, overfitPenalty, benchmarkScore);
    const verdict = blockers.length >= 3
      ? 'REJECTED'
      : benchmarkScore >= 0.72 && relativeEdge > 0.035 && beatRateByCandidate >= 0.72
        ? 'BENCHMARK_CANDIDATE'
        : 'RESEARCH_REVIEW';

    return {
      engineVersion: 'strategy-benchmark-v1',
      reportId: this.reportId(values, candidates, randomRois),
      sampleSize: values.length,
      options: this.options,
      candidates,
      baselines,
      randomBaseline: {
        runs: randomResults.length,
        medianRoi: round(percentile(randomRois, 0.5)),
        p05Roi: round(percentile(randomRois, 0.05)),
        p95Roi: round(percentile(randomRois, 0.95)),
        medianMaxDrawdown: round(percentile(randomDrawdowns, 0.5)),
        p95MaxDrawdown: round(percentile(randomDrawdowns, 0.95)),
        beatRateByCandidate
      },
      comparison: {
        bestCandidate,
        bestBaseline,
        relativeEdge,
        relativeEdgeGrade,
        benchmarkScore,
        overfitPenalty,
        baselineDominanceRisk
      },
      governance: {
        operationalGate: 'BLOCKED',
        verdict,
        blockers
      }
    };
  }

  private simulate(values: readonly number[], strategy: BenchmarkStrategy): BenchmarkStrategyResult {
    let capital = this.options.initialCapital;
    let peak = capital;
    let maxDrawdown = 0;
    let wins = 0;
    let losses = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    const trades: BenchmarkTrade[] = [];

    for (let index = this.options.windowSize; index < values.length; index++) {
      const historyWindow = values.slice(index - this.options.windowSize, index);
      const target = strategy.selectTarget(historyWindow, values, index);
      if (target === 'NONE') continue;

      const sectorNumbers = RouletteStats.SECTORS[target];
      const stake = Math.max(0.01, capital * this.options.stakeFraction);
      const outcome = values[index];
      const hit = sectorNumbers.includes(outcome);
      const payoutMultiplier = (RouletteStats.EUROPEAN_WHEEL_SIZE / sectorNumbers.length) - 1;
      const profit = hit ? stake * payoutMultiplier : -stake;
      capital = Math.max(0, capital + profit);

      if (hit) {
        wins += 1;
        grossProfit += profit;
      } else {
        losses += 1;
        grossLoss += Math.abs(profit);
      }

      peak = Math.max(peak, capital);
      maxDrawdown = Math.max(maxDrawdown, peak > 0 ? (peak - capital) / peak : 1);
      if (trades.length < 12 || index > values.length - 6) {
        trades.push({ index, target, outcome, profit: round(profit), capital: round(capital), hit });
      }

      if (capital <= this.options.initialCapital * 0.1) break;
    }

    const totalTrades = wins + losses;
    const netProfit = capital - this.options.initialCapital;
    return {
      strategyId: strategy.id,
      label: strategy.label,
      trades: totalTrades,
      hitRate: totalTrades > 0 ? round(wins / totalTrades) : 0,
      roi: round(netProfit / this.options.initialCapital),
      finalCapital: round(capital),
      maxDrawdown: round(maxDrawdown),
      profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss) : grossProfit > 0 ? 99 : 0,
      expectancyPerTrade: totalTrades > 0 ? round(netProfit / totalTrades) : 0,
      capitalEfficiency: round(Math.max(0, Math.min(1, (capital / this.options.initialCapital) / (1 + maxDrawdown * 2)))) ,
      sampleTrades: trades
    };
  }

  private randomBaseline(values: readonly number[]): BenchmarkStrategyResult[] {
    const results: BenchmarkStrategyResult[] = [];
    for (let run = 0; run < this.options.randomRuns; run++) {
      const strategy = new SeededRandomSectorStrategy(`${this.options.seed}:random:${run}`);
      results.push(this.simulate(values, strategy));
    }
    return results;
  }

  private noBetBaseline(values: readonly number[]): BenchmarkStrategyResult {
    return this.simulate(values, new NoBetStrategy());
  }

  private validate(history: readonly number[]): number[] {
    if (!Array.isArray(history)) throw new Error('Benchmark history must be an array.');
    const values: number[] = [];
    for (let index = 0; index < history.length; index++) {
      const value = history[index];
      if (!Number.isInteger(value) || value < 0 || value > 36) {
        throw new Error(`Invalid roulette number at index ${index}: ${String(value)}`);
      }
      values.push(value);
    }
    if (values.length < Math.max(80, this.options.windowSize + this.options.minimumTrades)) {
      throw new Error(`Insufficient benchmark history. Required at least ${Math.max(80, this.options.windowSize + this.options.minimumTrades)} spins.`);
    }
    return values;
  }

  private normalizeOptions(options: Partial<BenchmarkEngineOptions>): BenchmarkEngineOptions {
    const merged = { ...DEFAULT_OPTIONS, ...options };
    return {
      initialCapital: positiveFinite(merged.initialCapital, DEFAULT_OPTIONS.initialCapital),
      stakeFraction: clamp(positiveFinite(merged.stakeFraction, DEFAULT_OPTIONS.stakeFraction), 0.001, 0.05),
      windowSize: Math.max(24, Math.min(160, Math.floor(positiveFinite(merged.windowSize, DEFAULT_OPTIONS.windowSize)))),
      randomRuns: Math.max(24, Math.min(320, Math.floor(positiveFinite(merged.randomRuns, DEFAULT_OPTIONS.randomRuns)))),
      seed: String(merged.seed || DEFAULT_OPTIONS.seed),
      minimumTrades: Math.max(12, Math.min(100, Math.floor(positiveFinite(merged.minimumTrades, DEFAULT_OPTIONS.minimumTrades))))
    };
  }

  private overfitPenalty(bestCandidate: BenchmarkStrategyResult | undefined, bestBaseline: BenchmarkStrategyResult, beatRate: number): number {
    if (!bestCandidate || bestCandidate.trades < this.options.minimumTrades) return 1;
    const tradePenalty = bestCandidate.trades < this.options.minimumTrades * 2 ? 0.18 : 0;
    const drawdownPenalty = Math.max(0, bestCandidate.maxDrawdown - 0.28) * 1.3;
    const baselinePenalty = bestCandidate.roi <= bestBaseline.roi ? 0.35 : 0;
    const beatPenalty = Math.max(0, 0.64 - beatRate) * 0.9;
    const profitFactorPenalty = bestCandidate.profitFactor > 4 && bestCandidate.trades < 80 ? 0.16 : 0;
    return round(Math.max(0, Math.min(1, tradePenalty + drawdownPenalty + baselinePenalty + beatPenalty + profitFactorPenalty)));
  }

  private edgeGrade(relativeEdge: number, beatRate: number, score: number): RelativeEdgeGrade {
    if (relativeEdge < -0.01 || beatRate < 0.45) return 'NEGATIVE';
    if (relativeEdge < 0.015 || score < 0.45) return 'NEUTRAL';
    if (relativeEdge < 0.055 || score < 0.72) return 'MODEST';
    return 'STRONG';
  }

  private blockers(
    bestCandidate: BenchmarkStrategyResult | undefined,
    bestBaseline: BenchmarkStrategyResult,
    relativeEdge: number,
    beatRate: number,
    overfitPenalty: number,
    benchmarkScore: number
  ): string[] {
    const blockers: string[] = ['Operational gate remains blocked: benchmarking validates relative evidence, not betting authorization.'];
    if (!bestCandidate) blockers.push('No candidate strategy could be evaluated.');
    if (bestCandidate && bestCandidate.trades < this.options.minimumTrades) blockers.push('Best candidate has insufficient trades for institutional comparison.');
    if (relativeEdge <= 0) blockers.push('Best candidate did not outperform the best baseline.');
    if (beatRate < 0.6) blockers.push('Best candidate failed to beat enough seeded random baselines.');
    if (overfitPenalty > 0.35) blockers.push('Overfit penalty is elevated under benchmark comparison.');
    if (benchmarkScore < 0.5) blockers.push('Benchmark score is below research-review threshold.');
    if (bestCandidate && bestCandidate.maxDrawdown > Math.max(0.38, bestBaseline.maxDrawdown + 0.12)) blockers.push('Candidate drawdown is not acceptable relative to baseline risk.');
    return [...new Set(blockers)];
  }

  private reportId(values: readonly number[], candidates: readonly BenchmarkStrategyResult[], randomRois: readonly number[]): string {
    const hash = crypto.createHash('sha256');
    hash.update(values.join(','));
    hash.update('|');
    hash.update(candidates.map(candidate => `${candidate.strategyId}:${candidate.roi}:${candidate.maxDrawdown}`).join(';'));
    hash.update('|');
    hash.update(randomRois.slice(0, 16).join(','));
    return `benchmark_${hash.digest('hex').slice(0, 24)}`;
  }
}

class StrategyRegistry {
  public static candidates(stats: RouletteStats): BenchmarkStrategy[] {
    return [
      new AdaptiveHotSectorStrategy(stats),
      new AdaptiveTransitionSectorStrategy(stats)
    ];
  }

  public static baselines(): BenchmarkStrategy[] {
    return [
      new NoBetStrategy(),
      new FixedSectorStrategy('FIXED_VOISINS', 'Fixed voisins baseline', 'voisins'),
      new FixedSectorStrategy('FIXED_TIERS', 'Fixed tiers baseline', 'tiers'),
      new FixedSectorStrategy('FIXED_ORPHELINS', 'Fixed orphelins baseline', 'orphelins')
    ];
  }
}

class NoBetStrategy implements BenchmarkStrategy {
  public readonly id: BenchmarkStrategyId = 'NO_BET';
  public readonly label = 'No-bet capital preservation baseline';
  public selectTarget(): 'NONE' { return 'NONE'; }
}

class FixedSectorStrategy implements BenchmarkStrategy {
  public constructor(
    public readonly id: BenchmarkStrategyId,
    public readonly label: string,
    private readonly sector: RoulettePlayableSector
  ) {}

  public selectTarget(): RoulettePlayableSector { return this.sector; }
}

class AdaptiveHotSectorStrategy implements BenchmarkStrategy {
  public readonly id: BenchmarkStrategyId = 'ADAPTIVE_HOT_SECTOR';
  public readonly label = 'Adaptive hot-sector candidate';

  public constructor(private readonly stats: RouletteStats) {}

  public selectTarget(historyWindow: readonly number[]): RoulettePlayableSector {
    const sectorScores = SECTOR_NAMES.map(sector => ({ sector, hits: historyWindow.filter(value => this.stats.sectorOf(value) === sector).length }));
    return sectorScores.sort((a, b) => b.hits - a.hits || SECTOR_NAMES.indexOf(a.sector) - SECTOR_NAMES.indexOf(b.sector))[0].sector;
  }
}

class AdaptiveTransitionSectorStrategy implements BenchmarkStrategy {
  public readonly id: BenchmarkStrategyId = 'ADAPTIVE_TRANSITION_SECTOR';
  public readonly label = 'Adaptive transition-sector candidate';

  public constructor(private readonly stats: RouletteStats) {}

  public selectTarget(historyWindow: readonly number[]): RoulettePlayableSector {
    const transitions = this.stats.nextSectorTransition([...historyWindow]);
    const ranked = SECTOR_NAMES.map(sector => ({ sector, count: transitions.get(sector) ?? 0 }))
      .sort((a, b) => b.count - a.count || SECTOR_NAMES.indexOf(a.sector) - SECTOR_NAMES.indexOf(b.sector));
    if ((ranked[0]?.count ?? 0) === 0) return new AdaptiveHotSectorStrategy(this.stats).selectTarget(historyWindow);
    return ranked[0].sector;
  }
}

class SeededRandomSectorStrategy implements BenchmarkStrategy {
  public readonly id: BenchmarkStrategyId = 'RANDOM_SECTOR';
  public readonly label = 'Seeded random-sector baseline';

  public constructor(private readonly seed: string) {}

  public selectTarget(_historyWindow: readonly number[], _globalHistory: readonly number[], index: number): RoulettePlayableSector {
    const value = seededUnit(`${this.seed}:${index}`);
    return SECTOR_NAMES[Math.min(SECTOR_NAMES.length - 1, Math.floor(value * SECTOR_NAMES.length))];
  }
}

function positiveFinite(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function ascending(a: number, b: number): number {
  return a - b;
}

function byRoiThenDrawdown(a: BenchmarkStrategyResult, b: BenchmarkStrategyResult): number {
  return b.roi - a.roi || a.maxDrawdown - b.maxDrawdown || b.trades - a.trades;
}

function percentile(sortedValues: readonly number[], percentileValue: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.max(0, Math.min(sortedValues.length - 1, Math.floor((sortedValues.length - 1) * percentileValue)));
  return sortedValues[index];
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number, digits = 6): number {
  return Number(value.toFixed(digits));
}

function seededUnit(seed: string): number {
  const digest = crypto.createHash('sha256').update(seed).digest();
  const integer = digest.readUInt32BE(0);
  return integer / 0xffffffff;
}
