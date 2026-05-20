export interface ReplayPersistenceEvent {
  readonly eventId: string;
  readonly sessionId: string;
  readonly sequence: number;
  readonly timestampEpochMs: number;
  readonly verdict: string;
  readonly trigger: string;
  readonly reason: string;
  readonly latencyMs: number;
}

export type ReplayPersistenceInput =
  | ReplayPersistenceEvent
  | Readonly<Record<string, unknown>>;

export interface ReplayPersistenceResult {
  readonly accepted: boolean;
  readonly eventId: string;
  readonly reason: string;
}

export interface ReplayPersistenceRepository {
  append(event: ReplayPersistenceInput): Promise<ReplayPersistenceResult>;
  persist(event: ReplayPersistenceInput): Promise<ReplayPersistenceResult>;
  appendEvent(event: ReplayPersistenceInput): Promise<ReplayPersistenceResult>;
  record(event: ReplayPersistenceInput): Promise<ReplayPersistenceResult>;
  getPath(): string;
}
