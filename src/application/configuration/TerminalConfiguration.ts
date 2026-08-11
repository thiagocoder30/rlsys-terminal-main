export interface TerminalConfig {
    autocomplete: boolean;
    historySize: number;
    favoriteCommands: string[];
    defaultSyncRounds: number;
    autoWarmup: boolean;
    shortcutsEnabled: boolean;
}

export const DEFAULT_TERMINAL_CONFIG: TerminalConfig = {
    autocomplete: true,
    historySize: 200,
    favoriteCommands: ['sync', 'status', 'audit', 'warmup', 'help', 'clear'],
    defaultSyncRounds: 200,
    autoWarmup: true,
    shortcutsEnabled: true
};
