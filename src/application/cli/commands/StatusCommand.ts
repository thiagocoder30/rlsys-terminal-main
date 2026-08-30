import type { CliCommand } from '../CliCommand.js';
import type {
  CliCommandContext,
  CliCommandResult,
} from '../CliCommandContext.js';

export class StatusCommand implements CliCommand {

  public readonly name = 'status';

  public readonly description =
    'Shows runtime operational status';


  public async execute(
    _args: readonly string[],
    context: CliCommandContext,
  ): Promise<CliCommandResult> {

    return {
      success: true,
      output: [
        'RL.SYS STATUS',
        '==============',
        'Runtime: ONLINE',
        `Started: ${context.startedAtEpochMs}`,
        'Operator Mode: SUPERVISED',
      ].join('\n'),
    };
  }
}
