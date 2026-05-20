import { performance } from 'node:perf_hooks';

export type RuntimeMemoryPressureState =
  | 'MEMORY_OK'
  | 'MEMORY_REVIEW'
  | 'MEMORY_CRITICAL'
  | 'BLOCKED';

export interface RuntimeMemoryPressureThresholds {
  readonly heapReviewRatio: number;
  readonly heapCriticalRatio: number;
  readonly eventLoopLagReviewMs: number;
  readonly eventLoopLagCriticalMs: number;
}

export interface RuntimeMemoryPressureSample {
  readonly state: RuntimeMemoryPressureState;
  readonly heapUsedBytes: number;
  readonly heapTotalBytes: number;
  readonly heapUsageRatio: number;
  readonly rssBytes: number;
  readonly eventLoopLagMs: number;
  readonly sampledAtEpochMs: number;
  readonly reason: string;
}

export class RuntimeMemoryPressureMonitor {
  private lastTickMs: number;

  public constructor(
    private readonly thresholds: RuntimeMemoryPressureThresholds = {
      heapReviewRatio: 0.70,
      heapCriticalRatio: 0.85,
      eventLoopLagReviewMs: 250,
      eventLoopLagCriticalMs: 500,
    },
  ) {
    this.lastTickMs = performance.now();
  }

  public sample(): RuntimeMemoryPressureSample {
    const now = performance.now();
    const eventLoopLagMs = Math.max(0, now - this.lastTickMs);
    this.lastTickMs = now;

    const usage = process.memoryUsage();
    const heapUsageRatio =
      usage.heapTotal > 0 ? usage.heapUsed / usage.heapTotal : 1;

    const state = this.resolveState(heapUsageRatio, eventLoopLagMs);
    const reason = this.resolveReason(state, heapUsageRatio, eventLoopLagMs);

    return {
      state,
      heapUsedBytes: usage.heapUsed,
      heapTotalBytes: usage.heapTotal,
      heapUsageRatio,
      rssBytes: usage.rss,
      eventLoopLagMs,
      sampledAtEpochMs: Date.now(),
      reason,
    };
  }

  private resolveState(
    heapUsageRatio: number,
    eventLoopLagMs: number,
  ): RuntimeMemoryPressureState {
    if (
      heapUsageRatio >= this.thresholds.heapCriticalRatio ||
      eventLoopLagMs >= this.thresholds.eventLoopLagCriticalMs
    ) {
      return 'MEMORY_CRITICAL';
    }

    if (
      heapUsageRatio >= this.thresholds.heapReviewRatio ||
      eventLoopLagMs >= this.thresholds.eventLoopLagReviewMs
    ) {
      return 'MEMORY_REVIEW';
    }

    return 'MEMORY_OK';
  }

  private resolveReason(
    state: RuntimeMemoryPressureState,
    heapUsageRatio: number,
    eventLoopLagMs: number,
  ): string {
    if (state === 'MEMORY_CRITICAL') {
      return `critical runtime pressure: heap=${heapUsageRatio.toFixed(3)}, lag=${eventLoopLagMs.toFixed(1)}ms`;
    }

    if (state === 'MEMORY_REVIEW') {
      return `runtime pressure review: heap=${heapUsageRatio.toFixed(3)}, lag=${eventLoopLagMs.toFixed(1)}ms`;
    }

    return `runtime healthy: heap=${heapUsageRatio.toFixed(3)}, lag=${eventLoopLagMs.toFixed(1)}ms`;
  }
}
