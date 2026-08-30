import type { CliCommandContext, CliCommandResult } from './CliCommandContext.js';

export interface CliCommand {
  readonly name: string;
  readonly description: string;

  execute(
    args: readonly string[],
    context: CliCommandContext,
  ): Promise<CliCommandResult>;
}
