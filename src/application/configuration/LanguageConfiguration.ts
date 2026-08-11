export type LanguageCode = 'pt-BR' | 'en-US' | 'es-ES';

export interface LanguageConfig {
    language: LanguageCode;
}

export const DEFAULT_LANGUAGE_CONFIG: LanguageConfig = {
    language: 'pt-BR'
};
