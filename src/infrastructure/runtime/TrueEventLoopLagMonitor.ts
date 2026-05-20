import { performance } from 'node:perf_hooks';

export interface TrueEventLoopLagSnapshot {
  readonly started: boolean;
  readonly sampleCount: number;
  readonly lastLagMs: number;
  readonly maxLagMs: number;
  readonly averageLagMs: number;
}

/**
 * Measures real Node.js scheduler drift using timer delay.
 *
 * It does not measure the time between operator commands.
 * It measures how late the event loop executes a scheduled timer.
 *
 * Complexity:
 * - sample update: O(1)
 * - memory: O(1)
 */
export class TrueEventLoopLagMonitor {
  private timer: NodeJS.Timeout | null = null;
  private expectedNextTickMs = 0;
  private sampleCount = 0;
  private lastLagMs = 0;
  private maxLagMs = 0;
  private lagSumMs = 0;

  public constructor(private readonly intervalMs = 250) {}

  public start(): void {
    if (this.timer !== null) {
      return;
    }

    const now = performance.now();
    this.expectedNextTickMs = now + this.intervalMs;
    this.timer = setTimeout(() => this.tick(), this.intervalMs);
    this.timer.unref?.();
  }

  public stop(): void {
    if (this.timer === null) {
      return;
    }

    clearTimeout(this.timer);
    this.timer = null;
  }

  public snapshot(): TrueEventLoopLagSnapshot {
    return {
      started: this.timer !== null,
      sampleCount: this.sampleCount,
      lastLagMs: this.lastLagMs,
      maxLagMs: this.maxLagMs,
      averageLagMs: this.sampleCount > 0 ? this.lagSumMs / this.sampleCount : 0,
    };
  }

  private tick(): void {
    const now = performance.now();
    const lagMs = Math.max(0, now - this.expectedNextTickMs);

    this.sampleCount += 1;
    this.lastLagMs = lagMs;
    this.maxLagMs = Math.max(this.maxLagMs, lagMs);
    this.lagSumMs += lagMs;

    this.expectedNextTickMs = now + this.intervalMs;
    this.timer = setTimeout(() => this.tick(), this.intervalMs);
    this.timer.unref?.();
  }
}
