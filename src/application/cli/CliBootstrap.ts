import { CliApplication } from './CliApplication.js';

import { HelpCommand } from './commands/HelpCommand.js';
import { StatusCommand } from './commands/StatusCommand.js';
import { RuntimeCommand } from './commands/RuntimeCommand.js';


export function createCliApplication(
  kernel: unknown,
): CliApplication {

  const cli =
    new CliApplication(kernel);


  cli.register(
    new StatusCommand(),
  );


  cli.register(
    new RuntimeCommand(),
  );


  cli.register(
    new HelpCommand(
      cli.getRouter(),
    ),
  );


  return cli;

}
