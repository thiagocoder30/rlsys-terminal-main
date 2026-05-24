import type {
  PaperRuntimeReplCommandAdapter,
} from "./PaperRuntimeReplCommandAdapter.js";

export type InteractiveLoopSessionState =
  | "IDLE"
  | "READY"
  | "RUNNING"
  | "PAUSED"
  | "FINISHED";

export interface PaperRuntimeInteractiveLoopState {
  readonly sessionState: InteractiveLoopSessionState;
  readonly lastCommand?: string;
  readonly iteration: number;
}

export interface PaperRuntimeInteractiveLoopResult {
  readonly state: PaperRuntimeInteractiveLoopState;
  readonly output: string;
  readonly accepted: boolean;
}

/**
 * Stateful supervised paper runtime loop.
 *
 * Complexity:
 * - O(1) per command.
 * - Memory O(1).
 */
export class PaperRuntimeInteractiveLoop {
  private state: PaperRuntimeInteractiveLoopState = {
    sessionState: "IDLE",
    iteration: 0,
  };

  public constructor(
    private readonly adapter: PaperRuntimeReplCommandAdapter,
  ) {}

  public currentState(): PaperRuntimeInteractiveLoopState {
    return this.state;
  }

  public handle(command: string): PaperRuntimeInteractiveLoopResult {
    const result = this.adapter.handle(command, {
      enduranceStatus: "CERTIFIED",
      riskReadiness: "READY",
      operatorMode: "SUPERVISED",
      sessionState: this.state.sessionState,
    });

    const nextSessionState = result.supervisorResult?.nextSessionState ?? this.state.sessionState;

    this.state = {
      sessionState: nextSessionState,
      lastCommand: command,
      iteration: this.state.iteration + 1,
    };

    return {
      state: this.state,
      output: result.hud?.text ?? result.message,
      accepted: result.accepted,
    };
  }
}
