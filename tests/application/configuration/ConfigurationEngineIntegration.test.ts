import { SessionLifecycleManager } from '../../../src/application/session-lifecycle/SessionLifecycleManager';
import { SessionLifecycleHistory } from '../../../src/application/session-lifecycle/SessionLifecycleHistory';
import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigurationEngine } from '../../../src/application/configuration/ConfigurationEngine';
import { ConfigurationHistory } from '../../../src/application/configuration/ConfigurationHistory';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../../../src/application/runtime/observability/ObservableDecisionLedger';
import { SessionStartupWizard } from '../../../src/application/session-startup/SessionStartupWizard';
import { StartupProgress } from '../../../src/application/session-startup/StartupProgress';
import { StartupHistory } from '../../../src/application/session-startup/StartupHistory';
import { SessionControlEngine } from '../../../src/application/session-control/SessionControlEngine';
import { SessionHistory } from '../../../src/application/session-control/SessionHistory';
import { TerminalHistory } from '../../../src/application/terminal/TerminalHistory';
import { CommandDispatcher } from '../../../src/application/terminal/CommandDispatcher';
import { OperationalTerminal } from '../../../src/application/terminal/OperationalTerminal';
import { CommandParser } from '../../../src/application/terminal/CommandParser';

describe('Sprint-048.1 - ConfigurationEngineIntegration', () => {
    let history: ConfigurationHistory;
    let eventBus: ObservabilityEventBus;
    let ledger: ObservableDecisionLedger;
    let engine: ConfigurationEngine;
    let eventsEmitted: string[];

    beforeEach(() => {
        history = new ConfigurationHistory();
        eventBus = new ObservabilityEventBus();
        ledger = new ObservableDecisionLedger();
        engine = new ConfigurationEngine(history, eventBus, ledger);
        eventsEmitted = [];

        eventBus.subscribe('CONFIGURATION_APPLIED', () => eventsEmitted.push('CONFIGURATION_APPLIED'));
        eventBus.subscribe('CONFIGURATION_PROVIDER_CHANGED', () => eventsEmitted.push('CONFIGURATION_PROVIDER_CHANGED'));
        eventBus.subscribe('CONFIGURATION_BANKROLL_CHANGED', () => eventsEmitted.push('CONFIGURATION_BANKROLL_CHANGED'));
        eventBus.subscribe('CONFIGURATION_THEME_CHANGED', () => eventsEmitted.push('CONFIGURATION_THEME_CHANGED'));
        eventBus.subscribe('CONFIGURATION_LANGUAGE_CHANGED', () => eventsEmitted.push('CONFIGURATION_LANGUAGE_CHANGED'));
    });

    it('deve aplicar configuração de provedor e ajustar ficha mínima (Pragmatic=0.10, Evolution=0.50)', () => {
        const pragmaticConfig = engine.setProvider('PRAGMATIC');
        expect(pragmaticConfig.provider).toBe('PRAGMATIC');
        expect(pragmaticConfig.minimumChipValue).toBe(0.10);

        const evolutionConfig = engine.setProvider('EVOLUTION');
        expect(evolutionConfig.provider).toBe('EVOLUTION');
        expect(evolutionConfig.minimumChipValue).toBe(0.50);
        expect(eventsEmitted).toContain('CONFIGURATION_PROVIDER_CHANGED');
        expect(eventsEmitted).toContain('CONFIGURATION_APPLIED');
    });

    it('deve permitir banca personalizada positiva e rejeitar valores negativos ou zero', () => {
        const customConfig = engine.setBankroll(1250);
        expect(customConfig.defaultBankroll).toBe(1250);
        expect(eventsEmitted).toContain('CONFIGURATION_BANKROLL_CHANGED');

        expect(() => engine.setBankroll(-500)).toThrow('Configuração inválida');
        expect(() => engine.setBankroll(0)).toThrow('Configuração inválida');
    });

    it('deve alterar tema e idioma emitindo eventos correspondentes', () => {
        engine.setTheme('LIGHT');
        expect(engine.getCurrentConfiguration().theme).toBe('LIGHT');
        expect(eventsEmitted).toContain('CONFIGURATION_THEME_CHANGED');

        engine.setLanguage('en-US');
        expect(engine.getCurrentConfiguration().language).toBe('en-US');
        expect(eventsEmitted).toContain('CONFIGURATION_LANGUAGE_CHANGED');
    });

    it('deve integrar com SessionStartupWizard carregando a configuração ativa', () => {
        engine.setProvider('EVOLUTION');
        engine.setBankroll(2500);

        const sessionHistory = new SessionHistory();
        const lm = new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger); const sessionControlEngine = new SessionControlEngine(eventBus, ledger, sessionHistory, lm); sessionControlEngine.lm = lm;
        const terminalHistory = new TerminalHistory();
        const dispatcher = new CommandDispatcher(sessionControlEngine, undefined, undefined, terminalHistory);
        const terminal = new OperationalTerminal(CommandParser, dispatcher, terminalHistory, eventBus, ledger);
        const wizard = new SessionStartupWizard(
            new StartupProgress(),
            new StartupHistory(),
            sessionControlEngine,
            terminal,
            eventBus,
            ledger,
            engine
        );

        wizard.startFlow();
        expect(wizard.getSelectedTable()).toBe('Evolution');
        expect(wizard.getConfiguredBankroll()).toBe(2500);
    });

    it('deve garantir que o SessionControlEngine respeite a ficha mínima nos stakes', () => {
        const sessionHistory = new SessionHistory();
        const lm = new SessionLifecycleManager(new SessionLifecycleHistory(), eventBus, ledger); const sessionControlEngine = new SessionControlEngine(eventBus, ledger, sessionHistory, lm); sessionControlEngine.lm = lm;
        sessionControlEngine.startSession(1000, { provider: 'Evolution', minimumChipValue: 0.50 }); sessionControlEngine.lm.createSession('test-id'); sessionControlEngine.lm.startSession();

        const recommendation = { suggestedStake: 3.20 };
        const adjusted = sessionControlEngine.handleRecommendationGenerated(recommendation);
        expect(adjusted.stake).toBe(3.50);
    });
});
