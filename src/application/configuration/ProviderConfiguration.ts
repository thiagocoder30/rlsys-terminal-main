export type ProviderType = 'PRAGMATIC' | 'EVOLUTION';

export interface ProviderConfig {
    provider: ProviderType;
    minimumChipValue: number;
}

export const DEFAULT_PROVIDER_CONFIGS: Record<ProviderType, ProviderConfig> = {
    PRAGMATIC: {
        provider: 'PRAGMATIC',
        minimumChipValue: 0.10
    },
    EVOLUTION: {
        provider: 'EVOLUTION',
        minimumChipValue: 0.50
    }
};
