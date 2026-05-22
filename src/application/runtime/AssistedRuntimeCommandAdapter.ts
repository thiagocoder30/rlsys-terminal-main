import type {
  AssistedSessionCommand,
  AssistedSessionCommandType,
} from "../session/RuntimeAssistedSessionWiring.js";

export type AssistedRuntimeCommandParseStatus =
  | "PARSED"
  | "EMPTY_INPUT"
  | "UNKNOWN_COMMAND"
  | "INVALID_AMOUNT";

export interface AssistedRuntimeCommandParseResult {
  readonly status: AssistedRuntimeCommandParseStatus;
  readonly accepted: boolean;
  readonly message: string;
  readonly command?: AssistedSessionCommand;
}

const COMMAND_MAP: ReadonlyMap<string, AssistedSessionCommandType> = new Map([
  ["start", "START"],
  ["win", "WIN"],
  ["loss", "LOSS"],
  ["pause", "PAUSE"],
  ["resume", "RESUME"],
  ["report", "REPORT"],
  ["finish", "FINISH"],
  ["reset", "RESET"],
]);

/**
 * Converts human REPL input into strict assisted runtime commands.
 *
 * It is intentionally stateless and idempotent-friendly: command ids are
 * derived from normalized input plus timestamp provided by the caller.
 *
 * Complexity:
 * - parse: O(n), where n is input length.
 * - memory: O(1) besides normalized token array.
 */
export class AssistedRuntimeCommandAdapter {
  public parse(input: string, occurredAtEpochMs: number = Date.now()): AssistedRuntimeCommandParseResult {
    const normalized = input.trim().toLowerCase();

    if (normalized.length === 0) {
      return {
        status: "EMPTY_INPUT",
        accepted: false,
        message: "Empty command ignored.",
      };
    }

    const tokens = normalized.split(/\s+/);
    const commandName = tokens[0] ?? "";
    const commandType = COMMAND_MAP.get(commandName);

    if (commandType === undefined) {
      return {
        status: "UNKNOWN_COMMAND",
        accepted: false,
        message: `Unknown assisted runtime command: ${commandName}.`,
      };
    }

    const amount = this.parseAmountIfRequired(commandType, tokens);

    if (amount.status === "INVALID_AMOUNT") {
      return {
        status: "INVALID_AMOUNT",
        accepted: false,
        message: amount.message,
      };
    }

    return {
      status: "PARSED",
      accepted: true,
      message: "Command parsed successfully.",
      command: {
        id: this.createCommandId(normalized, occurredAtEpochMs),
        type: commandType,
        amount: amount.value,
        occurredAtEpochMs,
      },
    };
  }

  private parseAmountIfRequired(
    commandType: AssistedSessionCommandType,
    tokens: readonly string[],
  ): { readonly status: "OK"; readonly value?: number } | { readonly status: "INVALID_AMOUNT"; readonly message: string } {
    if (commandType !== "WIN" && commandType !== "LOSS") {
      return { status: "OK" };
    }

    const rawAmount = tokens[1];

    if (rawAmount === undefined) {
      return {
        status: "INVALID_AMOUNT",
        message: `${commandType} requires a positive amount.`,
      };
    }

    const value = Number(rawAmount.replace(",", "."));

    if (!Number.isFinite(value) || value <= 0) {
      return {
        status: "INVALID_AMOUNT",
        message: `${commandType} amount must be a positive finite number.`,
      };
    }

    return { status: "OK", value };
  }

  private createCommandId(normalizedInput: string, occurredAtEpochMs: number): string {
    return `assisted-${occurredAtEpochMs}-${this.hash(normalizedInput)}`;
  }

  private hash(value: string): string {
    let hash = 2166136261;

    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0).toString(16);
  }
}
