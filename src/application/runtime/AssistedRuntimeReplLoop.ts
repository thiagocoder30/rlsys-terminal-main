import type {
  AssistedSessionResult,
} from "../session/RuntimeAssistedSessionWiring.js";
import type {
  AssistedRuntimeCommandParseResult,
} from "./AssistedRuntimeCommandAdapter.js";

export interface AssistedRuntimeCommandParserPort {
  parse(input: string, occurredAtEpochMs?: number): AssistedRuntimeCommandParseResult;
}

export interface AssistedRuntimeHandlerPort {
  handle(command: NonNullable<AssistedRuntimeCommandParseResult["command"]>): Promise<AssistedSessionResult>;
}

export interface AssistedRuntimeReplOutputPort {
  writeLine(message: string): void;
}

export interface AssistedRuntimeReplStepResult {
  readonly accepted: boolean;
  readonly shouldContinue: boolean;
  readonly message: string;
  readonly assistedResult?: AssistedSessionResult;
}

/**
 * Stateless REPL step executor for assisted runtime operation.
 *
 * It intentionally processes one line at a time, making it easy to connect
 * to Node readline, tests, mobile shells or future streaming interfaces.
 *
 * Complexity:
 * - O(n) per input line due to parsing.
 * - O(1) orchestration overhead.
 */
export class AssistedRuntimeReplLoop {
  public constructor(
    private readonly parser: AssistedRuntimeCommandParserPort,
    private readonly handler: AssistedRuntimeHandlerPort,
    private readonly output: AssistedRuntimeReplOutputPort,
  ) {}

  public async step(input: string, occurredAtEpochMs: number = Date.now()): Promise<AssistedRuntimeReplStepResult> {
    const parsed = this.parser.parse(input, occurredAtEpochMs);

    if (!parsed.accepted || parsed.command === undefined) {
      this.output.writeLine(parsed.message);

      return {
        accepted: false,
        shouldContinue: true,
        message: parsed.message,
      };
    }

    const assistedResult = await this.handler.handle(parsed.command);

    this.output.writeLine(assistedResult.message);

    if (assistedResult.hud !== undefined) {
      this.output.writeLine(assistedResult.hud);
    }

    if (assistedResult.report !== undefined) {
      this.output.writeLine(assistedResult.report);
    }

    const shouldContinue = parsed.command.type !== "FINISH" && parsed.command.type !== "RESET";

    return {
      accepted: assistedResult.accepted,
      shouldContinue,
      message: assistedResult.message,
      assistedResult,
    };
  }
}
