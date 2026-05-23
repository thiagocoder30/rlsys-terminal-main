import type {
  PaperRuntimeCommandIntent,
  PaperRuntimeSessionSupervisor,
  PaperRuntimeSupervisorInput,
  PaperRuntimeSupervisorResult,
} from "./PaperRuntimeSessionSupervisor.js";
import type {
  PaperRuntimeHudGateComposer,
  PaperRuntimeHudGateSnapshot,
} from "./PaperRuntimeHudGateComposer.js";

export interface PaperRuntimeReplContext
  extends Omit<PaperRuntimeSupervisorInput, "commandIntent"> {}

export interface PaperRuntimeReplCommandResult {
  readonly accepted: boolean;
  readonly commandText: string;
  readonly intent?: PaperRuntimeCommandIntent;
  readonly supervisorResult?: PaperRuntimeSupervisorResult;
  readonly hud?: PaperRuntimeHudGateSnapshot;
  readonly message: string;
}

/**
 * Adapts operator text commands into paper runtime supervised actions.
 *
 * This adapter is pure application wiring. It does not own stdin/stdout and can
 * be used by REPL, tests, tmux wrappers or future CLI interfaces.
 *
 * Complexity:
 * - O(1), fixed command dictionary.
 * - Memory O(1).
 */
export class PaperRuntimeReplCommandAdapter {
  private readonly commandMap: ReadonlyMap<string, PaperRuntimeCommandIntent>;

  public constructor(
    private readonly supervisor: PaperRuntimeSessionSupervisor,
    private readonly hudComposer: PaperRuntimeHudGateComposer,
  ) {
    this.commandMap = new Map<string, PaperRuntimeCommandIntent>([
      ["prepare", "PREPARE"],
      ["prep", "PREPARE"],
      ["start", "START"],
      ["pause", "PAUSE"],
      ["resume", "RESUME"],
      ["finish", "FINISH"],
      ["stop", "FINISH"],
      ["status", "STATUS"],
    ]);
  }

  public handle(
    commandText: string,
    context: PaperRuntimeReplContext,
  ): PaperRuntimeReplCommandResult {
    const normalized = commandText.trim().toLowerCase();

    if (normalized.length === 0) {
      return {
        accepted: false,
        commandText,
        message: "Empty paper runtime command.",
      };
    }

    const intent = this.commandMap.get(normalized);

    if (intent === undefined) {
      return {
        accepted: false,
        commandText,
        message: `Unknown paper runtime command: ${commandText}.`,
      };
    }

    const supervisorResult = this.supervisor.supervise({
      ...context,
      commandIntent: intent,
    });

    const hud = this.hudComposer.compose(supervisorResult, {
      compact: true,
    });

    return {
      accepted: true,
      commandText,
      intent,
      supervisorResult,
      hud,
      message: "Paper runtime command handled.",
    };
  }
}
