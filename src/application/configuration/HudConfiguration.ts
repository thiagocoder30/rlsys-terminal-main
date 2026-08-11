export interface HudConfig {
    compactMode: boolean;
    showBankroll: boolean;
    showStake: boolean;
    showStrategy: boolean;
    showProgress: boolean;
    showInstitutionalIndicators: boolean;
    visualDensity: 'COMFORTABLE' | 'COMPACT' | 'DENSE';
    collapsibleCards: boolean;
}

export const DEFAULT_HUD_CONFIG: HudConfig = {
    compactMode: false,
    showBankroll: true,
    showStake: true,
    showStrategy: true,
    showProgress: true,
    showInstitutionalIndicators: true,
    visualDensity: 'COMFORTABLE',
    collapsibleCards: true
};
