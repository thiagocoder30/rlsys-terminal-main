export enum OperatorCommandType {
    SYNC = 'SYNC',
    SPIN = 'SPIN',
    STATUS = 'STATUS',
    RESET = 'RESET',
    HELP = 'HELP',
    HISTORY = 'HISTORY',
    SNAPSHOT = 'SNAPSHOT',
    END_SESSION = 'END_SESSION',
    UNKNOWN = 'UNKNOWN'
}

export interface OperatorCommand {
    type: OperatorCommandType;
    payload: string;
    originalCommand: string;
}

export class OperatorCommandParser {
    public static parse(input: string): OperatorCommand {
        const trimmed = input.trim();
        const lower = trimmed.toLowerCase();
        const parts = trimmed.split(/\s+/);
        const commandStr = parts[0]?.toLowerCase() || '';
        
        let type = OperatorCommandType.UNKNOWN;
        
        if (commandStr === 'sync') type = OperatorCommandType.SYNC;
        else if (commandStr === 'spin') type = OperatorCommandType.SPIN;
        else if (commandStr === 'status') type = OperatorCommandType.STATUS;
        else if (commandStr === 'reset') type = OperatorCommandType.RESET;
        else if (commandStr === 'help') type = OperatorCommandType.HELP;
        else if (commandStr === 'history') type = OperatorCommandType.HISTORY;
        else if (commandStr === 'snapshot') type = OperatorCommandType.SNAPSHOT;
        else if (lower === 'end session' || lower === 'end' || lower === 'finish' || lower === 'exit') {
            type = OperatorCommandType.END_SESSION;
        }
        // Se for só número, interpretamos como SPIN
        else if (/^\d+$/.test(commandStr) && parseInt(commandStr) >= 0 && parseInt(commandStr) <= 36) {
            type = OperatorCommandType.SPIN;
            return {
                type,
                payload: commandStr,
                originalCommand: trimmed
            };
        }

        const payload = parts.slice(1).join(' ');

        return {
            type,
            payload,
            originalCommand: trimmed
        };
    }
}
