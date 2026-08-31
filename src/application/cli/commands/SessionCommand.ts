import type { CliCommand } from '../CliCommand.js';
import type {
  CliCommandContext,
  CliCommandResult,
} from '../CliCommandContext.js';


interface RuntimeSessionPort {
  getSessionId(): string;
}


export class SessionCommand implements CliCommand {

  public readonly name = 'session';

  public readonly description =
    'Shows supervised operator session information';


  public async execute(
    args: readonly string[],
    context: CliCommandContext,
  ): Promise<CliCommandResult> {

    const kernel =
      context.kernel as RuntimeSessionPort;


    const subcommand =
      args[0]?.trim().toLowerCase() ?? 'status';


    if (subcommand === 'status') {

      return {
        success: true,
        output: [
          'RL.SYS OPERATOR SESSION',
          '=======================',
          `Session: ${kernel.getSessionId()}`,
          `CLI Started: ${context.startedAtEpochMs}`,
          'Mode: SUPERVISED',
          'Execution: MANUAL OPERATOR ONLY',
          'Automatic Entry: DISABLED',
        ].join('\n'),
      };

    }


    return {
      success: false,
      output:
        `unknown session command: ${subcommand}`,
    };

  }

}
