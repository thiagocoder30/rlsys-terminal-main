import { OperationalConfigurationData } from './OperationalConfiguration';

export interface ConfigurationValidationResult {
    valid: boolean;
    errors: string[];
}

export class ConfigurationValidator {
    public static validate(data: Partial<OperationalConfigurationData>): ConfigurationValidationResult {
        const errors: string[] = [];

        if (data.provider !== undefined && !['PRAGMATIC', 'EVOLUTION'].includes(data.provider)) {
            errors.push(`Provedor inválido: ${data.provider}. Valores permitidos: PRAGMATIC, EVOLUTION.`);
        }

        if (data.theme !== undefined && !['LIGHT', 'DARK', 'SYSTEM'].includes(data.theme)) {
            errors.push(`Tema inválido: ${data.theme}. Valores permitidos: LIGHT, DARK, SYSTEM.`);
        }

        if (data.language !== undefined && !['pt-BR', 'en-US', 'es-ES'].includes(data.language)) {
            errors.push(`Idioma inválido: ${data.language}. Valores permitidos: pt-BR, en-US, es-ES.`);
        }

        if (data.defaultBankroll !== undefined && (typeof data.defaultBankroll !== 'number' || data.defaultBankroll <= 0)) {
            errors.push('Banca padrão deve ser um número maior que zero.');
        }

        if (data.minimumChipValue !== undefined && (typeof data.minimumChipValue !== 'number' || data.minimumChipValue <= 0)) {
            errors.push('Valor mínimo da ficha deve ser maior que zero.');
        }

        if (data.defaultSyncRounds !== undefined && (data.defaultSyncRounds < 1 || data.defaultSyncRounds > 1000)) {
            errors.push('Quantidade padrão de giros para sincronização deve estar entre 1 e 1000.');
        }

        if (data.terminalHistorySize !== undefined && (data.terminalHistorySize < 1 || data.terminalHistorySize > 1000)) {
            errors.push('Tamanho do histórico do terminal deve estar entre 1 e 1000.');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}
