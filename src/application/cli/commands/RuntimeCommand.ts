import type {
  CliCommand,
} from '../CliCommand.js';

import type {
  CliCommandContext,
  CliCommandResult,
} from '../CliCommandContext.js';


interface RuntimeStatusSnapshot {
  readonly sessionId: string;
  readonly startedAtEpochMs: number;
  readonly lifecycleState: string;
  readonly sequence: number;
}


interface RuntimeInspectionPort {
  getRuntimeStatus(): RuntimeStatusSnapshot;
}


export class RuntimeCommand
implements CliCommand {

  public readonly name =
    'runtime';


  public readonly description =
    'Runtime operational inspection';


  public async execute(
    args: readonly string[],
    context: CliCommandContext,
  ): Promise<CliCommandResult> {

    const kernel =
      context.kernel as
        RuntimeInspectionPort;


    const subcommand =
      args[0]
        ?.trim()
        .toLowerCase()
      ?? 'status';


    if (
      subcommand === 'status'
    ) {

      const status =
        kernel.getRuntimeStatus();


      return {
        success: true,
        output: [
          'RL.SYS RUNTIME STATUS',
          '=====================',
          `Session: ${status.sessionId}`,
          `State: ${status.lifecycleState}`,
          `Sequence: ${status.sequence}`,
          'Inspection: READ_ONLY',
        ].join('\n'),
      };

    }


    return {
      success: false,
      output:
        `unknown runtime command: ${subcommand}`,
    };

  }

}
