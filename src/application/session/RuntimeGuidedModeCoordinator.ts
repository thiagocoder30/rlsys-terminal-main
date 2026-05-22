import {
  GuidedOperationCommand,
  GuidedOperationMode,
  GuidedOperationResult,
  GuidedOperationState,
} from './GuidedOperationMode';

export type RuntimeGuidedInputType =
  | 'PROFILE_LOADED'
  | 'START'
  | 'WIN'
  | 'LOSS'
  | 'PAUSE'
  | 'RESUME'
  | 'REPORT'
  | 'FINISH'
  | 'RESET'
  | 'UNKNOWN';

export interface RuntimeGuidedModeInput {
  readonly type: RuntimeGuidedInputType;
}

export interface RuntimeGuidedModeResult {
  readonly state: GuidedOperationState;
  readonly accepted: boolean;
  readonly message: string;
  readonly nextAction: string;
  readonly runtimeEvent: string;
}

/**
 * Adapter between runtime commands and GuidedOperationMode workflow.
 *
 * This coordinator keeps RuntimeKernel/main.ts decoupled from the guided
 * workflow internals. It can be plugged into CLI, REPL, API, or tests without
 * changing the domain workflow.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class RuntimeGuidedModeCoordinator {
  public constructor(
    private readonly mode: GuidedOperationMode = new GuidedOperationMode(false),
  ) {}

  public current(): GuidedOperationState {
    return this.mode.current();
  }

  public handle(input: RuntimeGuidedModeInput): RuntimeGuidedModeResult {
    const command = this.toCommand(input.type);

    if (command === null) {
      return {
        state: this.mode.current(),
        accepted: false,
        message: 'Comando não reconhecido pelo fluxo guiado.',
        nextAction: 'Usar comandos válidos: setup, start, win, loss, pause, resume, report, finish.',
        runtimeEvent: 'GUIDED_UNKNOWN',
      };
    }

    const result = this.mode.handle(command);

    return {
      state: result.state,
      accepted: result.accepted,
      message: result.message,
      nextAction: result.nextAction,
      runtimeEvent: this.runtimeEvent(command, result),
    };
  }

  private toCommand(type: RuntimeGuidedInputType): GuidedOperationCommand | null {
    if (type === 'PROFILE_LOADED') return 'PROFILE_LOADED';
    if (type === 'START') return 'START_SESSION';
    if (type === 'WIN') return 'REGISTER_WIN';
    if (type === 'LOSS') return 'REGISTER_LOSS';
    if (type === 'PAUSE') return 'PAUSE_SESSION';
    if (type === 'RESUME') return 'RESUME_SESSION';
    if (type === 'REPORT') return 'GENERATE_REPORT';
    if (type === 'FINISH') return 'FINISH_SESSION';
    if (type === 'RESET') return 'RESET';

    return null;
  }

  private runtimeEvent(
    command: GuidedOperationCommand,
    result: GuidedOperationResult,
  ): string {
    if (!result.accepted) {
      return `GUIDED_REJECTED_${command}`;
    }

    return `GUIDED_ACCEPTED_${command}`;
  }
}
