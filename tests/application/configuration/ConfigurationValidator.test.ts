import { describe, it, expect } from 'vitest';
import { ConfigurationValidator } from '../../../src/application/configuration/ConfigurationValidator';

describe('ConfigurationValidator', () => {
    it('deve validar dados de configuração válidos', () => {
        const res = ConfigurationValidator.validate({
            provider: 'PRAGMATIC',
            theme: 'DARK',
            language: 'pt-BR',
            defaultBankroll: 1000,
            minimumChipValue: 0.10
        });

        expect(res.valid).toBe(true);
        expect(res.errors).toHaveLength(0);
    });

    it('deve detectar erros de validação em campos inválidos', () => {
        const res = ConfigurationValidator.validate({
            provider: 'INVALID' as any,
            theme: 'BLUE' as any,
            defaultBankroll: -500,
            minimumChipValue: 0
        });

        expect(res.valid).toBe(false);
        expect(res.errors.length).toBeGreaterThanOrEqual(4);
    });
});
