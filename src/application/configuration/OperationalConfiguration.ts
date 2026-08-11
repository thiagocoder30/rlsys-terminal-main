import { createHash } from 'crypto';
import { ProviderType } from './ProviderConfiguration';
import { ThemeMode } from './ThemeConfiguration';
import { LanguageCode } from './LanguageConfiguration';

export interface OperationalConfigurationData {
    provider: ProviderType;
    minimumChipValue: number;
    defaultBankroll: number;
    theme: ThemeMode;
    language: LanguageCode;
    autoWarmup: boolean;
    autoSyncHistory: boolean;
    defaultSyncRounds: number;
    hudCompactMode: boolean;
    terminalAutocomplete: boolean;
    terminalHistorySize: number;
    confirmSuggestions: boolean;
    showAdvancedMetrics: boolean;
    createdAt: number;
    updatedAt: number;
    version: string;
}

export class OperationalConfiguration {
    public readonly provider: ProviderType;
    public readonly minimumChipValue: number;
    public readonly defaultBankroll: number;
    public readonly theme: ThemeMode;
    public readonly language: LanguageCode;
    public readonly autoWarmup: boolean;
    public readonly autoSyncHistory: boolean;
    public readonly defaultSyncRounds: number;
    public readonly hudCompactMode: boolean;
    public readonly terminalAutocomplete: boolean;
    public readonly terminalHistorySize: number;
    public readonly confirmSuggestions: boolean;
    public readonly showAdvancedMetrics: boolean;
    public readonly createdAt: number;
    public readonly updatedAt: number;
    public readonly version: string;
    public readonly hash: string;

    constructor(data: OperationalConfigurationData) {
        this.provider = data.provider;
        this.minimumChipValue = data.minimumChipValue;
        this.defaultBankroll = data.defaultBankroll;
        this.theme = data.theme;
        this.language = data.language;
        this.autoWarmup = data.autoWarmup;
        this.autoSyncHistory = data.autoSyncHistory;
        this.defaultSyncRounds = data.defaultSyncRounds;
        this.hudCompactMode = data.hudCompactMode;
        this.terminalAutocomplete = data.terminalAutocomplete;
        this.terminalHistorySize = data.terminalHistorySize;
        this.confirmSuggestions = data.confirmSuggestions;
        this.showAdvancedMetrics = data.showAdvancedMetrics;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
        this.version = data.version;

        this.hash = this.calculateHash();
        Object.freeze(this);
    }

    private calculateHash(): string {
        const payload = JSON.stringify({
            provider: this.provider,
            minimumChipValue: this.minimumChipValue,
            defaultBankroll: this.defaultBankroll,
            theme: this.theme,
            language: this.language,
            autoWarmup: this.autoWarmup,
            autoSyncHistory: this.autoSyncHistory,
            defaultSyncRounds: this.defaultSyncRounds,
            hudCompactMode: this.hudCompactMode,
            terminalAutocomplete: this.terminalAutocomplete,
            terminalHistorySize: this.terminalHistorySize,
            confirmSuggestions: this.confirmSuggestions,
            showAdvancedMetrics: this.showAdvancedMetrics,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            version: this.version
        });

        return createHash('sha256').update(payload).digest('hex');
    }

    public static createDefault(): OperationalConfiguration {
        const now = Date.now();
        return new OperationalConfiguration({
            provider: 'PRAGMATIC',
            minimumChipValue: 0.10,
            defaultBankroll: 1000,
            theme: 'DARK',
            language: 'pt-BR',
            autoWarmup: true,
            autoSyncHistory: true,
            defaultSyncRounds: 200,
            hudCompactMode: false,
            terminalAutocomplete: true,
            terminalHistorySize: 200,
            confirmSuggestions: true,
            showAdvancedMetrics: true,
            createdAt: now,
            updatedAt: now,
            version: '1.0.0'
        });
    }
}
