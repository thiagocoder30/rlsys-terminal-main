import { StatisticalSignificanceEngine } from '../statistics/StatisticalSignificanceEngine';
import { SequentialBiasDetector } from '../sequential/SequentialBiasDetector';

export type PersistenceVerdict = 'NO_PERSISTENT_EDGE' | 'WEAK_PERSISTENCE' | 'MODERATE_PERSISTENCE' | 'STRONG_PERSISTENCE';
export type StabilityLabel = 'unstable' | 'fragile' | 'moderate' | 'stable';

export interface EdgeWindow {
  index: number;
  startIndex: number;
  endIndex: number;
  sampleSize: number;
  evidenceScore: number;
  sequentialBiasScore: number;
  compositeEdgeScore: number;
  pValue: number;
  significantAt95: boolean;
  verdict: string;
}

export interface EdgeDecayReport {
  initialEdge: number;
  finalEdge: number;
  absoluteDecay: number;
  relativeDecay: number;
  slope: number;
  halfLifeWindows: number | null;
  direction: 'improving' | 'stable' | 'decaying';
}

export interface SurvivalCurvePoint {
  windowIndex: number;
  threshold: number;
  survived: boolean;
  survivalRate: number;
  edgeScore: number;
}

export interface StabilityWindowReport {
  stableWindows: number;
  unstableWindows: number;
  longestStableRun: number;
  stabilityRatio: number;
  label: StabilityLabel;
}

export interface EdgePersistenceReport {
  sampleSize: number;
  windowSize: number;
  stepSize: number;
  minWindowsRequired: number;
  windows: EdgeWindow[];
  decay: EdgeDecayReport;
  survivalCurve: SurvivalCurvePoint[];
  stability: StabilityWindowReport;
  outOfSampleConsistency: number;
  persistenceScore: number;
  verdict: PersistenceVerdict;
  recommendations: string[];
}

export interface EdgePersistenceOptions {
  windowSize?: number;
  stepSize?: number;
  survivalThreshold?: number;
  minWindowsRequired?: number;
}

const DEFAULT_SURVIVAL_THRESHOLD = 0.45;

export class EdgePersistenceAnalyzer {
  constructor(
    private readonly statisticalEngine = new StatisticalSignificanceEngine(),
    private readonly sequentialDetector = new SequentialBiasDetector()
  ) {}

  public analyze(values: number[], options: EdgePersistenceOptions = {}): EdgePersistenceReport {
    const sanitized = values.filter(value => Number.isInteger(value) && value >= 0 && value <= 36);
    const sampleSize = sanitized.length;
    const windowSize = options.windowSize ?? Math.max(80, Math.min(500, Math.floor(sampleSize / 6)));
    const stepSize = options.stepSize ?? Math.max(20, Math.floor(windowSize / 2));
    const minWindowsRequired = options.minWindowsRequired ?? 4;
    const survivalThreshold = options.survivalThreshold ?? DEFAULT_SURVIVAL_THRESHOLD;
    const windows = this.buildWindows(sanitized, windowSize, stepSize);
    const decay = this.decay(windows);
    const survivalCurve = this.survivalCurve(windows, survivalThreshold);
    const stability = this.stability(windows, survivalThreshold);
    const outOfSampleConsistency = this.outOfSampleConsistency(windows, survivalThreshold);
    const persistenceScore = this.persistenceScore({ windows, decay, stability, outOfSampleConsistency, minWindowsRequired });
    const verdict = this.verdict(sampleSize, windows.length, persistenceScore, stability.label, outOfSampleConsistency, minWindowsRequired);

    return {
      sampleSize,
      windowSize,
      stepSize,
      minWindowsRequired,
      windows,
      decay,
      survivalCurve,
      stability,
      outOfSampleConsistency: round(outOfSampleConsistency),
      persistenceScore: round(persistenceScore),
      verdict,
      recommendations: this.recommendations(sampleSize, windows.length, verdict, decay, stability)
    };
  }

  private buildWindows(values: number[], windowSize: number, stepSize: number): EdgeWindow[] {
    if (values.length < windowSize || windowSize <= 0) return [];
    const windows: EdgeWindow[] = [];
    for (let start = 0; start + windowSize <= values.length; start += stepSize) {
      const slice = values.slice(start, start + windowSize);
      const statistical = this.statisticalEngine.analyze(slice);
      const sequential = this.sequentialDetector.analyze(slice);
      const compositeEdgeScore = clamp01(statistical.evidenceScore * 0.58 + sequential.sequentialBiasScore * 0.42);
      windows.push({
        index: windows.length,
        startIndex: start,
        endIndex: start + windowSize - 1,
        sampleSize: slice.length,
        evidenceScore: statistical.evidenceScore,
        sequentialBiasScore: sequential.sequentialBiasScore,
        compositeEdgeScore: round(compositeEdgeScore),
        pValue: statistical.pValue,
        significantAt95: statistical.significantAt95,
        verdict: statistical.verdict
      });
    }
    return windows;
  }

  private decay(windows: EdgeWindow[]): EdgeDecayReport {
    if (windows.length === 0) {
      return { initialEdge: 0, finalEdge: 0, absoluteDecay: 0, relativeDecay: 0, slope: 0, halfLifeWindows: null, direction: 'stable' };
    }

    const scores = windows.map(window => window.compositeEdgeScore);
    const initialEdge = scores.slice(0, Math.max(1, Math.ceil(scores.length * 0.25))).reduce((sum, score) => sum + score, 0) / Math.max(1, Math.ceil(scores.length * 0.25));
    const finalCount = Math.max(1, Math.ceil(scores.length * 0.25));
    const finalEdge = scores.slice(-finalCount).reduce((sum, score) => sum + score, 0) / finalCount;
    const slope = linearSlope(scores);
    const absoluteDecay = Math.max(0, initialEdge - finalEdge);
    const relativeDecay = initialEdge <= 0 ? 0 : absoluteDecay / initialEdge;
    const halfLifeWindows = this.halfLife(scores, initialEdge);
    const direction: EdgeDecayReport['direction'] = slope < -0.025 ? 'decaying' : slope > 0.025 ? 'improving' : 'stable';

    return {
      initialEdge: round(initialEdge),
      finalEdge: round(finalEdge),
      absoluteDecay: round(absoluteDecay),
      relativeDecay: round(clamp01(relativeDecay)),
      slope: round(slope),
      halfLifeWindows,
      direction
    };
  }

  private halfLife(scores: number[], initialEdge: number): number | null {
    if (scores.length < 2 || initialEdge <= 0) return null;
    const threshold = initialEdge / 2;
    const index = scores.findIndex((score, position) => position > 0 && score <= threshold);
    return index >= 0 ? index : null;
  }

  private survivalCurve(windows: EdgeWindow[], threshold: number): SurvivalCurvePoint[] {
    let survivedCount = 0;
    return windows.map(window => {
      const survived = window.compositeEdgeScore >= threshold;
      if (survived) survivedCount += 1;
      return {
        windowIndex: window.index,
        threshold: round(threshold),
        survived,
        survivalRate: round(survivedCount / (window.index + 1)),
        edgeScore: window.compositeEdgeScore
      };
    });
  }

  private stability(windows: EdgeWindow[], threshold: number): StabilityWindowReport {
    let longestStableRun = 0;
    let currentRun = 0;
    let stableWindows = 0;

    windows.forEach(window => {
      if (window.compositeEdgeScore >= threshold) {
        stableWindows += 1;
        currentRun += 1;
        longestStableRun = Math.max(longestStableRun, currentRun);
      } else {
        currentRun = 0;
      }
    });

    const unstableWindows = Math.max(0, windows.length - stableWindows);
    const stabilityRatio = windows.length === 0 ? 0 : stableWindows / windows.length;
    const label: StabilityLabel = stabilityRatio >= 0.78 && longestStableRun >= 4
      ? 'stable'
      : stabilityRatio >= 0.58
        ? 'moderate'
        : stabilityRatio >= 0.35
          ? 'fragile'
          : 'unstable';

    return {
      stableWindows,
      unstableWindows,
      longestStableRun,
      stabilityRatio: round(stabilityRatio),
      label
    };
  }

  private outOfSampleConsistency(windows: EdgeWindow[], threshold: number): number {
    if (windows.length < 4) return 0;
    const split = Math.max(1, Math.floor(windows.length / 2));
    const train = windows.slice(0, split);
    const test = windows.slice(split);
    const trainMean = mean(train.map(window => window.compositeEdgeScore));
    const testMean = mean(test.map(window => window.compositeEdgeScore));
    const testSurvival = test.filter(window => window.compositeEdgeScore >= threshold).length / Math.max(1, test.length);
    const degradationPenalty = trainMean <= 0 ? 0.5 : clamp01(Math.max(0, trainMean - testMean) / trainMean);
    return clamp01(testSurvival * 0.65 + (1 - degradationPenalty) * 0.35);
  }

  private persistenceScore(input: {
    windows: EdgeWindow[];
    decay: EdgeDecayReport;
    stability: StabilityWindowReport;
    outOfSampleConsistency: number;
    minWindowsRequired: number;
  }): number {
    const windowAdequacy = clamp01(input.windows.length / Math.max(1, input.minWindowsRequired));
    const averageEdge = mean(input.windows.map(window => window.compositeEdgeScore));
    const decayPenalty = input.decay.direction === 'decaying' ? input.decay.relativeDecay * 0.35 : 0;
    return clamp01((averageEdge * 0.32 + input.stability.stabilityRatio * 0.28 + input.outOfSampleConsistency * 0.28 + windowAdequacy * 0.12) - decayPenalty);
  }

  private verdict(
    sampleSize: number,
    windowsCount: number,
    persistenceScore: number,
    stability: StabilityLabel,
    outOfSampleConsistency: number,
    minWindowsRequired: number
  ): PersistenceVerdict {
    if (sampleSize < 500 || windowsCount < minWindowsRequired) return 'NO_PERSISTENT_EDGE';
    if (persistenceScore >= 0.78 && stability === 'stable' && outOfSampleConsistency >= 0.72) return 'STRONG_PERSISTENCE';
    if (persistenceScore >= 0.62 && (stability === 'stable' || stability === 'moderate') && outOfSampleConsistency >= 0.55) return 'MODERATE_PERSISTENCE';
    if (persistenceScore >= 0.45 && stability !== 'unstable') return 'WEAK_PERSISTENCE';
    return 'NO_PERSISTENT_EDGE';
  }

  private recommendations(
    sampleSize: number,
    windowsCount: number,
    verdict: PersistenceVerdict,
    decay: EdgeDecayReport,
    stability: StabilityWindowReport
  ): string[] {
    const recommendations: string[] = [];
    if (sampleSize < 2_000) recommendations.push('Coletar 2.000+ spins antes de promover hipótese de persistência para pesquisa avançada.');
    if (windowsCount < 6) recommendations.push('Aumentar quantidade de janelas para reduzir sensibilidade a ruído local.');
    if (decay.direction === 'decaying') recommendations.push('Edge aparente em degradação: bloquear uso operacional e investigar half-life do sinal.');
    if (stability.label === 'unstable' || stability.label === 'fragile') recommendations.push('Persistência insuficiente: tratar padrões como possivelmente efêmeros ou overfit.');
    if (verdict === 'NO_PERSISTENT_EDGE') recommendations.push('Não inferir edge persistente sem sobrevivência temporal e consistência fora da amostra.');
    if (verdict === 'MODERATE_PERSISTENCE' || verdict === 'STRONG_PERSISTENCE') recommendations.push('Executar validação adversarial e Monte Carlo condicionado antes de qualquer decisão operacional.');
    return [...new Set(recommendations)];
  }
}

function linearSlope(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanY = mean(values);
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    numerator += (index - meanX) * (value - meanY);
    denominator += (index - meanX) ** 2;
  });
  return denominator === 0 ? 0 : numerator / denominator;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(6));
}
