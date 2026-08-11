import { TerminalCommand } from './TerminalCommand';

export class CommandParser {
    public static readonly VALID_COMMANDS = [
        'sync',
        'setbankroll',
        'status',
        'history',
        'audit',
        'warmup',
        'help',
        'clear'
    ] as const;

    public static parse(input: string): TerminalCommand {
        const trimmed = input.trim();
        if (!trimmed) {
            throw new Error("Comando vazio. Digite 'help' para listar os comandos disponíveis.");
        }

        const parts = trimmed.split(/\s+/);
        const commandName = parts[0].toLowerCase();
        const args = parts.slice(1);

        if (!this.VALID_COMMANDS.includes(commandName as any)) {
            throw new Error(`Comando desconhecido: '${commandName}'. Digite 'help' para listar os comandos disponíveis.`);
        }

        if (commandName === 'setbankroll') {
            if (args.length === 0 || isNaN(Number(args[0])) || Number(args[0]) < 0) {
                throw new Error("Sintaxe inválida para setbankroll. Uso: setbankroll <valor_positivo>");
            }
        }

        return {
            rawCommand: trimmed,
            commandName,
            args,
            timestamp: Date.now()
        };
    }
}
