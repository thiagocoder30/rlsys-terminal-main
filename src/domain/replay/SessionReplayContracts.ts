export type ReplayVerdict =
  | 'ALLOW'
  | 'NO_GO'
  | 'REVIEW'
  | 'FREEZE'
  | 'LOCKED'
  | 'BLOCKED';

export interface SessionReplayEvent {
  readonly eventId: string;
  readonly sessionId: string;
  readonly spinIndex: number;
  readonly verdict: ReplayVerdict;
  readonly trigger: string;
  readonly reason: string;
  readonly timestamp: number;
  readonly latencyMs: number;
}

export interface SessionReplayRepository {
  append(event: SessionReplayEvent): Promise<void>;
}
