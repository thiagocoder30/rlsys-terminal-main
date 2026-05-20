export type RuntimeSessionJournalEventType =
  | 'COMMAND'
  | 'HUD'
  | 'STATE_TRANSITION'
  | 'SHUTDOWN'
  | 'ERROR';

export interface RuntimeSessionJournalEvent {
  readonly eventId: string;
  readonly sessionId: string;
  readonly sequence: number;
  readonly timestampEpochMs: number;
  readonly type: RuntimeSessionJournalEventType;
  readonly lifecycleState: string;
  readonly verdict: string;
  readonly reason: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface RuntimeSessionJournalResult {
  readonly accepted: boolean;
  readonly eventId: string;
  readonly reason: string;
}

export interface RuntimeSessionJournalRepository {
  append(event: RuntimeSessionJournalEvent): Promise<RuntimeSessionJournalResult>;
  getPath(): string;
}
