import { describe, it, expect } from 'vitest';
import { RuntimeConfigurationState } from '../../../src/application/bootstrap/RuntimeConfigurationState';

describe('RuntimeConfigurationState', () => {
    it('deve criar estado padrão', () => {
        const defaultState = RuntimeConfigurationState.createDefault();
        expect(defaultState.configured).toBe(false);
        expect(defaultState.provider).toBe('PRAGMATIC');
        expect(defaultState.minimumChipValue).toBe(0.10);
        expect(defaultState.initialBankroll).toBe(1000);
        expect(defaultState.currentBankroll).toBe(1000);
        expect(defaultState.theme).toBe('DARK');
        expect(defaultState.language).toBe('pt-BR');
    });

    it('deve exportar para JSON imutável', () => {
        const state = new RuntimeConfigurationState({
            configured: true,
            provider: 'EVOLUTION',
            minimumChipValue: 0.50,
            initialBankroll: 2500,
            currentBankroll: 2500,
            theme: 'LIGHT',
            language: 'en-US',
            hudMode: 'COMPACT',
            terminalEnabled: true,
            startupCompleted: true,
            updatedAt: Date.now()
        });

        const json = state.toJSON();
        expect(json.configured).toBe(true);
        expect(json.provider).toBe('EVOLUTION');
        expect(json.minimumChipValue).toBe(0.50);
        expect(json.initialBankroll).toBe(2500);
    });
});
