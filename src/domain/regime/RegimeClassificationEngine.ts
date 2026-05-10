import crypto from 'crypto';
import { DomainError, err, ok, type Result } from '../shared/Result';

export type TableRegime = 'STABLE' | 'VOLATILE' | 'DRIFTING' | 'CHAOTIC';
export type RegimeSignalPolicy = 'ALLOW_RESEARCH' | 'OBSERVE_ONLY' | 'BLOCK_SIGNALS';

export interface RegimeClassificationOptions {
  readonly minSampleSize: number;
  readonly windowSize: number;
  readonly maxWindows: number;
  readonly stableEntropyFloor: number;
  readonly chaoticEntropyCeiling: number;
  readonly volatilityThreshold: number;
  readonly driftThreshold: number;
  readonly concentrationThreshold: number;
}

export interface RegimeWindowMetrics {
  readonly index: number;
  readonly start: number;
  readonly end: number;
  readonly size: number;
  readonly normalizedEntropy: number;
  readonly maxNumberConcentration: number;
  readonly sectorSkew: number;
}

export interface RegimeClassificationMetrics {
  readonly sampleSize: number;
  readonly normalizedEntropy: number;
  readonly entropyVolatility: number;
  readonly entropyDrift: number;
  readonly concentration: number;
  readonly uniqueRatio: number;
  readonly sectorSkew: number;
  readonly confidence: number;
}

export interface RegimeClassificationReport {
  readonly engineVersion: 'regime-classification-v1';
  readonly regimeId: string;
  readonly regime: TableRegime;
  readonly signalPolicy: RegimeSignalPolicy;
  readonly metrics: RegimeClassificationMetrics;
  readonly windows: readonly RegimeWindowMetrics[];
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly rationale: string;
}

const DEFAULT_OPTIONS: RegimeClassificationOptions = {
  minSampleSize: 100,
  windowSize: 25,
  maxWindows: 6,
  stableEntropyFloor: 0.82,
  chaoticEntropyCeiling: 0.62,
  volatilityThreshold: 0.12,
  driftThreshold: 0.11,
  concentrationThreshold: 0.22
};

const ROULETTE_STATE_COUNT = 37;

/**
 * Classifies the current roulette table regime from recent spin history.
 *
 * The engine is pure, deterministic and framework-free. It intentionally works
 * on compact numeric arrays so OCR, HTTP, UI and persistence stay outside the
 * domain layer. Windows are non-overlapping and bounded by maxWindows, keeping
 * runtime O(n) and memory O(37 + w) where w is the bounded number of windows.
 */
export class RegimeClassificationEngine {
  private readonly options: RegimeClassificationOptions;

  public constructor(options: Partial<RegimeClassificationOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.validateOptions(this.options);
  }

  public classify(history: readonly number[]): Result<RegimeClassificationReport, DomainError> {
    try {
      this.validateHistory(history);
      const windows = this.buildWindows(history);
      const metrics = this.metrics(history, windows);
      const regime = this.resolveRegime(metrics, windows.length);
      const signalPolicy = this.signalPolicy(regime, metrics);
      const blockers = this.blockers(regime, metrics, windows.length);
      const warnings = this.warnings(regime, metrics, windows.length);
      const rationale = this.rationale(regime, signalPolicy, blockers, warnings);

      const report: RegimeClassificationReport = {
        engineVersion: 'regime-classification-v1',
        regimeId: this.regimeId(history, metrics, regime, signalPolicy),
        regime,
        signalPolicy,
        metrics,
        windows,
        blockers,
        warnings,
        rationale
      };

      return ok(report);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_regime_classification_error';
      return err(new DomainError(message, 'REGIME_CLASSIFICATION_FAILED'));
    }
  }

  private buildWindows(history: readonly number[]): readonly RegimeWindowMetrics[] {
    const windowSize = Math.min(this.options.windowSize, history.length);
    const capacity = Math.max(1, this.options.maxWindows);
    const availableWindows = Math.floor(history.length / windowSize);
    const windowCount = Math.max(1, Math.min(capacity, availableWindows));
    const startOffset = history.length - windowCount * windowSize;
    const windows: RegimeWindowMetrics[] = [];

    for (let index = 0; index < windowCount; index += 1) {
      const start = startOffset + index * windowSize;
      const end = start + windowSize;
      windows.push(this.windowMetrics(index, start, end, history));
    }

    return windows;
  }

  private windowMetrics(index: number, start: number, end: number, history: readonly number[]): RegimeWindowMetrics {
    const counts = new Int16Array(ROULETTE_STATE_COUNT);
    const sectors = new Int16Array(3);
    let maxCount = 0;

    for (let cursor = start; cursor < end; cursor += 1) {
      const value = history[cursor];
      const nextCount = counts[value] + 1;
      counts[value] = nextCount;
      if (nextCount > maxCount) maxCount = nextCount;
      if (value > 0) sectors[sectorIndex(value)] += 1;
    }

    const size = end - start;
    return {
      index,
      start,
      end,
      size,
      normalizedEntropy: round(normalizedEntropy(counts, size)),
      maxNumberConcentration: round(maxCount / size),
      sectorSkew: round(maxOf(sectors) / size)
    };
  }

  private metrics(history: readonly number[], windows: readonly RegimeWindowMetrics[]): RegimeClassificationMetrics {
    const counts = new Int16Array(ROULETTE_STATE_COUNT);
    const sectors = new Int16Array(3);
    let maxCount = 0;
    let unique = 0;

    for (const value of history) {
      if (counts[value] === 0) unique += 1;
      const nextCount = counts[value] + 1;
      counts[value] = nextCount;
      if (nextCount > maxCount) maxCount = nextCount;
      if (value > 0) sectors[sectorIndex(value)] += 1;
    }

    const entropies = windows.map(window => window.normalizedEntropy);
    const entropyVolatility = std(entropies);
    const entropyDrift = entropies.length <= 1 ? 0 : entropies[entropies.length - 1] - entropies[0];
    const concentration = maxCount / history.length;
    const sectorSkew = maxOf(sectors) / history.length;
    const normalizedEntropyValue = normalizedEntropy(counts, history.length);
    const uniqueRatio = unique / ROULETTE_STATE_COUNT;
    const confidence = this.confidence(history.length, windows.length, entropyVolatility, concentration);

    return {
      sampleSize: history.length,
      normalizedEntropy: round(normalizedEntropyValue),
      entropyVolatility: round(entropyVolatility),
      entropyDrift: round(entropyDrift),
      concentration: round(concentration),
      uniqueRatio: round(uniqueRatio),
      sectorSkew: round(sectorSkew),
      confidence: round(confidence)
    };
  }

  private confidence(sampleSize: number, windowCount: number, entropyVolatility: number, concentration: number): number {
    const sampleAdequacy = clamp(sampleSize / this.options.minSampleSize);
    const windowAdequacy = clamp(windowCount / Math.min(this.options.maxWindows, Math.max(1, Math.floor(sampleSize / this.options.windowSize))));
    const stability = clamp(1 - entropyVolatility / Math.max(0.001, this.options.volatilityThreshold * 1.8));
    const concentrationHealth = clamp(1 - concentration / Math.max(0.001, this.options.concentrationThreshold * 1.8));
    return sampleAdequacy * 0.34 + windowAdequacy * 0.22 + stability * 0.24 + concentrationHealth * 0.2;
  }

  private resolveRegime(metrics: RegimeClassificationMetrics, windowCount: number): TableRegime {
    if (metrics.sampleSize < this.options.minSampleSize || windowCount < 2) return 'CHAOTIC';
    if (metrics.normalizedEntropy <= this.options.chaoticEntropyCeiling) return 'CHAOTIC';
    if (metrics.concentration >= this.options.concentrationThreshold * 1.25) return 'CHAOTIC';
    if (metrics.entropyVolatility >= this.options.volatilityThreshold) return 'VOLATILE';
    if (Math.abs(metrics.entropyDrift) >= this.options.driftThreshold || metrics.sectorSkew >= 0.46) return 'DRIFTING';
    if (metrics.normalizedEntropy >= this.options.stableEntropyFloor && metrics.confidence >= 0.58) return 'STABLE';
    return 'VOLATILE';
  }

  private signalPolicy(regime: TableRegime, metrics: RegimeClassificationMetrics): RegimeSignalPolicy {
    if (regime === 'CHAOTIC') return 'BLOCK_SIGNALS';
    if (regime === 'VOLATILE') return metrics.confidence >= 0.72 ? 'OBSERVE_ONLY' : 'BLOCK_SIGNALS';
    if (regime === 'DRIFTING') return 'OBSERVE_ONLY';
    return 'ALLOW_RESEARCH';
  }

  private blockers(regime: TableRegime, metrics: RegimeClassificationMetrics, windowCount: number): readonly string[] {
    const blockers: string[] = [];
    if (metrics.sampleSize < this.options.minSampleSize) blockers.push('Amostra insuficiente para classificar regime de mesa com segurança.');
    if (windowCount < 2) blockers.push('Histórico produz menos de duas janelas comparáveis para detecção de drift.');
    if (regime === 'CHAOTIC') blockers.push('Regime caótico bloqueia sinais: entropia/concentração incompatíveis com decisão robusta.');
    if (regime === 'VOLATILE' && metrics.confidence < 0.72) blockers.push('Regime volátil com baixa confiança bloqueia extrapolação operacional.');
    return blockers;
  }

  private warnings(regime: TableRegime, metrics: RegimeClassificationMetrics, windowCount: number): readonly string[] {
    const warnings: string[] = [];
    if (regime === 'DRIFTING') warnings.push('Regime em drift: sinais devem permanecer em observação até estabilização.');
    if (regime === 'VOLATILE') warnings.push('Regime volátil: exigir confirmação externa antes de qualquer hipótese de sinal.');
    if (metrics.entropyVolatility >= this.options.volatilityThreshold * 0.75) warnings.push('Volatilidade de entropia próxima do limite de bloqueio.');
    if (Math.abs(metrics.entropyDrift) >= this.options.driftThreshold * 0.75) warnings.push('Drift de entropia próximo do limite de observação.');
    if (windowCount < this.options.maxWindows) warnings.push('Classificação baseada em número reduzido de janelas recentes.');
    if (regime === 'STABLE') warnings.push('Regime estável autoriza apenas pesquisa; não libera stake real.');
    return warnings;
  }

  private rationale(
    regime: TableRegime,
    policy: RegimeSignalPolicy,
    blockers: readonly string[],
    warnings: readonly string[]
  ): string {
    if (blockers.length > 0) return `Regime ${regime} com política ${policy}: ${blockers.slice(0, 2).join(' ')}`;
    if (warnings.length > 0) return `Regime ${regime} com política ${policy}: ${warnings.slice(0, 2).join(' ')}`;
    return `Regime ${regime} com política ${policy}: mesa compatível apenas com avaliação de pesquisa.`;
  }

  private regimeId(
    history: readonly number[],
    metrics: RegimeClassificationMetrics,
    regime: TableRegime,
    signalPolicy: RegimeSignalPolicy
  ): string {
    const tail = history.slice(Math.max(0, history.length - 64));
    const payload = JSON.stringify({ tail, metrics, regime, signalPolicy });
    return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 24);
  }

  private validateOptions(options: RegimeClassificationOptions): void {
    if (!isPositiveInteger(options.minSampleSize)) throw new Error('invalid_regime_min_sample_size');
    if (!isPositiveInteger(options.windowSize)) throw new Error('invalid_regime_window_size');
    if (!isPositiveInteger(options.maxWindows)) throw new Error('invalid_regime_max_windows');
    if (!isUnit(options.stableEntropyFloor)) throw new Error('invalid_regime_stable_entropy_floor');
    if (!isUnit(options.chaoticEntropyCeiling)) throw new Error('invalid_regime_chaotic_entropy_ceiling');
    if (!isUnit(options.volatilityThreshold)) throw new Error('invalid_regime_volatility_threshold');
    if (!isUnit(options.driftThreshold)) throw new Error('invalid_regime_drift_threshold');
    if (!isUnit(options.concentrationThreshold)) throw new Error('invalid_regime_concentration_threshold');
  }

  private validateHistory(history: readonly number[]): void {
    if (!Array.isArray(history)) throw new Error('invalid_regime_history');
    if (history.length === 0) throw new Error('empty_regime_history');
    for (const value of history) {
      if (!Number.isInteger(value) || value < 0 || value > 36) throw new Error('invalid_regime_history_value');
    }
  }
}

function normalizedEntropy(counts: Int16Array, total: number): number {
  if (total <= 0) return 0;
  let entropy = 0;
  for (const count of counts) {
    if (count === 0) continue;
    const probability = count / total;
    entropy -= probability * Math.log(probability);
  }
  return clamp(entropy / Math.log(ROULETTE_STATE_COUNT));
}

function sectorIndex(value: number): number {
  if (value <= 12) return 0;
  if (value <= 24) return 1;
  return 2;
}

function maxOf(values: Int16Array): number {
  let maximum = 0;
  for (const value of values) {
    if (value > maximum) maximum = value;
  }
  return maximum;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

function std(values: readonly number[]): number {
  if (values.length <= 1) return 0;
  const average = mean(values);
  let variance = 0;
  for (const value of values) variance += Math.pow(value - average, 2);
  return Math.sqrt(variance / values.length);
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isUnit(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Number(value.toFixed(6));
}
