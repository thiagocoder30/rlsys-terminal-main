import type { CliCommand } from '../CliCommand.js';
import type {
  CliCommandContext,
  CliCommandResult,
} from '../CliCommandContext.js';


interface RuntimeKernelPort {
  handle(raw: string): Promise<{
    readonly lifecycleState: string;
    readonly output: string;
    readonly reason: string;
  }>;

  getSessionId(): string;
}


export class RuntimeCommand implements CliCommand {

  public readonly name = 'runtime';

  public readonly description =
    'Runtime operational commands';


  public async execute(
    args: readonly string[],
    context: CliCommandContext,
  ): Promise<CliCommandResult> {

    const kernel =
      context.kernel as RuntimeKernelPort;


    const subcommand =
      args[0]?.trim().toLowerCase() ?? 'status';


    if (subcommand === 'status') {

      const result =
        await kernel.handle('status');


      return {
        success: true,
        output: [
          'RL.SYS RUNTIME STATUS',
          '====================',
          `Session: ${kernel.getSessionId()}`,
          `State: ${result.lifecycleState}`,
          '',
          result.output,
          '',
          `Reason: ${result.reason}`,
        ].join('\n'),
      };

    }


    if (subcommand === 'health') {

      const result =
        await kernel.handle('status');


      return {
        success: true,
        output: [
          'RL.SYS RUNTIME HEALTH',
          '====================',
          'Health check delegated to RuntimeKernel',
          `State: ${result.lifecycleState}`,
          `Session: ${kernel.getSessionId()}`,
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
