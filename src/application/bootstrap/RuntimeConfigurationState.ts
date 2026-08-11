export interface RuntimeConfigurationStateData {
    configured: boolean;
    provider: string;
    minimumChipValue: number;
    initialBankroll: number;
    currentBankroll: number;
    theme: string;
    language: string;
    hudMode: string;
    terminalEnabled: boolean;
    startupCompleted: boolean;
    updatedAt: number;
}

export class RuntimeConfigurationState {
    public readonly configured: boolean;
    public readonly provider: string;
    public readonly minimumChipValue: number;
    public readonly initialBankroll: number;
    public readonly currentBankroll: number;
    public readonly theme: string;
    public readonly language: string;
    public readonly hudMode: string;
    public readonly terminalEnabled: boolean;
    public readonly startupCompleted: boolean;
    public readonly updatedAt: number;

    constructor(data: RuntimeConfigurationStateData) {
        this.configured = data.configured;
        this.provider = data.provider;
        this.minimumChipValue = data.minimumChipValue;
        this.initialBankroll = data.initialBankroll;
        this.currentBankroll = data.currentBankroll;
        this.theme = data.theme;
        this.language = data.language;
        this.hudMode = data.hudMode;
        this.terminalEnabled = data.terminalEnabled;
        this.startupCompleted = data.startupCompleted;
        this.updatedAt = data.updatedAt;

        Object.freeze(this);
    }

    public static createDefault(): RuntimeConfigurationState {
        return new RuntimeConfigurationState({
            configured: false,
            provider: 'PRAGMATIC',
            minimumChipValue: 0.10,
            initialBankroll: 1000,
            currentBankroll: 1000,
            theme: 'DARK',
            language: 'pt-BR',
            hudMode: 'DEFAULT',
            terminalEnabled: true,
            startupCompleted: false,
            updatedAt: Date.now()
        });
    }

    public toJSON(): RuntimeConfigurationStateData {
        return {
            configured: this.configured,
            provider: this.provider,
            minimumChipValue: this.minimumChipValue,
            initialBankroll: this.initialBankroll,
            currentBankroll: this.currentBankroll,
            theme: this.theme,
            language: this.language,
            hudMode: this.hudMode,
            terminalEnabled: this.terminalEnabled,
            startupCompleted: this.startupCompleted,
            updatedAt: this.updatedAt
        };
    }
}
