import type {
  RuntimeEnduranceTrendSummary,
} from "./RuntimeEnduranceReportReader.js";

export interface RuntimeEnduranceCliReportOptions {
  readonly width?: number;
  readonly compact?: boolean;
}

export interface RuntimeEnduranceCliReport {
  readonly text: string;
  readonly lineCount: number;
  readonly status: "READY" | "WARNING" | "FAILED" | "NO_DATA";
}

/**
 * Renders human-readable endurance trend summaries for terminal operation.
 *
 * This renderer is pure and side-effect free. It is suitable for tmux panes,
 * CLI output and future cockpit dashboards.
 *
 * Complexity:
 * - O(n), where n is the number of certified reports rendered in detail.
 * - Memory O(n) for output lines.
 */
export class RuntimeEnduranceCliReporter {
  public render(
    summary: RuntimeEnduranceTrendSummary,
    options: RuntimeEnduranceCliReportOptions = {},
  ): RuntimeEnduranceCliReport {
    const status = this.status(summary);

    if (options.compact === true) {
      const text = [
        `ENDURANCE ${status}`,
        `reports=${summary.totalReports} certified=${summary.certifiedReports} warnings=${summary.warnings} failed=${summary.failedReports}`,
        `heapRegression=${summary.heapDriftRegression ? "YES" : "NO"} lagRegression=${summary.lagRegression ? "YES" : "NO"}`,
      ].join("\n");

      return {
        text,
        lineCount: 3,
        status,
      };
    }

    const width = Math.max(56, Math.min(options.width ?? 76, 100));
    const border = "─".repeat(width - 2);
    const lines: string[] = [];

    lines.push(`┌${border}┐`);
    lines.push(this.row("RL.SYS CORE — ENDURANCE CERTIFICATION REPORT", width));
    lines.push(`├${border}┤`);
    lines.push(this.row(`Status            : ${status}`, width));
    lines.push(this.row(`Total Reports     : ${summary.totalReports}`, width));
    lines.push(this.row(`Certified Reports : ${summary.certifiedReports}`, width));
    lines.push(this.row(`Warnings          : ${summary.warnings}`, width));
    lines.push(this.row(`Failed Reports    : ${summary.failedReports}`, width));
    lines.push(this.row(`Heap Regression   : ${summary.heapDriftRegression ? "YES" : "NO"}`, width));
    lines.push(this.row(`Lag Regression    : ${summary.lagRegression ? "YES" : "NO"}`, width));

    if (summary.regressionMessages.length > 0) {
      lines.push(`├${border}┤`);
      for (const message of summary.regressionMessages) {
        lines.push(this.row(`Regression: ${message}`, width));
      }
    }

    if (summary.reports.length > 0) {
      lines.push(`├${border}┤`);

      for (const report of summary.reports) {
        lines.push(this.row(
          `${report.name}: ${report.certification.status} score=${report.certification.score}`,
          width,
        ));
      }
    }

    lines.push(`└${border}┘`);

    return {
      text: lines.join("\n"),
      lineCount: lines.length,
      status,
    };
  }

  private status(summary: RuntimeEnduranceTrendSummary): "READY" | "WARNING" | "FAILED" | "NO_DATA" {
    if (summary.totalReports === 0) {
      return "NO_DATA";
    }

    if (summary.failedReports > 0 || summary.heapDriftRegression || summary.lagRegression) {
      return "FAILED";
    }

    if (summary.warnings > 0) {
      return "WARNING";
    }

    return "READY";
  }

  private row(content: string, width: number): string {
    const maxContentLength = width - 4;
    const visible = content.length > maxContentLength
      ? content.slice(0, maxContentLength - 1)
      : content;

    return `│ ${visible.padEnd(maxContentLength, " ")} │`;
  }
}
