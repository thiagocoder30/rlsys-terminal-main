export interface CounterSnapshot {
  name: string;
  value: number;
}

export interface TimerSnapshot {
  name: string;
  count: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
}

export interface MetricsSnapshot {
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  counters: CounterSnapshot[];
  timers: TimerSnapshot[];
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
}

export class MetricsRegistry {
  private readonly counters = new Map<string, number>();
  private readonly timers = new Map<string, number[]>();
  private readonly startedAt = Date.now();

  constructor(private readonly service = 'rl-sys-core', private readonly version = '0.9.0') {}

  public increment(name: string, amount = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + amount);
  }

  public observeDuration(name: string, durationMs: number): void {
    const bucket = this.timers.get(name) ?? [];
    bucket.push(Math.max(0, durationMs));
    if (bucket.length > 1000) bucket.shift();
    this.timers.set(name, bucket);
  }

  public snapshot(): MetricsSnapshot {
    const memory = process.memoryUsage();
    return {
      service: this.service,
      version: this.version,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Number(((Date.now() - this.startedAt) / 1000).toFixed(3)),
      counters: Array.from(this.counters.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => a.name.localeCompare(b.name)),
      timers: Array.from(this.timers.entries()).map(([name, values]) => this.timerSnapshot(name, values)).sort((a, b) => a.name.localeCompare(b.name)),
      memory: {
        rssMb: this.toMb(memory.rss),
        heapUsedMb: this.toMb(memory.heapUsed),
        heapTotalMb: this.toMb(memory.heapTotal)
      }
    };
  }

  private timerSnapshot(name: string, values: number[]): TimerSnapshot {
    if (values.length === 0) return { name, count: 0, avgMs: 0, p95Ms: 0, maxMs: 0 };
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, value) => acc + value, 0);
    const p95Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
    return {
      name,
      count: values.length,
      avgMs: Number((sum / values.length).toFixed(3)),
      p95Ms: Number(sorted[p95Index].toFixed(3)),
      maxMs: Number(sorted[sorted.length - 1].toFixed(3))
    };
  }

  private toMb(bytes: number): number {
    return Number((bytes / 1024 / 1024).toFixed(2));
  }
}
