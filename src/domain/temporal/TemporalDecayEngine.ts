import { DomainError, err, ok, type Result } from '../shared/Result';

export type TemporalSignalStatus = 'FRESH' | 'AGING' | 'STALE' | 'EXPIRED';
export type TemporalDecayDecision = 'ALLOW' | 'OBSERVE' | 'BLOCK_EXPIRED';

export interface TemporalSignalSnapshot {
  readonly signalId: string;
  readonly label: string;
  readonly observedAtSpin: number;
  readonly currentSpin: number;
  readonly baseConfidence: number;
  readonly halfLifeSpins: number;
  readonly hardTtlSpins: number;
  readonly sourceWeight: number;
}

export interface TemporalDecayOptions {
  readonly minDecayedConfidence: number;
  readonly minFreshnessWeight: number;
  readonly maxExpiredRatio: number;
}

export interface TemporalDecaySignalReport {
  readonly signalId: string;
  readonly label: string;
  readonly ageSpins: number;
  readonly baseConfidence: number;
  readonly decayedConfidence: number;
  readonly freshnessWeight: number;
  readonly sourceWeight: number;
  readonly weightedContribution: number;
  readonly status: TemporalSignalStatus;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}

export interface TemporalDecayReport {
  readonly engineVersion: 'temporal-decay-v1';
  readonly signalCount: number;
  readonly activeSignalCount: number;
  readonly expiredSignalCount: number;
  readonly averageDecayedConfidence: number;
  readonly aggregateFreshnessWeight: number;
  readonly decision: TemporalDecayDecision;
  readonly signals: readonly TemporalDecaySignalReport[];
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}

const DEFAULT_OPTIONS: TemporalDecayOptions = {
  minDecayedConfidence: 0.42,
  minFreshnessWeight: 0.35,
  maxExpiredRatio: 0.34
};

/**
 * Applies exponential temporal decay to strategy signals.
 *
 * This domain engine is deterministic, side-effect free and independent from
 * storage, transport or UI. It models signal aging in spin units so old evidence
 * automatically loses influence before reaching the live decision layer.
 * Complexity is O(n) time and O(n) memory, bounded by the active strategy set.
 */
export class TemporalDecayEngine {
  private readonly options: TemporalDecayOptions;

  public constructor(options: Partial<TemporalDecayOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.validateOptions(this.options);
  }

  public evaluate(signals: readonly TemporalSignalSnapshot[]): Result<TemporalDecayReport, DomainError> {
    try {
      if (!Array.isArray(signals)) throw new Error('invalid_temporal_decay_signals');

      const reports: TemporalDecaySignalReport[] = [];
      let activeSignalCount = 0;
      let expiredSignalCount = 0;
      let decayedConfidenceSum = 0;
      let weightedFreshnessSum = 0;
      let weightSum = 0;

      for (const signal of signals) {
        this.validateSignal(signal);
        const report = this.scoreSignal(signal);
        reports.push(report);

        if (report.status === 'EXPIRED') expiredSignalCount += 1;
        else activeSignalCount += 1;

        decayedConfidenceSum += report.decayedConfidence;
        weightedFreshnessSum += report.freshnessWeight * report.sourceWeight;
        weightSum += report.sourceWeight;
      }

      reports.sort((left, right) => {
        const byStatus = statusWeight(right.status) - statusWeight(left.status);
        if (byStatus !== 0) return byStatus;
        const byContribution = right.weightedContribution - left.weightedContribution;
        if (byContribution !== 0) return byContribution;
        return left.signalId.localeCompare(right.signalId);
      });

      const averageDecayedConfidence = signals.length > 0 ? decayedConfidenceSum / signals.length : 0;
      const aggregateFreshnessWeight = weightSum > 0 ? weightedFreshnessSum / weightSum : 0;
      const blockers = this.blockers(signals.length, expiredSignalCount, averageDecayedConfidence, aggregateFreshnessWeight);
      const warnings = this.warnings(reports, aggregateFreshnessWeight);
      const decision = this.decision(blockers, signals.length, averageDecayedConfidence, aggregateFreshnessWeight);

      return ok({
        engineVersion: 'temporal-decay-v1',
        signalCount: signals.length,
        activeSignalCount,
        expiredSignalCount,
        averageDecayedConfidence: round(averageDecayedConfidence),
        aggregateFreshnessWeight: round(aggregateFreshnessWeight),
        decision,
        signals: reports,
        blockers,
        warnings
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_temporal_decay_error';
      return err(new DomainError(message, 'TEMPORAL_DECAY_FAILED'));
    }
  }

  private scoreSignal(signal: TemporalSignalSnapshot): TemporalDecaySignalReport {
    const ageSpins = signal.currentSpin - signal.observedAtSpin;
    const freshnessWeight = Math.pow(0.5, ageSpins / signal.halfLifeSpins);
    const decayedConfidence = clamp(signal.baseConfidence * freshnessWeight);
    const weightedContribution = clamp(decayedConfidence * signal.sourceWeight);
    const status = this.status(ageSpins, decayedConfidence, freshnessWeight, signal.hardTtlSpins);
    const blockers = this.signalBlockers(status, ageSpins, signal.hardTtlSpins, decayedConfidence, freshnessWeight);
    const warnings = this.signalWarnings(status, decayedConfidence, freshnessWeight);

    return {
      signalId: signal.signalId,
      label: signal.label,
      ageSpins,
      baseConfidence: round(signal.baseConfidence),
      decayedConfidence: round(decayedConfidence),
      freshnessWeight: round(freshnessWeight),
      sourceWeight: round(signal.sourceWeight),
      weightedContribution: round(weightedContribution),
      status,
      blockers,
      warnings
    };
  }

  private status(ageSpins: number, decayedConfidence: number, freshnessWeight: number, hardTtlSpins: number): TemporalSignalStatus {
    if (ageSpins >= hardTtlSpins) return 'EXPIRED';
    if (decayedConfidence < this.options.minDecayedConfidence || freshnessWeight < this.options.minFreshnessWeight) return 'STALE';
    if (freshnessWeight < 0.66) return 'AGING';
    return 'FRESH';
  }

  private blockers(
    signalCount: number,
    expiredSignalCount: number,
    averageDecayedConfidence: number,
    aggregateFreshnessWeight: number
  ): readonly string[] {
    const blockers: string[] = [];
    if (signalCount === 0) blockers.push('Nenhum sinal temporal disponível para avaliação.');
    const expiredRatio = signalCount > 0 ? expiredSignalCount / signalCount : 1;
    if (expiredRatio > this.options.maxExpiredRatio) blockers.push('Proporção de sinais expirados excede política temporal.');
    if (averageDecayedConfidence < this.options.minDecayedConfidence) blockers.push('Confiança média decaída abaixo do mínimo temporal.');
    if (aggregateFreshnessWeight < this.options.minFreshnessWeight) blockers.push('Peso agregado de frescor abaixo do mínimo temporal.');
    return blockers;
  }

  private warnings(reports: readonly TemporalDecaySignalReport[], aggregateFreshnessWeight: number): readonly string[] {
    const warnings: string[] = [];
    const staleCount = reports.filter(report => report.status === 'STALE').length;
    if (staleCount > 0) warnings.push(`${staleCount} sinal(is) envelhecido(s) requerem observação.`);
    if (aggregateFreshnessWeight < 0.55) warnings.push('Frescor agregado em zona de atenção; reduzir peso operacional do sinal.');
    return warnings;
  }

  private decision(
    blockers: readonly string[],
    signalCount: number,
    averageDecayedConfidence: number,
    aggregateFreshnessWeight: number
  ): TemporalDecayDecision {
    if (blockers.length > 0) return 'BLOCK_EXPIRED';
    if (signalCount === 0) return 'BLOCK_EXPIRED';
    if (averageDecayedConfidence < this.options.minDecayedConfidence + 0.08 || aggregateFreshnessWeight < this.options.minFreshnessWeight + 0.12) return 'OBSERVE';
    return 'ALLOW';
  }

  private signalBlockers(
    status: TemporalSignalStatus,
    ageSpins: number,
    hardTtlSpins: number,
    decayedConfidence: number,
    freshnessWeight: number
  ): readonly string[] {
    const blockers: string[] = [];
    if (status === 'EXPIRED') blockers.push(`Sinal expirado: idade ${ageSpins} >= TTL ${hardTtlSpins}.`);
    if (decayedConfidence < this.options.minDecayedConfidence) blockers.push('Confiança decaída abaixo do mínimo.');
    if (freshnessWeight < this.options.minFreshnessWeight) blockers.push('Frescor temporal abaixo do mínimo.');
    return blockers;
  }

  private signalWarnings(status: TemporalSignalStatus, decayedConfidence: number, freshnessWeight: number): readonly string[] {
    const warnings: string[] = [];
    if (status === 'AGING') warnings.push('Sinal ainda utilizável, mas já sofreu decaimento temporal relevante.');
    if (status === 'STALE') warnings.push('Sinal antigo deve ser observado antes de qualquer decisão.');
    if (decayedConfidence < 0.55 && freshnessWeight >= this.options.minFreshnessWeight) warnings.push('Confiança decaída em zona de atenção.');
    return warnings;
  }

  private validateOptions(options: TemporalDecayOptions): void {
    if (!isUnit(options.minDecayedConfidence)) throw new Error('invalid_temporal_decay_min_decayed_confidence');
    if (!isUnit(options.minFreshnessWeight)) throw new Error('invalid_temporal_decay_min_freshness_weight');
    if (!isUnit(options.maxExpiredRatio)) throw new Error('invalid_temporal_decay_max_expired_ratio');
  }

  private validateSignal(signal: TemporalSignalSnapshot): void {
    if (!signal || typeof signal !== 'object') throw new Error('invalid_temporal_signal');
    if (!signal.signalId.trim()) throw new Error('invalid_temporal_signal_id');
    if (!signal.label.trim()) throw new Error('invalid_temporal_signal_label');
    if (!isNonNegativeInteger(signal.observedAtSpin)) throw new Error('invalid_temporal_signal_observed_spin');
    if (!isNonNegativeInteger(signal.currentSpin)) throw new Error('invalid_temporal_signal_current_spin');
    if (signal.currentSpin < signal.observedAtSpin) throw new Error('invalid_temporal_signal_negative_age');
    if (!isUnit(signal.baseConfidence)) throw new Error('invalid_temporal_signal_base_confidence');
    if (!isPositive(signal.halfLifeSpins)) throw new Error('invalid_temporal_signal_half_life');
    if (!isPositive(signal.hardTtlSpins)) throw new Error('invalid_temporal_signal_ttl');
    if (signal.hardTtlSpins < signal.halfLifeSpins) throw new Error('invalid_temporal_signal_ttl_policy');
    if (!isUnit(signal.sourceWeight)) throw new Error('invalid_temporal_signal_source_weight');
  }
}

function statusWeight(status: TemporalSignalStatus): number {
  if (status === 'FRESH') return 4;
  if (status === 'AGING') return 3;
  if (status === 'STALE') return 2;
  return 1;
}

function isUnit(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Number(value.toFixed(6));
}
