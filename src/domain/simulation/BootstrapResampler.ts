import crypto from 'crypto';
import { RouletteStats } from '../services/RouletteStats';

export interface BootstrapResamplerOptions {
  seed: string;
  sampleSize?: number;
  blockSize: number;
  preserveLocalDependence: boolean;
}

export interface BootstrapSample {
  id: string;
  values: number[];
  checksum: string;
  sourceLength: number;
  blockSize: number;
  replacementRatio: number;
}

export interface BootstrapPlan {
  sourceLength: number;
  sampleSize: number;
  blockSize: number;
  preserveLocalDependence: boolean;
  seed: string;
}

function hash(input: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

class DeterministicRandom {
  private state: number;

  constructor(seed: string) {
    const digest = crypto.createHash('sha256').update(seed).digest();
    this.state = digest.readUInt32BE(0) || 0x9e3779b9;
  }

  public next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  public int(maxExclusive: number): number {
    return Math.floor(this.next() * Math.max(1, maxExclusive));
  }
}

export class BootstrapResampler {
  public createPlan(history: number[], options: Partial<BootstrapResamplerOptions> = {}): BootstrapPlan {
    const values = this.validate(history);
    const blockSize = Math.max(1, Math.min(values.length, Math.floor(options.blockSize ?? Math.sqrt(values.length))));
    const sampleSize = Math.max(1, Math.floor(options.sampleSize ?? values.length));
    return {
      sourceLength: values.length,
      sampleSize,
      blockSize,
      preserveLocalDependence: options.preserveLocalDependence ?? true,
      seed: options.seed ?? 'rlsys-bootstrap-v2'
    };
  }

  public sample(history: number[], sampleId: number, options: Partial<BootstrapResamplerOptions> = {}): BootstrapSample {
    const values = this.validate(history);
    const plan = this.createPlan(values, options);
    const rng = new DeterministicRandom(`${plan.seed}:${sampleId}:${hash(values.slice(0, 32))}`);
    const sampled = plan.preserveLocalDependence
      ? this.blockSample(values, plan.sampleSize, plan.blockSize, rng)
      : this.pointSample(values, plan.sampleSize, rng);

    const uniquePositions = new Set<number>();
    sampled.sourceIndexes.forEach(index => uniquePositions.add(index));
    const replacementRatio = 1 - uniquePositions.size / Math.max(1, plan.sampleSize);
    const resultValues = sampled.values.slice(0, plan.sampleSize);

    return {
      id: `bootstrap-${sampleId}`,
      values: resultValues,
      checksum: hash({ sampleId, values: resultValues, plan }),
      sourceLength: values.length,
      blockSize: plan.blockSize,
      replacementRatio: round(Math.max(0, Math.min(1, replacementRatio)))
    };
  }

  public samples(history: number[], count: number, options: Partial<BootstrapResamplerOptions> = {}): BootstrapSample[] {
    const safeCount = Math.max(1, Math.floor(count));
    return Array.from({ length: safeCount }, (_, index) => this.sample(history, index, options));
  }

  private validate(history: number[]): number[] {
    const result = RouletteStats.validate(history);
    if (!result.ok) throw new Error(`invalid_bootstrap_history: ${result.errors.slice(0, 3).join('; ')}`);
    if (result.values.length < 80) throw new Error('insufficient_bootstrap_history: minimum 80 valid spins required');
    return result.values;
  }

  private pointSample(values: number[], sampleSize: number, rng: DeterministicRandom): { values: number[]; sourceIndexes: number[] } {
    const output: number[] = [];
    const sourceIndexes: number[] = [];
    for (let index = 0; index < sampleSize; index += 1) {
      const sourceIndex = rng.int(values.length);
      output.push(values[sourceIndex]);
      sourceIndexes.push(sourceIndex);
    }
    return { values: output, sourceIndexes };
  }

  private blockSample(values: number[], sampleSize: number, blockSize: number, rng: DeterministicRandom): { values: number[]; sourceIndexes: number[] } {
    const output: number[] = [];
    const sourceIndexes: number[] = [];
    while (output.length < sampleSize) {
      const start = rng.int(values.length);
      for (let offset = 0; offset < blockSize && output.length < sampleSize; offset += 1) {
        const sourceIndex = (start + offset) % values.length;
        output.push(values[sourceIndex]);
        sourceIndexes.push(sourceIndex);
      }
    }
    return { values: output, sourceIndexes };
  }
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
