export type ThemeMode = 'LIGHT' | 'DARK' | 'SYSTEM';

export interface ThemeConfig {
    mode: ThemeMode;
}

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
    mode: 'DARK'
};
