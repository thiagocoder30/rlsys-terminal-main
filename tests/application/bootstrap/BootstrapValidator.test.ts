import { describe, it, expect } from 'vitest';
import { BootstrapValidator } from '../../../src/application/bootstrap/BootstrapValidator';
import { RuntimeConfigurationState } from '../../../src/application/bootstrap/RuntimeConfigurationState';

describe('BootstrapValidator', () => {
    it('deve retornar READY_FOR_SESSION se a configuração for válida e configurada', () => {
        const state = new RuntimeConfigurationState({
            configured: true,
            provider: 'EVOLUTION',
            minimumChipValue: 0.50,
            initialBankroll: 2500,
            currentBankroll: 2500,
            theme: 'DARK',
            language: 'pt-BR',
            hudMode: 'DEFAULT',
            terminalEnabled: true,
            startupCompleted: true,
            updatedAt: Date.now()
        });

        const result = BootstrapValidator.validate(state, false);
        expect(result.valid).toBe(true);
        expect(result.decision).toBe('READY_FOR_SESSION');
        expect(result.errors.length).toBe(0);
    });

    it('deve retornar READY_FOR_STARTUP se configured = false', () => {
        const state = RuntimeConfigurationState.createDefault();
        const result = BootstrapValidator.validate(state, false);
        expect(result.decision).toBe('READY_FOR_STARTUP');
    });

    it('deve retornar erro se banca inicial for menor ou igual a zero', () => {
        const state = new RuntimeConfigurationState({
            configured: true,
            provider: 'EVOLUTION',
            minimumChipValue: 0.50,
            initialBankroll: 0,
            currentBankroll: 0,
            theme: 'DARK',
            language: 'pt-BR',
            hudMode: 'DEFAULT',
            terminalEnabled: true,
            startupCompleted: true,
            updatedAt: Date.now()
        });

        const result = BootstrapValidator.validate(state, false);
        expect(result.valid).toBe(false);
        expect(result.decision).toBe('READY_FOR_STARTUP');
        expect(result.errors).toContain('Banca inicial deve ser maior que zero');
    });
});
