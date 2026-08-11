import { StartupProgress } from './StartupProgress';
import { TableProvider } from './StartupFlow';

export interface ValidationContext {
    tableProvider: TableProvider | null;
    bankroll: number | null;
    progress: StartupProgress;
    runtimeReady: boolean;
    config?: any; // To check language, theme, etc.
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export class StartupValidator {
    public static validate(ctx: ValidationContext): ValidationResult {
        const errors: string[] = [];
        
        if (!ctx.tableProvider) {
            errors.push('Mesa operacional não selecionada (Provider não definido).');
        }
        
        if (ctx.bankroll === null || ctx.bankroll <= 0) {
            errors.push('Banca inicial não configurada ou inválida.');
        }

        if (!ctx.progress.isStepCompleted('TableSelection')) {
            errors.push('Etapa de seleção da mesa pendente.');
        }

        if (!ctx.progress.isStepCompleted('BankrollConfiguration')) {
            errors.push('Etapa de configuração de banca pendente.');
        }

        if (!ctx.progress.isStepCompleted('HistorySync')) {
            errors.push('Sincronização de histórico de giros pendente (Sync pendente).');
        }

        if (!ctx.progress.isStepCompleted('Warmup')) {
            errors.push('Aquecimento institucional (Warmup) pendente.');
        }

        if (!ctx.runtimeReady) {
            errors.push('Intelligence Runtime não está pronto (RuntimeConfigurationState inconsistente).');
        }

        if (ctx.config) {
            if (!ctx.config.language) {
                errors.push('Idioma vazio.');
            }
            if (!ctx.config.theme) {
                errors.push('Tema vazio.');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}