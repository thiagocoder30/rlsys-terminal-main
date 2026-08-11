import { ProviderType } from './ProviderConfiguration';

export interface StartupConfig {
    defaultProvider: ProviderType;
    defaultBankroll: number;
    autoWarmup: boolean;
    autoSyncHistory: boolean;
    defaultSyncRounds: number;
    autoEnterHud: boolean;
}

export const DEFAULT_STARTUP_CONFIG: StartupConfig = {
    defaultProvider: 'PRAGMATIC',
    defaultBankroll: 1000,
    autoWarmup: true,
    autoSyncHistory: true,
    defaultSyncRounds: 200,
    autoEnterHud: true
};
