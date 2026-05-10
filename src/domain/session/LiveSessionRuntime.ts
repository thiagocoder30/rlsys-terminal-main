import crypto from 'crypto';
import { DomainError, err, ok, Result } from '../shared/Result';
import { LiveSessionControlFrame, LiveSessionStateMachine } from './LiveSessionStateMachine';

export type LiveSessionStatus = 'INITIALIZING' | 'WARMED_UP' | 'LIVE_READY' | 'BLOCKED';
export type LiveRoundIngestionStatus = 'ACCEPTED' | 'DUPLICATE_IGNORED' | 'REJECTED';

export interface LiveSessionRuntimeOptions {
  readonly warmupSize?: number;
  readonly maxHistorySize?: number;
  readonly maxEventIdCacheSize?: number;
  readonly decisionWindowSize?: number;
}

export interface LiveRoundCommand {
  readonly sessionId: string;
  readonly value: number;
  readonly eventId?: string;
  readonly sequence?: number;
  readonly occurredAt?: string;
}

export interface LiveSessionSnapshot {
  readonly engineVersion: 'live-session-runtime-v1';
  readonly sessionId: string;
  readonly status: LiveSessionStatus;
  readonly roundCount: number;
  readonly acceptedEvents: number;
  readonly duplicateEvents: number;
  readonly rejectedEvents: number;
  readonly lastValue?: number;
  readonly lastSequence?: number;
  readonly warmupProgress: number;
  readonly readyForDecision: boolean;
  readonly historyWindow: readonly number[];
  readonly warmupWindow: readonly number[];
  readonly rolling: {
    readonly windowSize: number;
    readonly uniqueNumbers: number;
    readonly normalizedEntropy: number;
    readonly repeatRate: number;
    readonly maxNumberConcentration: number;
    readonly alternationRate: number;
  };
  readonly control: LiveSessionControlFrame;
  readonly checksum: string;
  readonly updatedAt: string;
}

export interface LiveRoundIngestionReport {
  readonly status: LiveRoundIngestionStatus;
  readonly reason?: string;
  readonly idempotencyKey: string;
  readonly snapshot: LiveSessionSnapshot;
}

interface MutableSessionState {
  sessionId: string;
  status: LiveSessionStatus;
  values: number[];
  eventIds: Set<string>;
  eventIdQueue: string[];
  acceptedEvents: number;
  duplicateEvents: number;
  rejectedEvents: number;
  lastSequence?: number;
  updatedAt: string;
}

const ROULETTE_VALUES = 37;

/**
 * Live session runtime responsible for deterministic round-by-round state updates.
 *
 * The runtime is domain-only and framework agnostic. It keeps bounded in-memory
 * windows and an idempotency cache to make repeated event delivery safe. Each
 * accepted round is O(1) amortized for ingestion and O(k) for snapshot metrics,
 * where k is the fixed rolling window size, preserving mobile-device safety.
 */
export class LiveSessionRuntime {
  private readonly warmupSize: number;
  private readonly maxHistorySize: number;
  private readonly maxEventIdCacheSize: number;
  private readonly decisionWindowSize: number;
  private readonly stateMachine: LiveSessionStateMachine;
  private readonly sessions = new Map<string, MutableSessionState>();

  constructor(options: LiveSessionRuntimeOptions = {}) {
    this.warmupSize = Math.max(20, Math.trunc(options.warmupSize ?? 100));
    this.maxHistorySize = Math.max(this.warmupSize, Math.trunc(options.maxHistorySize ?? 240));
    this.maxEventIdCacheSize = Math.max(this.maxHistorySize, Math.trunc(options.maxEventIdCacheSize ?? 512));
    this.decisionWindowSize = Math.max(this.warmupSize, Math.min(this.maxHistorySize, Math.trunc(options.decisionWindowSize ?? 120)));
    this.stateMachine = new LiveSessionStateMachine({ warmupSize: this.warmupSize, decisionWindowSize: this.warmupSize });
  }

  public ingest(command: LiveRoundCommand): Result<LiveRoundIngestionReport, DomainError> {
    const validation = this.validateCommand(command);
    if (validation.length > 0) {
      const sessionId = typeof command.sessionId === 'string' && command.sessionId.trim().length > 0 ? command.sessionId.trim() : 'invalid-session';
      const state = this.getOrCreateSession(sessionId);
      state.rejectedEvents += 1;
      state.status = 'BLOCKED';
      state.updatedAt = new Date().toISOString();
      return err(new DomainError(validation.join('; '), 'LIVE_SESSION_INVALID_ROUND'));
    }

    const sessionId = command.sessionId.trim();
    const state = this.getOrCreateSession(sessionId);
    const idempotencyKey = this.idempotencyKey(command);

    if (state.eventIds.has(idempotencyKey)) {
      state.duplicateEvents += 1;
      state.updatedAt = new Date().toISOString();
      return ok({
        status: 'DUPLICATE_IGNORED',
        reason: 'Round event already processed for this session.',
        idempotencyKey,
        snapshot: this.snapshot(state)
      });
    }

    this.trackEventId(state, idempotencyKey);
    state.values.push(command.value);
    if (state.values.length > this.maxHistorySize) state.values.shift();
    state.lastSequence = Number.isInteger(command.sequence) ? command.sequence : state.lastSequence;
    state.acceptedEvents += 1;
    state.status = this.statusFor(state.values.length);
    state.updatedAt = command.occurredAt ?? new Date().toISOString();

    return ok({ status: 'ACCEPTED', idempotencyKey, snapshot: this.snapshot(state) });
  }

  public snapshotBySession(sessionId: string): Result<LiveSessionSnapshot, DomainError> {
    const key = sessionId.trim();
    if (!key) return err(new DomainError('Session id is required.', 'LIVE_SESSION_ID_REQUIRED'));
    const state = this.sessions.get(key);
    if (!state) return err(new DomainError('Live session not found.', 'LIVE_SESSION_NOT_FOUND'));
    return ok(this.snapshot(state));
  }

  public reset(sessionId: string): Result<LiveSessionSnapshot, DomainError> {
    const key = sessionId.trim();
    if (!key) return err(new DomainError('Session id is required.', 'LIVE_SESSION_ID_REQUIRED'));
    const state = this.createSession(key);
    this.sessions.set(key, state);
    return ok(this.snapshot(state));
  }

  private validateCommand(command: LiveRoundCommand): string[] {
    const errors: string[] = [];
    if (!command || typeof command !== 'object') errors.push('Round command is required.');
    if (typeof command.sessionId !== 'string' || command.sessionId.trim().length === 0) errors.push('sessionId is required.');
    if (!Number.isInteger(command.value) || command.value < 0 || command.value > 36) errors.push(`Invalid roulette value: ${command.value}`);
    if (command.sequence !== undefined && (!Number.isInteger(command.sequence) || command.sequence < 0)) errors.push('sequence must be a non-negative integer.');
    return errors;
  }

  private getOrCreateSession(sessionId: string): MutableSessionState {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;
    const created = this.createSession(sessionId);
    this.sessions.set(sessionId, created);
    return created;
  }

  private createSession(sessionId: string): MutableSessionState {
    return {
      sessionId,
      status: 'INITIALIZING',
      values: [],
      eventIds: new Set<string>(),
      eventIdQueue: [],
      acceptedEvents: 0,
      duplicateEvents: 0,
      rejectedEvents: 0,
      updatedAt: new Date().toISOString()
    };
  }

  private statusFor(windowSize: number): LiveSessionStatus {
    if (windowSize < this.warmupSize) return 'INITIALIZING';
    if (windowSize < this.decisionWindowSize) return 'WARMED_UP';
    return 'LIVE_READY';
  }

  private trackEventId(state: MutableSessionState, idempotencyKey: string): void {
    state.eventIds.add(idempotencyKey);
    state.eventIdQueue.push(idempotencyKey);
    while (state.eventIdQueue.length > this.maxEventIdCacheSize) {
      const oldest = state.eventIdQueue.shift();
      if (oldest) state.eventIds.delete(oldest);
    }
  }

  private idempotencyKey(command: LiveRoundCommand): string {
    if (command.eventId && command.eventId.trim().length > 0) return command.eventId.trim();
    const source = `${command.sessionId.trim()}|${command.sequence ?? 'no-seq'}|${command.value}|${command.occurredAt ?? 'no-time'}`;
    return crypto.createHash('sha256').update(source).digest('hex').slice(0, 24);
  }

  private snapshot(state: MutableSessionState): LiveSessionSnapshot {
    const historyWindow = state.values.slice(-this.maxHistorySize);
    const warmupWindow = state.values.slice(-this.warmupSize);
    const rollingWindow = state.values.slice(-Math.min(32, state.values.length));
    const rolling = this.rollingMetrics(rollingWindow);
    const control = this.stateMachine.evaluate({ status: state.status, roundCount: state.values.length, rolling });
    const checksum = crypto.createHash('sha256').update(historyWindow.join(',')).digest('hex');

    return {
      engineVersion: 'live-session-runtime-v1',
      sessionId: state.sessionId,
      status: state.status,
      roundCount: state.values.length,
      acceptedEvents: state.acceptedEvents,
      duplicateEvents: state.duplicateEvents,
      rejectedEvents: state.rejectedEvents,
      lastValue: state.values[state.values.length - 1],
      lastSequence: state.lastSequence,
      warmupProgress: this.round(Math.min(1, state.values.length / this.warmupSize)),
      readyForDecision: state.values.length >= this.warmupSize && state.status !== 'BLOCKED',
      historyWindow,
      warmupWindow,
      rolling,
      control,
      checksum,
      updatedAt: state.updatedAt
    };
  }

  private rollingMetrics(values: readonly number[]): LiveSessionSnapshot['rolling'] {
    if (values.length === 0) {
      return { windowSize: 0, uniqueNumbers: 0, normalizedEntropy: 0, repeatRate: 0, maxNumberConcentration: 0, alternationRate: 0 };
    }
    const counts = new Array<number>(ROULETTE_VALUES).fill(0);
    let repeats = 0;
    let alternations = 0;
    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];
      counts[value] += 1;
      if (index > 0) {
        if (value === values[index - 1]) repeats += 1;
        else alternations += 1;
      }
    }
    const entropy = this.entropy(counts, values.length);
    return {
      windowSize: values.length,
      uniqueNumbers: counts.filter(count => count > 0).length,
      normalizedEntropy: this.round(entropy / Math.log2(ROULETTE_VALUES)),
      repeatRate: this.round(values.length <= 1 ? 0 : repeats / (values.length - 1)),
      maxNumberConcentration: this.round(Math.max(...counts) / values.length),
      alternationRate: this.round(values.length <= 1 ? 0 : alternations / (values.length - 1))
    };
  }

  private entropy(counts: readonly number[], total: number): number {
    let entropy = 0;
    for (const count of counts) {
      if (count === 0) continue;
      const probability = count / total;
      entropy -= probability * Math.log2(probability);
    }
    return entropy;
  }

  private round(value: number): number {
    return Number.isFinite(value) ? Number(value.toFixed(6)) : 0;
  }
}
