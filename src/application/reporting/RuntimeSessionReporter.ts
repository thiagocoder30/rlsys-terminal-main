import {
  RuntimeSessionJournalEvent,
} from '../../domain/journal/RuntimeSessionJournalContracts';
import {
  StreamingRuntimeJournalQueryEngine,
} from '../journal';

export interface RuntimeSessionReportRequest {
  readonly journalPath: string;
  readonly sessionId: string;
  readonly limit: number;
}

export interface RuntimeSessionReportSummary {
  readonly sessionId: string;
  readonly scannedLines: number;
  readonly parsedEvents: number;
  readonly invalidLines: number;
  readonly matchedEvents: number;
  readonly truncated: boolean;
  readonly commandCount: number;
  readonly hudCount: number;
  readonly transitionCount: number;
  readonly shutdownCount: number;
  readonly errorCount: number;
  readonly freezeCount: number;
  readonly blockedCount: number;
  readonly verdictCounts: Readonly<Record<string, number>>;
  readonly lifecycleCounts: Readonly<Record<string, number>>;
}

export interface RuntimeSessionReport {
  readonly summary: RuntimeSessionReportSummary;
  readonly markdown: string;
}

/**
 * Builds human-readable operational reports from the runtime session journal.
 *
 * It relies on the streaming query engine, avoiding full-file reads and keeping
 * memory bounded by the configured query limit.
 *
 * Complexity:
 * - Query scan: O(n)
 * - Aggregation: O(limit)
 * - Memory: O(limit)
 */
export class RuntimeSessionReporter {
  public constructor(
    private readonly queryEngine: StreamingRuntimeJournalQueryEngine =
      new StreamingRuntimeJournalQueryEngine(),
  ) {}

  public async report(
    request: RuntimeSessionReportRequest,
  ): Promise<RuntimeSessionReport> {
    const result = await this.queryEngine.query(request.journalPath, {
      sessionId: request.sessionId,
      limit: request.limit,
    });

    const summary = this.summarize(
      request.sessionId,
      result.events,
      result.summary.scannedLines,
      result.summary.parsedEvents,
      result.summary.invalidLines,
      result.summary.matchedEvents,
      result.summary.truncated,
    );

    return {
      summary,
      markdown: this.toMarkdown(summary),
    };
  }

  private summarize(
    sessionId: string,
    events: readonly RuntimeSessionJournalEvent[],
    scannedLines: number,
    parsedEvents: number,
    invalidLines: number,
    matchedEvents: number,
    truncated: boolean,
  ): RuntimeSessionReportSummary {
    const verdictCounts: Record<string, number> = {};
    const lifecycleCounts: Record<string, number> = {};

    let commandCount = 0;
    let hudCount = 0;
    let transitionCount = 0;
    let shutdownCount = 0;
    let errorCount = 0;
    let freezeCount = 0;
    let blockedCount = 0;

    for (const event of events) {
      if (event.type === 'COMMAND') commandCount += 1;
      if (event.type === 'HUD') hudCount += 1;
      if (event.type === 'STATE_TRANSITION') transitionCount += 1;
      if (event.type === 'SHUTDOWN') shutdownCount += 1;
      if (event.type === 'ERROR') errorCount += 1;

      if (event.verdict === 'FREEZE') freezeCount += 1;
      if (event.verdict === 'BLOCKED') blockedCount += 1;

      verdictCounts[event.verdict] = (verdictCounts[event.verdict] ?? 0) + 1;
      lifecycleCounts[event.lifecycleState] =
        (lifecycleCounts[event.lifecycleState] ?? 0) + 1;
    }

    return {
      sessionId,
      scannedLines,
      parsedEvents,
      invalidLines,
      matchedEvents,
      truncated,
      commandCount,
      hudCount,
      transitionCount,
      shutdownCount,
      errorCount,
      freezeCount,
      blockedCount,
      verdictCounts,
      lifecycleCounts,
    };
  }

  private toMarkdown(summary: RuntimeSessionReportSummary): string {
    return [
      '# RL.SYS CORE — Runtime Session Report',
      '',
      `Session: ${summary.sessionId}`,
      '',
      '## Journal Scan',
      '',
      `- Scanned lines: ${summary.scannedLines}`,
      `- Parsed events: ${summary.parsedEvents}`,
      `- Invalid lines: ${summary.invalidLines}`,
      `- Matched events: ${summary.matchedEvents}`,
      `- Truncated: ${summary.truncated ? 'YES' : 'NO'}`,
      '',
      '## Event Counts',
      '',
      `- COMMAND: ${summary.commandCount}`,
      `- HUD: ${summary.hudCount}`,
      `- STATE_TRANSITION: ${summary.transitionCount}`,
      `- SHUTDOWN: ${summary.shutdownCount}`,
      `- ERROR: ${summary.errorCount}`,
      '',
      '## Risk Signals',
      '',
      `- FREEZE verdicts: ${summary.freezeCount}`,
      `- BLOCKED verdicts: ${summary.blockedCount}`,
      '',
      '## Institutional Verdict',
      '',
      this.institutionalVerdict(summary),
      '',
    ].join('\n');
  }

  private institutionalVerdict(summary: RuntimeSessionReportSummary): string {
    if (summary.truncated) {
      return 'Report truncated by safety limit. Increase limit only if device memory budget allows.';
    }

    if (summary.errorCount > 0 || summary.freezeCount > 0) {
      return 'Session requires institutional review before operational escalation.';
    }

    if (summary.blockedCount > 0) {
      return 'Session contained blocked events. Continue paper observation.';
    }

    return 'Session remained within observed operational safety boundaries.';
  }
}
