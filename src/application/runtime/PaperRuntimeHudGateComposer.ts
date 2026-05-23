import type {
  PaperRuntimeSupervisorResult,
} from "./PaperRuntimeSessionSupervisor.js";

export interface PaperRuntimeHudGateOptions {
  readonly compact?: boolean;
  readonly width?: number;
}

export interface PaperRuntimeHudGateSnapshot {
  readonly text: string;
  readonly lineCount: number;
  readonly status: "READY" | "BLOCKED" | "SUPERVISION_REQUIRED";
}

/**
 * Renders paper runtime supervisor decisions into operator-facing HUD text.
 *
 * The composer is pure and side-effect free. It can be used by REPL, tmux,
 * CLI adapters or future UI layers without coupling the runtime to a terminal.
 *
 * Complexity:
 * - O(m), where m is the number of supervisor messages rendered.
 * - Memory O(m) for output lines.
 */
export class PaperRuntimeHudGateComposer {
  public compose(
    result: PaperRuntimeSupervisorResult,
    options: PaperRuntimeHudGateOptions = {},
  ): PaperRuntimeHudGateSnapshot {
    const status = this.status(result);

    if (options.compact === true) {
      const text = [
        `PAPER ${status}`,
        `decision=${result.decision} allowed=${result.allowed ? "YES" : "NO"} next=${result.nextSessionState}`,
        `gate=${result.gate.decision}`,
      ].join("\n");

      return {
        text,
        lineCount: 3,
        status,
      };
    }

    const width = Math.max(58, Math.min(options.width ?? 78, 100));
    const border = "─".repeat(width - 2);
    const lines: string[] = [];

    lines.push(`┌${border}┐`);
    lines.push(this.row("RL.SYS CORE — PAPER OPERATIONAL HUD", width));
    lines.push(`├${border}┤`);
    lines.push(this.row(`Status            : ${status}`, width));
    lines.push(this.row(`Supervisor        : ${result.decision}`, width));
    lines.push(this.row(`Allowed           : ${result.allowed ? "YES" : "NO"}`, width));
    lines.push(this.row(`Next Session State: ${result.nextSessionState}`, width));
    lines.push(this.row(`Gate Decision     : ${result.gate.decision}`, width));

    if (result.messages.length > 0) {
      lines.push(`├${border}┤`);

      for (const message of result.messages) {
        lines.push(this.row(`Guidance: ${message}`, width));
      }
    }

    lines.push(`└${border}┘`);

    return {
      text: lines.join("\n"),
      lineCount: lines.length,
      status,
    };
  }

  private status(result: PaperRuntimeSupervisorResult): "READY" | "BLOCKED" | "SUPERVISION_REQUIRED" {
    if (result.decision === "SUPERVISION_REQUIRED") {
      return "SUPERVISION_REQUIRED";
    }

    if (!result.allowed) {
      return "BLOCKED";
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
