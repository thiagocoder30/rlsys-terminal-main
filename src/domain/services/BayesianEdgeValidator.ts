import { BacktestSummary } from './BacktestEngine';
import { RouletteStats } from './RouletteStats';
import { StrategyAnalysis } from './StrategyEngine';

export type BayesianEdgeVerdict = 'SUPPORTED' | 'INCONCLUSIVE' | 'REJECTED';

export interface BayesianEdgeValidation {
  verdict: BayesianEdgeVerdict;
  posteriorAlpha: number;
  posteriorBeta: number;
  posteriorMeanHitRate: number;
  fairHitRate: number;
  estimatedEdge: number;
  probabilityEdgePositive: number;
  credibleInterval90: [number, number];
  evidenceScore: number;
  reasons: string[];
}

export interface BayesianEdgeValidatorOptions {
  priorStrength: number;
  minTrades: number;
  minProbabilityEdgePositive: number;
  minEvidenceScore: number;
  minCredibleLowerBoundEdge: number;
}

const DEFAULT_OPTIONS: BayesianEdgeValidatorOptions = {
  priorStrength: 80,
  minTrades: 40,
  minProbabilityEdgePositive: 0.72,
  minEvidenceScore: 0.58,
  minCredibleLowerBoundEdge: -0.025
};

export class BayesianEdgeValidator {
  private readonly options: BayesianEdgeValidatorOptions;

  constructor(options: Partial<BayesianEdgeValidatorOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  public validate(analysis: StrategyAnalysis, backtest?: BacktestSummary): BayesianEdgeValidation {
    const primarySignal = analysis.signals[0];
    const sectorSize = primarySignal?.target && primarySignal.target !== 'unknown'
      ? RouletteStats.SECTORS[primarySignal.target]?.length ?? 0
      : 0;
    const fairHitRate = sectorSize > 0 ? sectorSize / RouletteStats.EUROPEAN_WHEEL_SIZE : 1 / RouletteStats.EUROPEAN_WHEEL_SIZE;
    const priorAlpha = Math.max(1, fairHitRate * this.options.priorStrength);
    const priorBeta = Math.max(1, (1 - fairHitRate) * this.options.priorStrength);
    const wins = backtest?.wins ?? 0;
    const losses = backtest?.losses ?? 0;
    const trades = wins + losses;
    const posteriorAlpha = priorAlpha + wins;
    const posteriorBeta = priorBeta + losses;
    const posteriorMeanHitRate = posteriorAlpha / (posteriorAlpha + posteriorBeta);
    const estimatedEdge = posteriorMeanHitRate - fairHitRate;
    const stdDev = Math.sqrt((posteriorMeanHitRate * (1 - posteriorMeanHitRate)) / (posteriorAlpha + posteriorBeta + 1));
    const lower90 = this.clamp(posteriorMeanHitRate - 1.645 * stdDev);
    const upper90 = this.clamp(posteriorMeanHitRate + 1.645 * stdDev);
    const z = stdDev === 0 ? 0 : (posteriorMeanHitRate - fairHitRate) / stdDev;
    const probabilityEdgePositive = this.normalCdf(z);
    const evidenceScore = this.clamp(
      0.55 * probabilityEdgePositive +
      0.25 * this.clamp(trades / 250) +
      0.20 * this.clamp((analysis.metrics.sampleSize - 120) / 880)
    );
    const reasons: string[] = [];

    if (trades < this.options.minTrades) {
      reasons.push(`Backtest com ${trades} trades; mínimo bayesiano institucional: ${this.options.minTrades}.`);
    }
    if (probabilityEdgePositive < this.options.minProbabilityEdgePositive) {
      reasons.push(`Probabilidade posterior de edge positivo ${(probabilityEdgePositive * 100).toFixed(2)}% abaixo do mínimo.`);
    }
    if (evidenceScore < this.options.minEvidenceScore) {
      reasons.push(`Evidence score ${evidenceScore.toFixed(3)} abaixo do mínimo ${this.options.minEvidenceScore}.`);
    }
    if (lower90 - fairHitRate < this.options.minCredibleLowerBoundEdge) {
      reasons.push('Intervalo credível ainda permite deterioração relevante contra a taxa justa.');
    }

    let verdict: BayesianEdgeVerdict = 'SUPPORTED';
    if (trades < this.options.minTrades || probabilityEdgePositive < 0.5 || backtest?.expectancyPerTrade !== undefined && backtest.expectancyPerTrade <= 0) {
      verdict = 'REJECTED';
    } else if (reasons.length > 0) {
      verdict = 'INCONCLUSIVE';
    }

    return {
      verdict,
      posteriorAlpha,
      posteriorBeta,
      posteriorMeanHitRate,
      fairHitRate,
      estimatedEdge,
      probabilityEdgePositive,
      credibleInterval90: [lower90, upper90],
      evidenceScore,
      reasons
    };
  }

  private clamp(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
  }

  private normalCdf(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.SQRT2));
  }

  private erf(x: number): number {
    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x);
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const t = 1 / (1 + p * absX);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
    return sign * y;
  }
}
