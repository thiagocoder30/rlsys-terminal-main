import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import {
  RuntimeSessionJournalEvent,
  RuntimeSessionJournalRepository,
  RuntimeSessionJournalResult,
} from '../../domain/journal/RuntimeSessionJournalContracts';

const DEFAULT_JOURNAL_FILE = 'runtime-session.jsonl';

/**
 * Append-only runtime session journal repository.
 *
 * It records operational session events without loading historical data.
 * Idempotency is guaranteed per process by eventId.
 */
export class JsonLinesRuntimeSessionJournalRepository implements RuntimeSessionJournalRepository {
  private readonly resolvedFilePath: string;
  private readonly seenEventIds = new Set<string>();

  public constructor(pathOrDirectory: string) {
    this.resolvedFilePath = this.resolvePath(pathOrDirectory);
  }

  public getPath(): string {
    return this.resolvedFilePath;
  }

  public async append(
    event: RuntimeSessionJournalEvent,
  ): Promise<RuntimeSessionJournalResult> {
    if (!this.isValid(event)) {
      return {
        accepted: false,
        eventId: event.eventId,
        reason: 'invalid runtime session journal event',
      };
    }

    if (this.seenEventIds.has(event.eventId)) {
      return {
        accepted: true,
        eventId: event.eventId,
        reason: 'runtime session journal event already persisted in current process',
      };
    }

    await mkdir(dirname(this.resolvedFilePath), { recursive: true });
    await appendFile(this.resolvedFilePath, `${JSON.stringify(event)}\n`, 'utf8');

    this.seenEventIds.add(event.eventId);

    return {
      accepted: true,
      eventId: event.eventId,
      reason: 'runtime session journal event persisted',
    };
  }

  private resolvePath(pathOrDirectory: string): string {
    if (extname(pathOrDirectory) === '.jsonl') {
      return pathOrDirectory;
    }

    return join(pathOrDirectory, DEFAULT_JOURNAL_FILE);
  }

  private isValid(event: RuntimeSessionJournalEvent): boolean {
    return (
      event.eventId.length > 0 &&
      event.sessionId.length > 0 &&
      Number.isInteger(event.sequence) &&
      event.sequence >= 0 &&
      Number.isInteger(event.timestampEpochMs) &&
      event.timestampEpochMs > 0 &&
      event.type.length > 0 &&
      event.lifecycleState.length > 0 &&
      event.verdict.length > 0 &&
      event.reason.length > 0 &&
      typeof event.payload === 'object' &&
      event.payload !== null
    );
  }
}
