export type PaperTradingDecisionVerdict =
  | 'ALLOW'
  | 'NO_GO'
  | 'OBSERVE'
  | 'REVIEW'
  | 'FREEZE'
  | 'LOCKED'
  | 'BLOCKED';

export interface PaperTradingReportEvent {
  readonly sequence: number;
  readonly timestampEpochMs: number;
  readonly verdict: PaperTradingDecisionVerdict;
  readonly reason: string;
  readonly paperBalance: number;
  readonly drawdown: number;
  readonly theoreticalPnl: number;
  readonly latencyMs: number;
}

export interface PaperTradingReportSummary {
  readonly eventCount: number;
  readonly initialBalance: number;
  readonly finalBalance: number;
  readonly netPnl: number;
  readonly maxDrawdown: number;
  readonly averageLatencyMs: number;
  readonly allowCount: number;
  readonly noGoCount: number;
  readonly freezeCount: number;
  readonly lockedCount: number;
}

export interface PaperTradingReportBundle {
  readonly summary: PaperTradingReportSummary;
  readonly markdown: string;
  readonly csv: string;
  readonly jsonl: string;
}

/**
 * Exports bounded institutional paper-trading reports.
 *
 * Complexity:
 * - Time: O(n), one pass for aggregation plus linear serialization.
 * - Space: O(n) only for output strings. Aggregation itself is O(1).
 *
 * This class is intentionally pure domain logic. It does not perform filesystem IO.
 */
export class PaperTradingReportExporter {
  public export(events: readonly PaperTradingReportEvent[]): PaperTradingReportBundle {
    const summary = this.summarize(events);

    return {
      summary,
      markdown: this.toMarkdown(summary),
      csv: this.toCsv(events),
      jsonl: this.toJsonl(events),
    };
  }

  private summarize(events: readonly PaperTradingReportEvent[]): PaperTradingReportSummary {
    if (events.length === 0) {
      return {
        eventCount: 0,
        initialBalance: 0,
        finalBalance: 0,
        netPnl: 0,
        maxDrawdown: 0,
        averageLatencyMs: 0,
        allowCount: 0,
        noGoCount: 0,
        freezeCount: 0,
        lockedCount: 0,
      };
    }

    let maxDrawdown = 0;
    let latencySum = 0;
    let allowCount = 0;
    let noGoCount = 0;
    let freezeCount = 0;
    let lockedCount = 0;

    for (const event of events) {
      maxDrawdown = Math.max(maxDrawdown, event.drawdown);
      latencySum += event.latencyMs;

      if (event.verdict === 'ALLOW') allowCount += 1;
      if (event.verdict === 'NO_GO') noGoCount += 1;
      if (event.verdict === 'FREEZE') freezeCount += 1;
      if (event.verdict === 'LOCKED') lockedCount += 1;
    }

    const first = events[0];
    const last = events[events.length - 1];

    return {
      eventCount: events.length,
      initialBalance: first.paperBalance - first.theoreticalPnl,
      finalBalance: last.paperBalance,
      netPnl: last.paperBalance - (first.paperBalance - first.theoreticalPnl),
      maxDrawdown,
      averageLatencyMs: latencySum / events.length,
      allowCount,
      noGoCount,
      freezeCount,
      lockedCount,
    };
  }

  private toMarkdown(summary: PaperTradingReportSummary): string {
    return [
      '# RL.SYS CORE — Paper Trading Report',
      '',
      '## Summary',
      '',
      `- Events: ${summary.eventCount}`,
      `- Initial Balance: ${summary.initialBalance.toFixed(2)}`,
      `- Final Balance: ${summary.finalBalance.toFixed(2)}`,
      `- Net PnL: ${summary.netPnl.toFixed(2)}`,
      `- Max Drawdown: ${summary.maxDrawdown.toFixed(2)}`,
      `- Average Latency: ${summary.averageLatencyMs.toFixed(2)}ms`,
      `- ALLOW Count: ${summary.allowCount}`,
      `- NO_GO Count: ${summary.noGoCount}`,
      `- FREEZE Count: ${summary.freezeCount}`,
      `- LOCKED Count: ${summary.lockedCount}`,
      '',
      '## Institutional Verdict',
      '',
      this.resolveInstitutionalVerdict(summary),
      '',
    ].join('\n');
  }

  private resolveInstitutionalVerdict(summary: PaperTradingReportSummary): string {
    if (summary.eventCount === 0) {
      return 'No paper trading events available for institutional evaluation.';
    }

    if (summary.freezeCount > 0 || summary.lockedCount > 0) {
      return 'Runtime entered defensive protection states. Review freeze/lock lineage before operational escalation.';
    }

    if (summary.netPnl < 0) {
      return 'Paper trading ended negative. Continue observation; do not escalate operational risk.';
    }

    return 'Paper trading remained stable under observed conditions. Continue institutional observation window.';
  }

  private toCsv(events: readonly PaperTradingReportEvent[]): string {
    const header = [
      'sequence',
      'timestampEpochMs',
      'verdict',
      'reason',
      'paperBalance',
      'drawdown',
      'theoreticalPnl',
      'latencyMs',
    ].join(',');

    const rows = events.map((event) => [
      event.sequence,
      event.timestampEpochMs,
      event.verdict,
      this.escapeCsv(event.reason),
      event.paperBalance,
      event.drawdown,
      event.theoreticalPnl,
      event.latencyMs,
    ].join(','));

    return [header, ...rows].join('\n');
  }

  private toJsonl(events: readonly PaperTradingReportEvent[]): string {
    return events.map((event) => JSON.stringify(event)).join('\n');
  }

  private escapeCsv(value: string): string {
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }
}
