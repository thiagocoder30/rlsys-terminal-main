import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import {
  ReplayPersistenceEvent,
  ReplayPersistenceInput,
  ReplayPersistenceRepository,
  ReplayPersistenceResult,
} from '../../domain/replay/ReplayPersistenceContracts';

const DEFAULT_REPLAY_FILE = 'session-replay.jsonl';

/**
 * Append-only JSONL replay repository.
 *
 * Compatibility guarantees:
 * - accepts either a directory or an explicit .jsonl file path
 * - exposes append(), persist(), appendEvent() and record()
 * - accepts new replay events with eventId
 * - accepts legacy event-like objects without eventId by deriving a stable id
 * - never loads replay history into memory
 *
 * Complexity:
 * - append path resolution: O(1)
 * - event normalization: O(1)
 * - write: append-only filesystem operation
 */
export class JsonLinesReplayRepository implements ReplayPersistenceRepository {
  private readonly resolvedFilePath: string;
  private readonly seenEventIds = new Set<string>();

  public constructor(pathOrDirectory: string) {
    this.resolvedFilePath = this.resolvePath(pathOrDirectory);
  }

  public getPath(): string {
    return this.resolvedFilePath;
  }

  public async append(input: ReplayPersistenceInput): Promise<ReplayPersistenceResult> {
    const event = this.normalize(input);

    if (!this.isValid(event)) {
      return {
        accepted: false,
        eventId: event.eventId,
        reason: 'invalid replay persistence event',
      };
    }

    if (this.seenEventIds.has(event.eventId)) {
      return {
        accepted: true,
        eventId: event.eventId,
        reason: 'replay event already persisted in current process',
      };
    }

    await mkdir(dirname(this.resolvedFilePath), { recursive: true });
    await appendFile(this.resolvedFilePath, `${JSON.stringify(event)}\n`, 'utf8');

    this.seenEventIds.add(event.eventId);

    return {
      accepted: true,
      eventId: event.eventId,
      reason: 'replay event persisted',
    };
  }

  public async persist(input: ReplayPersistenceInput): Promise<ReplayPersistenceResult> {
    return this.append(input);
  }

  public async appendEvent(input: ReplayPersistenceInput): Promise<ReplayPersistenceResult> {
    return this.append(input);
  }

  public async record(input: ReplayPersistenceInput): Promise<ReplayPersistenceResult> {
    return this.append(input);
  }

  private resolvePath(pathOrDirectory: string): string {
    if (extname(pathOrDirectory) === '.jsonl') {
      return pathOrDirectory;
    }

    return join(pathOrDirectory, DEFAULT_REPLAY_FILE);
  }

  private normalize(input: ReplayPersistenceInput): ReplayPersistenceEvent {
    const source = input as Readonly<Record<string, unknown>>;

    const sessionId = this.readString(source, ['sessionId', 'session', 'session_id'], 'default-session');
    const sequence = this.readInteger(source, ['sequence', 'seq', 'index'], 0);
    const timestampEpochMs = this.readInteger(
      source,
      ['timestampEpochMs', 'timestamp', 'createdAtEpochMs', 'time'],
      Date.now(),
    );
    const verdict = this.readString(source, ['verdict', 'state', 'status'], 'UNKNOWN');
    const trigger = this.readString(source, ['trigger', 'type', 'kind'], 'UNKNOWN');
    const reason = this.readString(source, ['reason', 'message', 'cause'], 'replay event persisted');
    const latencyMs = this.readNumber(source, ['latencyMs', 'latency', 'durationMs'], 0);

    const fallbackEventId = [
      sessionId,
      sequence.toString(),
      timestampEpochMs.toString(),
      verdict,
      trigger,
    ].join(':');

    const eventId = this.readString(source, ['eventId', 'id', 'event_id'], fallbackEventId);

    return {
      eventId,
      sessionId,
      sequence,
      timestampEpochMs,
      verdict,
      trigger,
      reason,
      latencyMs,
    };
  }

  private readString(
    source: Readonly<Record<string, unknown>>,
    keys: readonly string[],
    fallback: string,
  ): string {
    for (const key of keys) {
      const value = source[key];

      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }

    return fallback;
  }

  private readInteger(
    source: Readonly<Record<string, unknown>>,
    keys: readonly string[],
    fallback: number,
  ): number {
    for (const key of keys) {
      const value = source[key];

      if (Number.isInteger(value)) {
        return value as number;
      }
    }

    return fallback;
  }

  private readNumber(
    source: Readonly<Record<string, unknown>>,
    keys: readonly string[],
    fallback: number,
  ): number {
    for (const key of keys) {
      const value = source[key];

      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
    }

    return fallback;
  }

  private isValid(event: ReplayPersistenceEvent): boolean {
    return (
      event.eventId.length > 0 &&
      event.sessionId.length > 0 &&
      Number.isInteger(event.sequence) &&
      event.sequence >= 0 &&
      Number.isInteger(event.timestampEpochMs) &&
      event.timestampEpochMs > 0 &&
      Number.isFinite(event.latencyMs) &&
      event.latencyMs >= 0
    );
  }
}
