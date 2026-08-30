import type { CliCommand } from './CliCommand.js';
import type {
  CliCommandContext,
  CliCommandResult,
} from './CliCommandContext.js';

export class CliCommandRouter {
  private readonly commands = new Map<string, CliCommand>();

  public register(command: CliCommand): void {
    this.commands.set(command.name.toLowerCase(), command);
  }

  public async execute(
    input: string,
    context: CliCommandContext,
  ): Promise<CliCommandResult> {
    const parts = input.trim().split(/\s+/);

    const commandName = parts.shift()?.toLowerCase();

    if (!commandName) {
      return {
        success: false,
        output: 'empty command',
      };
    }

    const command = this.commands.get(commandName);

    if (!command) {
      return {
        success: false,
        output: `unknown command: ${commandName}`,
      };
    }

    return command.execute(parts, context);
  }

  public list(): readonly CliCommand[] {
    return Array.from(this.commands.values());
  }
}
