import type {
  AssistedSessionCommand,
  AssistedSessionResult,
} from "../session/RuntimeAssistedSessionWiring.js";
import type {
  RuntimeRecoveryBootResult,
} from "./RuntimeRecoveryBootCoordinator.js";
import type {
  RuntimeSessionCheckpointResult,
} from "./RuntimeSessionCheckpointEngine.js";

export interface EndToEndRecoveryBootPort {
  boot(): Promise<RuntimeRecoveryBootResult>;
}

export interface EndToEndAssistedHandlerPort {
  handle(command: AssistedSessionCommand): Promise<AssistedSessionResult>;
}

export interface EndToEndCheckpointPort {
  checkpoint(request: {
    readonly commandId?: string;
    readonly reason:
      | "COMMAND_PROCESSED"
      | "TIME_INTERVAL"
      | "MANUAL"
      | "SESSION_FINISH"
      | "RECOVERY_POINT";
    readonly occurredAtEpochMs: number;
    readonly force?: boolean;
  }): Promise<RuntimeSessionCheckpointResult>;
}

export interface EndToEndSessionCommandResult {
  readonly command: AssistedSessionCommand;
  readonly assistedResult: AssistedSessionResult;
  readonly checkpointResult: RuntimeSessionCheckpointResult;
}

export interface EndToEndSessionResult {
  readonly boot: RuntimeRecoveryBootResult;
  readonly commands: readonly EndToEndSessionCommandResult[];
  readonly finished: boolean;
  readonly finalReport?: string;
}

/**
 * Application-level orchestrator that validates a full assisted runtime session.
 *
 * It composes existing services but owns no domain rule:
 * recovery boot, assisted command handling and checkpointing remain isolated.
 *
 * Complexity:
 * - O(n), where n is the command count.
 * - Memory O(n) for the returned execution trace.
 */
export class EndToEndAssistedRuntimeSession {
  public constructor(
    private readonly recoveryBoot: EndToEndRecoveryBootPort,
    private readonly assistedHandler: EndToEndAssistedHandlerPort,
    private readonly checkpointEngine: EndToEndCheckpointPort,
  ) {}

  public async run(
    commands: readonly AssistedSessionCommand[],
  ): Promise<EndToEndSessionResult> {
    const boot = await this.recoveryBoot.boot();

    if (!boot.booted) {
      return {
        boot,
        commands: [],
        finished: false,
      };
    }

    const commandResults: EndToEndSessionCommandResult[] = [];
    let finished = false;
    let finalReport: string | undefined;

    for (const command of commands) {
      const assistedResult = await this.assistedHandler.handle(command);

      const checkpointResult = await this.checkpointEngine.checkpoint({
        commandId: command.id,
        reason: command.type === "FINISH" ? "SESSION_FINISH" : "COMMAND_PROCESSED",
        occurredAtEpochMs: command.occurredAtEpochMs,
        force: command.type === "FINISH",
      });

      commandResults.push({
        command,
        assistedResult,
        checkpointResult,
      });

      if (command.type === "FINISH" || command.type === "RESET") {
        finished = true;
        finalReport = assistedResult.report;
        break;
      }
    }

    return {
      boot,
      commands: commandResults,
      finished,
      finalReport,
    };
  }
}
