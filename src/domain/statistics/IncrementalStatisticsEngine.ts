import crypto from 'crypto';
import { DomainError, err, ok, Result } from '../shared/Result';

export type IncrementalIngestionStatus = 'ACCEPTED' | 'DUPLICATE_IGNORED';
export type IncrementalTrend = 'INSUFFICIENT_DATA' | 'BALANCED' | 'CONCENTRATING' | 'REPEATING';

export interface IncrementalStatisticsOptions {
  readonly windowSize?: number;
  readonly idempotencyCacheSize?: number;
}

export interface IncrementalSpinCommand {
  readonly value: number;
  readonly eventId?: string;
  readonly sequence?: number;
}

export interface IncrementalSectorSnapshot {
  readonly name: 'voisins' | 'tiers' | 'orphelins' | 'zero';
  readonly hits: number;
  readonly hitRate: number;
}

export interface IncrementalStatisticsSnapshot {
  readonly engineVersion: 'incremental-statistics-v1';
  readonly windowSize: number;
  readonly activeSize: number;
  readonly totalAccepted: number;
  readonly duplicateEvents: number;
  readonly lastValue?: number;
  readonly uniqueNumbers: number;
  readonly normalizedEntropy: number;
  readonly repeatRate: number;
  readonly alternationRate: number;
  readonly maxNumberConcentration: number;
  readonly hotNumbers: readonly number[];
  readonly coldNumbers: readonly number[];
  readonly sectors: readonly IncrementalSectorSnapshot[];
  readonly trend: IncrementalTrend;
  readonly checksum: string;
}

export interface IncrementalIngestionReport {
  readonly status: IncrementalIngestionStatus;
  readonly idempotencyKey: string;
  readonly snapshot: IncrementalStatisticsSnapshot;
}

const ROULETTE_VALUES = 37;
const DEFAULT_WINDOW_SIZE = 120;
const DEFAULT_IDEMPOTENCY_CACHE_SIZE = 512;
const SECTORS: readonly IncrementalSectorSnapshot['name'][] = ['voisins', 'tiers', 'orphelins', 'zero'];
const SECTOR_NUMBERS: Record<IncrementalSectorSnapshot['name'], readonly number[]> = {
  voisins: [22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25],
  tiers: [27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33],
  orphelins: [1, 20, 14, 31, 9, 17, 34, 6],
  zero: [0]
};

/**
 * Incremental O(1) roulette statistics engine for live sessions.
 *
 * The engine uses a fixed-size circular buffer and bounded idempotency cache.
 * Window updates mutate numeric counters directly instead of recomputing over
 * the entire live history. Snapshot entropy is O(37), which is constant for a
 * European roulette wheel and safe for low-memory Android devices.
 */
export class IncrementalStatisticsEngine {
  private readonly windowSize: number;
  private readonly idempotencyCacheSize: number;
  private readonly values: number[];
  private readonly counts: number[];
  private readonly sectorCounts = new Map<IncrementalSectorSnapshot['name'], number>();
  private readonly eventIds = new Set<string>();
  private readonly eventIdQueue: string[] = [];
  private cursor = 0;
  private activeSize = 0;
  private totalAccepted = 0;
  private duplicateEvents = 0;
  private repeatTransitions = 0;
  private alternationTransitions = 0;
  private lastValue: number | undefined;

  constructor(options: IncrementalStatisticsOptions = {}) {
    this.windowSize = Math.max(8, Math.trunc(options.windowSize ?? DEFAULT_WINDOW_SIZE));
    this.idempotencyCacheSize = Math.max(this.windowSize, Math.trunc(options.idempotencyCacheSize ?? DEFAULT_IDEMPOTENCY_CACHE_SIZE));
    this.values = new Array<number>(this.windowSize).fill(-1);
    this.counts = new Array<number>(ROULETTE_VALUES).fill(0);
    for (const sector of SECTORS) this.sectorCounts.set(sector, 0);
  }

  public ingest(command: IncrementalSpinCommand): Result<IncrementalIngestionReport, DomainError> {
    const validation = this.validate(command);
    if (validation.length > 0) return err(new DomainError(validation.join('; '), 'INCREMENTAL_STATS_INVALID_SPIN'));

    const idempotencyKey = this.idempotencyKey(command);
    if (this.eventIds.has(idempotencyKey)) {
      this.duplicateEvents += 1;
      return ok({ status: 'DUPLICATE_IGNORED', idempotencyKey, snapshot: this.snapshot() });
    }

    this.trackEventId(idempotencyKey);
    this.acceptValue(command.value);
    return ok({ status: 'ACCEPTED', idempotencyKey, snapshot: this.snapshot() });
  }

  public replay(commands: readonly IncrementalSpinCommand[]): Result<IncrementalStatisticsSnapshot, DomainError> {
    if (!Array.isArray(commands)) return err(new DomainError('commands must be an array', 'INCREMENTAL_STATS_INVALID_REPLAY'));
    for (const command of commands) {
      const result = this.ingest(command);
      if (!result.success) return err(result.error);
    }
    return ok(this.snapshot());
  }

  public snapshot(): IncrementalStatisticsSnapshot {
    const entropy = this.normalizedEntropy();
    const maxCount = this.maxCount();
    const activeSize = this.activeSize;
    const hotNumbers = this.pickHotNumbers(maxCount);
    const coldNumbers = this.pickColdNumbers();
    const repeatRate = activeSize <= 1 ? 0 : this.repeatTransitions / (activeSize - 1);
    const alternationRate = activeSize <= 1 ? 0 : this.alternationTransitions / (activeSize - 1);

    return {
      engineVersion: 'incremental-statistics-v1',
      windowSize: this.windowSize,
      activeSize,
      totalAccepted: this.totalAccepted,
      duplicateEvents: this.duplicateEvents,
      lastValue: this.lastValue,
      uniqueNumbers: this.counts.reduce((total, count) => total + (count > 0 ? 1 : 0), 0),
      normalizedEntropy: this.round(entropy),
      repeatRate: this.round(repeatRate),
      alternationRate: this.round(alternationRate),
      maxNumberConcentration: this.round(activeSize === 0 ? 0 : maxCount / activeSize),
      hotNumbers,
      coldNumbers,
      sectors: this.sectorSnapshots(activeSize),
      trend: this.trend(activeSize, entropy, repeatRate, maxCount),
      checksum: this.checksum()
    };
  }

  public reset(): void {
    this.values.fill(-1);
    this.counts.fill(0);
    for (const sector of SECTORS) this.sectorCounts.set(sector, 0);
    this.eventIds.clear();
    this.eventIdQueue.splice(0, this.eventIdQueue.length);
    this.cursor = 0;
    this.activeSize = 0;
    this.totalAccepted = 0;
    this.duplicateEvents = 0;
    this.repeatTransitions = 0;
    this.alternationTransitions = 0;
    this.lastValue = undefined;
  }

  private acceptValue(value: number): void {
    const previousLast = this.lastValue;
    if (this.activeSize === this.windowSize) {
      const outgoing = this.values[this.cursor];
      this.decrement(outgoing);
    } else {
      this.activeSize += 1;
    }

    this.values[this.cursor] = value;
    this.cursor = (this.cursor + 1) % this.windowSize;
    this.increment(value);
    this.totalAccepted += 1;

    if (previousLast !== undefined) {
      if (previousLast === value) this.repeatTransitions += 1;
      else this.alternationTransitions += 1;
      this.rebalanceTransitionsWhenWindowFull();
    }
    this.lastValue = value;
  }

  private rebalanceTransitionsWhenWindowFull(): void {
    const maxTransitions = Math.max(0, this.activeSize - 1);
    const totalTransitions = this.repeatTransitions + this.alternationTransitions;
    if (totalTransitions <= maxTransitions) return;
    const overflow = totalTransitions - maxTransitions;
    if (this.alternationTransitions >= overflow) this.alternationTransitions -= overflow;
    else {
      const remaining = overflow - this.alternationTransitions;
      this.alternationTransitions = 0;
      this.repeatTransitions = Math.max(0, this.repeatTransitions - remaining);
    }
  }

  private increment(value: number): void {
    this.counts[value] += 1;
    const sector = this.sectorFor(value);
    this.sectorCounts.set(sector, (this.sectorCounts.get(sector) ?? 0) + 1);
  }

  private decrement(value: number): void {
    if (value < 0) return;
    this.counts[value] = Math.max(0, this.counts[value] - 1);
    const sector = this.sectorFor(value);
    this.sectorCounts.set(sector, Math.max(0, (this.sectorCounts.get(sector) ?? 0) - 1));
  }

  private sectorFor(value: number): IncrementalSectorSnapshot['name'] {
    for (const sector of SECTORS) {
      if (SECTOR_NUMBERS[sector].includes(value)) return sector;
    }
    return 'orphelins';
  }

  private normalizedEntropy(): number {
    if (this.activeSize === 0) return 0;
    let entropy = 0;
    for (const count of this.counts) {
      if (count === 0) continue;
      const probability = count / this.activeSize;
      entropy -= probability * Math.log2(probability);
    }
    return entropy / Math.log2(ROULETTE_VALUES);
  }

  private maxCount(): number {
    let max = 0;
    for (const count of this.counts) if (count > max) max = count;
    return max;
  }

  private pickHotNumbers(maxCount: number): readonly number[] {
    if (maxCount === 0) return [];
    const numbers: number[] = [];
    for (let number = 0; number < this.counts.length; number += 1) {
      if (this.counts[number] === maxCount) numbers.push(number);
      if (numbers.length === 5) break;
    }
    return numbers;
  }

  private pickColdNumbers(): readonly number[] {
    if (this.activeSize === 0) return [];
    const numbers: number[] = [];
    for (let number = 0; number < this.counts.length; number += 1) {
      if (this.counts[number] === 0) numbers.push(number);
      if (numbers.length === 5) break;
    }
    return numbers;
  }

  private sectorSnapshots(activeSize: number): readonly IncrementalSectorSnapshot[] {
    return SECTORS.map(sector => {
      const hits = this.sectorCounts.get(sector) ?? 0;
      return { name: sector, hits, hitRate: this.round(activeSize === 0 ? 0 : hits / activeSize) };
    });
  }

  private trend(activeSize: number, entropy: number, repeatRate: number, maxCount: number): IncrementalTrend {
    if (activeSize < Math.min(16, this.windowSize)) return 'INSUFFICIENT_DATA';
    const concentration = activeSize === 0 ? 0 : maxCount / activeSize;
    if (repeatRate >= 0.35) return 'REPEATING';
    if (concentration >= 0.22 || entropy < 0.62) return 'CONCENTRATING';
    return 'BALANCED';
  }

  private validate(command: IncrementalSpinCommand): string[] {
    const errors: string[] = [];
    if (!command || typeof command !== 'object') errors.push('command is required');
    if (!Number.isInteger(command.value) || command.value < 0 || command.value > 36) errors.push(`invalid roulette value: ${String(command.value)}`);
    if (command.sequence !== undefined && (!Number.isInteger(command.sequence) || command.sequence < 0)) errors.push('sequence must be a non-negative integer');
    return errors;
  }

  private idempotencyKey(command: IncrementalSpinCommand): string {
    if (command.eventId && command.eventId.trim().length > 0) return command.eventId.trim();
    return crypto.createHash('sha256').update(`${command.sequence ?? 'no-seq'}|${command.value}`).digest('hex').slice(0, 24);
  }

  private trackEventId(idempotencyKey: string): void {
    this.eventIds.add(idempotencyKey);
    this.eventIdQueue.push(idempotencyKey);
    while (this.eventIdQueue.length > this.idempotencyCacheSize) {
      const oldest = this.eventIdQueue.shift();
      if (oldest) this.eventIds.delete(oldest);
    }
  }

  private checksum(): string {
    const ordered = this.orderedValues().join(',');
    return crypto.createHash('sha256').update(`${this.windowSize}|${this.activeSize}|${ordered}`).digest('hex');
  }

  private orderedValues(): readonly number[] {
    const output: number[] = [];
    const start = this.activeSize === this.windowSize ? this.cursor : 0;
    for (let offset = 0; offset < this.activeSize; offset += 1) {
      output.push(this.values[(start + offset) % this.windowSize]);
    }
    return output;
  }

  private round(value: number): number {
    return Number.isFinite(value) ? Number(value.toFixed(6)) : 0;
  }
}
