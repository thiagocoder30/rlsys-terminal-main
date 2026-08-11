import { RuntimeConfigurationState } from './RuntimeConfigurationState';

export type BootstrapDecision = 'READY_FOR_STARTUP' | 'READY_FOR_SESSION' | 'PROMPT_RESUME';

export interface BootstrapValidationResult {
    valid: boolean;
    decision: BootstrapDecision;
    errors: string[];
}

export class BootstrapValidator {
    public static validate(state: RuntimeConfigurationState, hasActiveSession: boolean): BootstrapValidationResult {
        const errors: string[] = [];

        if (state.initialBankroll <= 0) {
            errors.push('Banca inicial deve ser maior que zero');
        }

        const validProviders = ['PRAGMATIC', 'EVOLUTION', 'Pragmatic', 'Evolution'];
        if (!validProviders.includes(state.provider)) {
            errors.push(`Provedor inválido: ${state.provider}`);
        }

        if (state.minimumChipValue <= 0) {
            errors.push('Ficha mínima deve ser maior que zero');
        }

        const isValid = errors.length === 0;

        let decision: BootstrapDecision = 'READY_FOR_STARTUP';
        if (isValid && state.configured) {
            if (hasActiveSession) {
                decision = 'PROMPT_RESUME';
            } else {
                decision = 'READY_FOR_SESSION';
            }
        }

        return {
            valid: isValid,
            decision,
            errors
        };
    }
}
