import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigurationEngine } from '../../../src/application/configuration/ConfigurationEngine';
import { ConfigurationHistory } from '../../../src/application/configuration/ConfigurationHistory';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../../../src/application/runtime/observability/ObservableDecisionLedger';

describe('ConfigurationEngine', () => {
    let history: ConfigurationHistory;
    let eventBus: ObservabilityEventBus;
    let ledger: ObservableDecisionLedger;
    let engine: ConfigurationEngine;

    beforeEach(() => {
        history = new ConfigurationHistory();
        eventBus = new ObservabilityEventBus();
        ledger = new ObservableDecisionLedger();
        engine = new ConfigurationEngine(history, eventBus, ledger);
    });

    it('deve inicializar com configuração padrão e registrar evento e snapshot', () => {
        const config = engine.getCurrentConfiguration();
        expect(config.provider).toBe('PRAGMATIC');
        expect(config.minimumChipValue).toBe(0.10);
        expect(config.defaultBankroll).toBe(1000);
        expect(config.theme).toBe('DARK');
        expect(config.language).toBe('pt-BR');
        expect(config.hash).toBeDefined();

        const snapshots = history.getSnapshots();
        expect(snapshots.length).toBe(1);
    });

    it('deve atualizar configuração e gerar novo snapshot imutável', () => {
        const updated = engine.updateConfiguration({
            provider: 'EVOLUTION',
            defaultBankroll: 5000,
            theme: 'LIGHT'
        });

        expect(updated.provider).toBe('EVOLUTION');
        expect(updated.minimumChipValue).toBe(0.50);
        expect(updated.defaultBankroll).toBe(5000);
        expect(updated.theme).toBe('LIGHT');

        const snapshots = history.getSnapshots();
        expect(snapshots.length).toBe(2);
    });

    it('deve rejeitar atualização com valores inválidos', () => {
        expect(() => {
            engine.updateConfiguration({
                defaultBankroll: -100
            });
        }).toThrow('Configuração inválida');
    });

    it('deve restaurar configuração anterior a partir do snapshot hash', () => {
        const initialHash = engine.getCurrentConfiguration().hash;

        engine.updateConfiguration({ theme: 'LIGHT' });
        expect(engine.getCurrentConfiguration().theme).toBe('LIGHT');

        const restored = engine.restoreConfiguration(initialHash);
        expect(restored.theme).toBe('DARK');
    });
});
