import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigurationEngine } from '../src/application/configuration/ConfigurationEngine';
import { ObservabilityEventBus } from '../src/application/runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../src/application/runtime/observability/ObservableDecisionLedger';
import { ConfigurationHistory } from '../src/application/configuration/ConfigurationHistory';

describe('ConfigurationEngine', () => {
    let engine: ConfigurationEngine;
    
    beforeEach(() => {
        const bus = new ObservabilityEventBus();
        const ledger = new ObservableDecisionLedger();
        const history = new ConfigurationHistory();
        engine = new ConfigurationEngine(history, bus, ledger);
    });

    it('should be the single source of truth for provider', () => {
        engine.setProvider('EVOLUTION');
        expect(engine.getCurrentConfiguration().provider).toBe('EVOLUTION');
    });

    it('should be the single source of truth for bankroll', () => {
        engine.setBankroll(5000);
        expect(engine.getCurrentConfiguration().defaultBankroll).toBe(5000);
    });

    it('should be the single source of truth for theme and language', () => {
        engine.setTheme('LIGHT');
        engine.setLanguage('en-US');
        const conf = engine.getCurrentConfiguration();
        expect(conf.theme).toBe('LIGHT');
        expect(conf.language).toBe('en-US');
    });

    it('should not override state with stale data', () => {
        engine.applyConfiguration({ provider: 'PRAGMATIC' });
        expect(engine.getCurrentConfiguration().provider).toBe('PRAGMATIC');
        engine.applyConfiguration({ defaultBankroll: 100 });
        expect(engine.getCurrentConfiguration().defaultBankroll).toBe(100);
    });
});
