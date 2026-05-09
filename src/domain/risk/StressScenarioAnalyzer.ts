import { RouletteSectorName, RouletteStats } from '../services/RouletteStats';

type TradableSector = Exclude<RouletteSectorName, 'zero' | 'unknown'>;

export interface StressScenarioOptions {
  initialEquity: number;
  baseStakeFraction: number;
  ruinThreshold: number;
  windowSize: number;
  maxExposureFraction: number;
}

export interface StressScenarioDefinition {
  name: string;
  description: string;
  stakeMultiplier: number;
  lossShockMultiplier: number;
  winHaircut: number;
  forcedLossEvery?: number;
}

export interface EquityPoint {
  index: number;
  equity: number;
  drawdown: number;
  underwater: boolean;
}

export interface StressScenarioOutcome {
  name: string;
  description: string;
  finalEquity: number;
  roi: number;
  maxDrawdown: number;
  longestUnderwaterRun: number;
  recoveryFactor: number;
  exposureUtilization: number;
  ruinProbabilityProxy: number;
  tailLoss95: number;
  riskGrade: 'PASS' | 'WATCH' | 'FAIL';
  equityCurve: EquityPoint[];
}

export interface DrawdownSurfaceCell {
  stakeMultiplier: number;
  shockMultiplier: number;
  maxDrawdown: number;
  finalEquity: number;
  ruinProbabilityProxy: number;
  riskGrade: 'PASS' | 'WATCH' | 'FAIL';
}

export interface StressScenarioSummary {
  sampleSize: number;
  scenarios: number;
  worstDrawdown: number;
  worstRuinProbabilityProxy: number;
  medianRecoveryFactor: number;
  tailRiskScore: number;
  resilienceScore: number;
  approval: 'REJECTED' | 'RESEARCH_REVIEW' | 'RESILIENT_CANDIDATE';
  blockers: string[];
}

export interface StressScenarioAnalysis {
  summary: StressScenarioSummary;
  scenarios: StressScenarioOutcome[];
  drawdownSurface: DrawdownSurfaceCell[];
  options: StressScenarioOptions;
}

const DEFAULT_OPTIONS: StressScenarioOptions = {
  initialEquity: 1,
  baseStakeFraction: 0.01,
  ruinThreshold: 0.5,
  windowSize: 60,
  maxExposureFraction: 0.03
};

const DEFAULT_SCENARIOS: StressScenarioDefinition[] = [
  { name: 'baseline_control', description: 'Replay determinístico com stake base e sem choques artificiais.', stakeMultiplier: 1, lossShockMultiplier: 1, winHaircut: 0 },
  { name: 'double_stake_stress', description: 'Exposição dobrada para medir sensibilidade de drawdown.', stakeMultiplier: 2, lossShockMultiplier: 1, winHaircut: 0 },
  { name: 'adverse_loss_cluster', description: 'Cluster adverso com perdas artificialmente amplificadas.', stakeMultiplier: 1.5, lossShockMultiplier: 1.35, winHaircut: 0.05, forcedLossEvery: 11 },
  { name: 'payout_haircut', description: 'Redução conservadora de ganhos para simular fricção operacional.', stakeMultiplier: 1, lossShockMultiplier: 1, winHaircut: 0.18 },
  { name: 'capital_pressure', description: 'Stress de exposição máxima e sequência desfavorável.', stakeMultiplier: 2.5, lossShockMultiplier: 1.5, winHaircut: 0.1, forcedLossEvery: 7 }
];

export class StressScenarioAnalyzer {
  private readonly stats = new RouletteStats();
  private readonly options: StressScenarioOptions;

  constructor(options: Partial<StressScenarioOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  public analyze(history: number[]): StressScenarioAnalysis {
    const values = this.validate(history);
    const sectors = values.map(value => this.stats.sectorOf(value));
    const scenarios = DEFAULT_SCENARIOS.map(scenario => this.replayScenario(sectors, scenario));
    const drawdownSurface = this.buildDrawdownSurface(sectors);
    const summary = this.summarize(values.length, scenarios, drawdownSurface);
    return { summary, scenarios, drawdownSurface, options: this.options };
  }

  private validate(history: number[]): number[] {
    const result = RouletteStats.validate(history);
    if (!result.ok) {
      throw new Error(`invalid_stress_history: ${result.errors.slice(0, 3).join('; ')}`);
    }
    if (result.values.length < Math.max(90, this.options.windowSize * 2)) {
      throw new Error('insufficient_stress_history: minimum 120 valid spins recommended');
    }
    return result.values;
  }

  private replayScenario(sectors: RouletteSectorName[], scenario: StressScenarioDefinition): StressScenarioOutcome {
    const target = this.learnStableTarget(sectors);
    let equity = this.options.initialEquity;
    let peak = equity;
    let maxDrawdown = 0;
    let underwaterRun = 0;
    let longestUnderwaterRun = 0;
    const returns: number[] = [];
    const equityCurve: EquityPoint[] = [];

    sectors.forEach((sector, index) => {
      const forcedLoss = scenario.forcedLossEvery !== undefined && index > 0 && index % scenario.forcedLossEvery === 0;
      const won = !forcedLoss && sector === target;
      const pnl = this.pnl(target, won, scenario);
      equity *= 1 + Math.max(-0.99, pnl);
      peak = Math.max(peak, equity);
      const drawdown = peak <= 0 ? 0 : (peak - equity) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
      underwaterRun = drawdown > 0 ? underwaterRun + 1 : 0;
      longestUnderwaterRun = Math.max(longestUnderwaterRun, underwaterRun);
      returns.push(pnl);
      equityCurve.push({ index, equity: round(equity), drawdown: round(drawdown), underwater: drawdown > 0 });
    });

    const roi = equity / this.options.initialEquity - 1;
    const tailLoss95 = this.tailLoss(returns, 0.95);
    const recoveryFactor = maxDrawdown <= 0 ? Math.max(0, roi) : Math.max(0, roi) / maxDrawdown;
    const exposureUtilization = Math.min(1, (this.options.baseStakeFraction * scenario.stakeMultiplier) / this.options.maxExposureFraction);
    const ruinProbabilityProxy = this.ruinProxy(maxDrawdown, roi, tailLoss95, longestUnderwaterRun, sectors.length);
    const riskGrade = this.grade(maxDrawdown, ruinProbabilityProxy, roi, tailLoss95);

    return {
      name: scenario.name,
      description: scenario.description,
      finalEquity: round(equity),
      roi: round(roi),
      maxDrawdown: round(maxDrawdown),
      longestUnderwaterRun,
      recoveryFactor: round(recoveryFactor),
      exposureUtilization: round(exposureUtilization),
      ruinProbabilityProxy: round(ruinProbabilityProxy),
      tailLoss95: round(tailLoss95),
      riskGrade,
      equityCurve
    };
  }

  private learnStableTarget(sectors: RouletteSectorName[]): TradableSector {
    const tradable: TradableSector[] = ['voisins', 'tiers', 'orphelins'];
    const counts = new Map<TradableSector, number>(tradable.map(sector => [sector, 0]));
    for (const sector of sectors.slice(0, Math.max(30, Math.floor(sectors.length * 0.35)))) {
      if (sector === 'voisins' || sector === 'tiers' || sector === 'orphelins') counts.set(sector, (counts.get(sector) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  }

  private pnl(target: TradableSector, won: boolean, scenario: StressScenarioDefinition): number {
    const stake = this.options.baseStakeFraction * scenario.stakeMultiplier;
    if (!won) return -stake * scenario.lossShockMultiplier;
    const sectorSize = RouletteStats.SECTORS[target]?.length ?? 0;
    const payout = sectorSize > 0 ? RouletteStats.EUROPEAN_WHEEL_SIZE / sectorSize - 1 : 0;
    return stake * payout * Math.max(0, 1 - scenario.winHaircut);
  }

  private buildDrawdownSurface(sectors: RouletteSectorName[]): DrawdownSurfaceCell[] {
    const stakeMultipliers = [0.5, 1, 1.5, 2, 2.5, 3];
    const shockMultipliers = [1, 1.15, 1.3, 1.5];
    return stakeMultipliers.flatMap(stakeMultiplier => shockMultipliers.map(shockMultiplier => {
      const outcome = this.replayScenario(sectors, {
        name: `surface_${stakeMultiplier}_${shockMultiplier}`,
        description: 'Drawdown surface stress point.',
        stakeMultiplier,
        lossShockMultiplier: shockMultiplier,
        winHaircut: Math.max(0, (shockMultiplier - 1) * 0.25)
      });
      return {
        stakeMultiplier,
        shockMultiplier,
        maxDrawdown: outcome.maxDrawdown,
        finalEquity: outcome.finalEquity,
        ruinProbabilityProxy: outcome.ruinProbabilityProxy,
        riskGrade: outcome.riskGrade
      };
    }));
  }

  private summarize(sampleSize: number, scenarios: StressScenarioOutcome[], surface: DrawdownSurfaceCell[]): StressScenarioSummary {
    const worstDrawdown = Math.max(...scenarios.map(item => item.maxDrawdown), ...surface.map(item => item.maxDrawdown), 0);
    const worstRuinProbabilityProxy = Math.max(...scenarios.map(item => item.ruinProbabilityProxy), ...surface.map(item => item.ruinProbabilityProxy), 0);
    const medianRecoveryFactor = median(scenarios.map(item => item.recoveryFactor));
    const failedScenarios = scenarios.filter(item => item.riskGrade === 'FAIL').length;
    const watchedScenarios = scenarios.filter(item => item.riskGrade === 'WATCH').length;
    const surfaceFailRate = surface.length === 0 ? 1 : surface.filter(item => item.riskGrade === 'FAIL').length / surface.length;
    const tailRiskScore = round(Math.min(1, worstRuinProbabilityProxy * 0.45 + worstDrawdown * 0.35 + surfaceFailRate * 0.2));
    const resilienceScore = round(Math.max(0, 1 - tailRiskScore) * 0.5 + Math.min(1, medianRecoveryFactor) * 0.25 + Math.max(0, 1 - failedScenarios / Math.max(1, scenarios.length)) * 0.25);
    const partial = { sampleSize, scenarios: scenarios.length, worstDrawdown: round(worstDrawdown), worstRuinProbabilityProxy: round(worstRuinProbabilityProxy), medianRecoveryFactor: round(medianRecoveryFactor), tailRiskScore, resilienceScore };
    const blockers = this.blockers(partial, failedScenarios, watchedScenarios, surfaceFailRate);
    return { ...partial, approval: this.approval(partial, blockers), blockers };
  }

  private blockers(summary: Omit<StressScenarioSummary, 'approval' | 'blockers'>, failedScenarios: number, watchedScenarios: number, surfaceFailRate: number): string[] {
    const blockers: string[] = [];
    if (summary.sampleSize < 180) blockers.push('insufficient_stress_sample');
    if (summary.worstDrawdown > 0.45) blockers.push('catastrophic_drawdown_surface');
    if (summary.worstRuinProbabilityProxy > 0.45) blockers.push('ruin_probability_above_limit');
    if (failedScenarios > 0) blockers.push('stress_scenario_failed');
    if (surfaceFailRate > 0.35) blockers.push('drawdown_surface_failure_cluster');
    if (watchedScenarios >= 3) blockers.push('multiple_watch_scenarios');
    if (summary.resilienceScore < 0.45) blockers.push('low_resilience_score');
    return blockers;
  }

  private approval(summary: Omit<StressScenarioSummary, 'approval' | 'blockers'>, blockers: string[]): StressScenarioSummary['approval'] {
    if (blockers.some(code => ['catastrophic_drawdown_surface', 'ruin_probability_above_limit', 'stress_scenario_failed', 'drawdown_surface_failure_cluster'].includes(code))) return 'REJECTED';
    if (summary.resilienceScore >= 0.68 && summary.tailRiskScore <= 0.28 && blockers.length === 0) return 'RESILIENT_CANDIDATE';
    return 'RESEARCH_REVIEW';
  }

  private tailLoss(returns: number[], percentile: number): number {
    const losses = returns.filter(value => value < 0).map(value => Math.abs(value)).sort((a, b) => a - b);
    if (losses.length === 0) return 0;
    const index = Math.min(losses.length - 1, Math.max(0, Math.floor(losses.length * percentile) - 1));
    return losses[index];
  }

  private ruinProxy(maxDrawdown: number, roi: number, tailLoss95: number, longestUnderwaterRun: number, sampleSize: number): number {
    const underwaterPressure = sampleSize === 0 ? 1 : longestUnderwaterRun / sampleSize;
    return Math.min(1, Math.max(0, maxDrawdown * 0.55 + tailLoss95 * 7.5 + underwaterPressure * 0.25 + (roi < 0 ? 0.2 : 0) - Math.max(0, roi) * 0.05));
  }

  private grade(maxDrawdown: number, ruinProbabilityProxy: number, roi: number, tailLoss95: number): StressScenarioOutcome['riskGrade'] {
    if (maxDrawdown > 0.45 || ruinProbabilityProxy > 0.45 || tailLoss95 > this.options.baseStakeFraction * 4 || roi < -0.35) return 'FAIL';
    if (maxDrawdown > 0.25 || ruinProbabilityProxy > 0.25 || roi < 0) return 'WATCH';
    return 'PASS';
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function round(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(6));
}
