import type { CliCommand } from '../CliCommand.js';
import type {
  CliCommandContext,
  CliCommandResult,
} from '../CliCommandContext.js';

import type { CliCommandRouter } from '../CliCommandRouter.js';

export class HelpCommand implements CliCommand {

  public readonly name = 'help';

  public readonly description =
    'Lists available commands';


  public constructor(
    private readonly router: CliCommandRouter,
  ) {}


  public async execute(
    _args: readonly string[],
    _context: CliCommandContext,
  ): Promise<CliCommandResult> {

    const commands = this.router
      .list()
      .map(
        command =>
          `${command.name} - ${command.description}`,
      )
      .join('\n');


    return {
      success: true,
      output: [
        'RL.SYS COMMANDS',
        '===============',
        commands,
      ].join('\n'),
    };
  }
}
