import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import {
  RuntimeSessionJournalEvent,
  RuntimeSessionJournalEventType,
} from '../../domain/journal/RuntimeSessionJournalContracts';

export interface RuntimeJournalQuery {
  readonly sessionId?: string;
  readonly type?: RuntimeSessionJournalEventType;
  readonly verdict?: string;
  readonly lifecycleState?: string;
  readonly limit: number;
}

export interface RuntimeJournalQuerySummary {
  readonly scannedLines: number;
  readonly parsedEvents: number;
  readonly invalidLines: number;
  readonly matchedEvents: number;
  readonly truncated: boolean;
}

export interface RuntimeJournalQueryResult {
  readonly events: readonly RuntimeSessionJournalEvent[];
  readonly summary: RuntimeJournalQuerySummary;
}

/**
 * Streaming query engine for append-only runtime-session JSONL journals.
 *
 * It never loads the full journal into memory. It reads one line at a time,
 * applies filters immediately, and stores only matching events up to a strict limit.
 *
 * Complexity:
 * - Time: O(n), where n is the number of journal lines scanned.
 * - Space: O(limit), bounded by the caller.
 */
export class StreamingRuntimeJournalQueryEngine {
  public async query(
    filePath: string,
    query: RuntimeJournalQuery,
  ): Promise<RuntimeJournalQueryResult> {
    const safeLimit = Math.max(0, Math.floor(query.limit));
    const events: RuntimeSessionJournalEvent[] = [];

    let scannedLines = 0;
    let parsedEvents = 0;
    let invalidLines = 0;
    let matchedEvents = 0;
    let truncated = false;

    const stream = createReadStream(filePath, { encoding: 'utf8' });
    const reader = createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    try {
      for await (const line of reader) {
        scannedLines += 1;

        if (line.trim().length === 0) {
          continue;
        }

        const event = this.parseLine(line);

        if (event === null) {
          invalidLines += 1;
          continue;
        }

        parsedEvents += 1;

        if (!this.matches(event, query)) {
          continue;
        }

        matchedEvents += 1;

        if (events.length < safeLimit) {
          events.push(event);
        } else {
          truncated = true;
        }
      }
    } finally {
      reader.close();
      stream.destroy();
    }

    return {
      events,
      summary: {
        scannedLines,
        parsedEvents,
        invalidLines,
        matchedEvents,
        truncated,
      },
    };
  }

  private parseLine(line: string): RuntimeSessionJournalEvent | null {
    try {
      const parsed = JSON.parse(line) as Partial<RuntimeSessionJournalEvent>;

      if (!this.isJournalEvent(parsed)) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  private matches(
    event: RuntimeSessionJournalEvent,
    query: RuntimeJournalQuery,
  ): boolean {
    if (query.sessionId !== undefined && event.sessionId !== query.sessionId) {
      return false;
    }

    if (query.type !== undefined && event.type !== query.type) {
      return false;
    }

    if (query.verdict !== undefined && event.verdict !== query.verdict) {
      return false;
    }

    if (
      query.lifecycleState !== undefined &&
      event.lifecycleState !== query.lifecycleState
    ) {
      return false;
    }

    return true;
  }

  private isJournalEvent(
    value: Partial<RuntimeSessionJournalEvent>,
  ): value is RuntimeSessionJournalEvent {
    return (
      typeof value.eventId === 'string' &&
      typeof value.sessionId === 'string' &&
      Number.isInteger(value.sequence) &&
      Number.isInteger(value.timestampEpochMs) &&
      typeof value.type === 'string' &&
      typeof value.lifecycleState === 'string' &&
      typeof value.verdict === 'string' &&
      typeof value.reason === 'string' &&
      typeof value.payload === 'object' &&
      value.payload !== null
    );
  }
}
