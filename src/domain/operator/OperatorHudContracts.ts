export type OperatorHudVerdict =
  | 'ALLOW'
  | 'NO_GO'
  | 'OBSERVE'
  | 'REVIEW'
  | 'FREEZE'
  | 'LOCKED'
  | 'BLOCKED';

export type OperatorHudHealth =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'CRITICAL'
  | 'UNKNOWN';

export interface OperatorHudSnapshot {
  readonly verdict: OperatorHudVerdict;
  readonly reason: string;
  readonly paperBalance: number;
  readonly drawdown: number;
  readonly snapshotStatus: string;
  readonly runtimeStatus: OperatorHudHealth;
  readonly freezeStatus: string;
  readonly lastTrigger: string;
  readonly lastReason: string;
  readonly latencyMs: number;
}

export interface OperatorHudRenderOptions {
  readonly currency?: string;
  readonly locale?: string;
  readonly width?: number;
}

export interface OperatorHudRenderer {
  render(snapshot: OperatorHudSnapshot, options?: OperatorHudRenderOptions): string;
}
