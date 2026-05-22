export type RuntimeHudRiskState =
  | "SAFE"
  | "CAUTION"
  | "BLOCKED";

export type RuntimeHudSessionState =
  | "IDLE"
  | "RUNNING"
  | "PAUSED"
  | "FINISHED";

export interface RuntimeHudLiveSnapshot {
  readonly bankroll: number;
  readonly initialBankroll: number;
  readonly profitLocked: number;
  readonly drawdown: number;
  readonly cooldownActive: boolean;
  readonly riskState: RuntimeHudRiskState;
  readonly sessionState: RuntimeHudSessionState;
  readonly lastAction: string;
  readonly updatedAtEpochMs: number;
}

export interface RuntimeHudRenderOptions {
  readonly compact?: boolean;
  readonly width?: number;
}

export interface RuntimeHudRenderResult {
  readonly text: string;
  readonly lineCount: number;
}

/**
 * Renders a lightweight terminal HUD for assisted runtime operation.
 *
 * The renderer is pure and framework-free. It can be used by tmux, readline,
 * tests, mobile shells or future UI adapters without changing domain rules.
 *
 * Complexity:
 * - O(1), because the HUD has fixed-size fields.
 * - Memory O(1).
 */
export class RuntimeHudLiveRenderer {
  public render(
    snapshot: RuntimeHudLiveSnapshot,
    options: RuntimeHudRenderOptions = {},
  ): RuntimeHudRenderResult {
    this.validateSnapshot(snapshot);

    const width = Math.max(42, Math.min(options.width ?? 64, 96));
    const border = "─".repeat(width - 2);
    const net = snapshot.bankroll - snapshot.initialBankroll;

    if (options.compact === true) {
      const text = [
        `RL.SYS | ${snapshot.sessionState} | ${snapshot.riskState}`,
        `bankroll=${this.money(snapshot.bankroll)} net=${this.signedMoney(net)} dd=${this.money(snapshot.drawdown)}`,
        `cooldown=${snapshot.cooldownActive ? "ON" : "OFF"} lock=${this.money(snapshot.profitLocked)} last=${snapshot.lastAction}`,
      ].join("\n");

      return {
        text,
        lineCount: 3,
      };
    }

    const lines = [
      `┌${border}┐`,
      this.row("RL.SYS CORE — ASSISTED RUNTIME HUD", width),
      `├${border}┤`,
      this.row(`Session     : ${snapshot.sessionState}`, width),
      this.row(`Risk State  : ${snapshot.riskState}`, width),
      this.row(`Bankroll    : ${this.money(snapshot.bankroll)}`, width),
      this.row(`Net Result  : ${this.signedMoney(net)}`, width),
      this.row(`Drawdown    : ${this.money(snapshot.drawdown)}`, width),
      this.row(`Profit Lock : ${this.money(snapshot.profitLocked)}`, width),
      this.row(`Cooldown    : ${snapshot.cooldownActive ? "ACTIVE" : "INACTIVE"}`, width),
      this.row(`Last Action : ${snapshot.lastAction}`, width),
      this.row(`Updated At  : ${snapshot.updatedAtEpochMs}`, width),
      `└${border}┘`,
    ];

    return {
      text: lines.join("\n"),
      lineCount: lines.length,
    };
  }

  private validateSnapshot(snapshot: RuntimeHudLiveSnapshot): void {
    const numericFields: ReadonlyArray<readonly [string, number]> = [
      ["bankroll", snapshot.bankroll],
      ["initialBankroll", snapshot.initialBankroll],
      ["profitLocked", snapshot.profitLocked],
      ["drawdown", snapshot.drawdown],
      ["updatedAtEpochMs", snapshot.updatedAtEpochMs],
    ];

    for (const [name, value] of numericFields) {
      if (!Number.isFinite(value)) {
        throw new Error(`Invalid HUD snapshot: ${name} must be finite.`);
      }
    }

    if (snapshot.bankroll < 0 || snapshot.initialBankroll < 0) {
      throw new Error("Invalid HUD snapshot: bankroll values cannot be negative.");
    }

    if (snapshot.drawdown < 0 || snapshot.profitLocked < 0) {
      throw new Error("Invalid HUD snapshot: risk values cannot be negative.");
    }

    if (snapshot.lastAction.trim().length === 0) {
      throw new Error("Invalid HUD snapshot: lastAction cannot be empty.");
    }
  }

  private row(content: string, width: number): string {
    const maxContentLength = width - 4;
    const visible = content.length > maxContentLength
      ? content.slice(0, maxContentLength - 1)
      : content;

    return `│ ${visible.padEnd(maxContentLength, " ")} │`;
  }

  private money(value: number): string {
    return value.toFixed(2);
  }

  private signedMoney(value: number): string {
    const prefix = value >= 0 ? "+" : "";
    return `${prefix}${value.toFixed(2)}`;
  }
}
