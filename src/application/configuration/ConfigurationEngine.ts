import { randomUUID } from 'crypto';
import { OperationalConfiguration, OperationalConfigurationData } from './OperationalConfiguration';
import { ProviderType } from './ProviderConfiguration';
import { ThemeMode } from './ThemeConfiguration';
import { LanguageCode } from './LanguageConfiguration';
import { ConfigurationValidator } from './ConfigurationValidator';
import { ConfigurationSnapshot } from './ConfigurationSnapshot';
import { ConfigurationHistory } from './ConfigurationHistory';
import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../runtime/observability/ObservableDecisionLedger';

export class ConfigurationEngine {
    private currentConfig: OperationalConfiguration;

    constructor(
        private readonly history: ConfigurationHistory,
        private readonly eventBus: ObservabilityEventBus,
        private readonly ledger: ObservableDecisionLedger
    ) {
        this.currentConfig = OperationalConfiguration.createDefault();
        const initialSnapshot = new ConfigurationSnapshot(this.currentConfig);
        this.history.append(initialSnapshot);

        this.eventBus.publish(
            'CONFIGURATION_LOADED',
            '5.0.0',
            randomUUID(),
            'OP-CORE-001',
            { hash: this.currentConfig.hash, version: this.currentConfig.version }
        );
    }

    public getCurrentConfiguration(): OperationalConfiguration {
        return this.currentConfig;
    }

    public updateConfiguration(
        updates: Partial<OperationalConfigurationData>,
        operatorId: string = 'OP-CORE-001'
    ): OperationalConfiguration {
        const validation = ConfigurationValidator.validate(updates);
        if (!validation.valid) {
            throw new Error(`Configuração inválida: ${validation.errors.join('; ')}`);
        }

        const prevConfig = this.currentConfig;
        const now = Date.now();
        const currentData: OperationalConfigurationData = {
            provider: updates.provider ?? prevConfig.provider,
            minimumChipValue: updates.minimumChipValue ?? (updates.provider === 'EVOLUTION' ? 0.50 : (updates.provider === 'PRAGMATIC' ? 0.10 : prevConfig.minimumChipValue)),
            defaultBankroll: updates.defaultBankroll ?? prevConfig.defaultBankroll,
            theme: updates.theme ?? prevConfig.theme,
            language: updates.language ?? prevConfig.language,
            autoWarmup: updates.autoWarmup ?? prevConfig.autoWarmup,
            autoSyncHistory: updates.autoSyncHistory ?? prevConfig.autoSyncHistory,
            defaultSyncRounds: updates.defaultSyncRounds ?? prevConfig.defaultSyncRounds,
            hudCompactMode: updates.hudCompactMode ?? prevConfig.hudCompactMode,
            terminalAutocomplete: updates.terminalAutocomplete ?? prevConfig.terminalAutocomplete,
            terminalHistorySize: updates.terminalHistorySize ?? prevConfig.terminalHistorySize,
            confirmSuggestions: updates.confirmSuggestions ?? prevConfig.confirmSuggestions,
            showAdvancedMetrics: updates.showAdvancedMetrics ?? prevConfig.showAdvancedMetrics,
            createdAt: prevConfig.createdAt,
            updatedAt: now,
            version: prevConfig.version
        };

        const newConfig = new OperationalConfiguration(currentData);
        this.currentConfig = newConfig;

        const snapshot = new ConfigurationSnapshot(newConfig);
        this.history.append(snapshot);

        this.ledger.append(
            operatorId,
            '5.0.0',
            'CONFIGURATION_UPDATED',
            `Operational Configuration updated. Hash: ${newConfig.hash}`
        );
        this.ledger.append(
            operatorId,
            '5.0.0',
            'CONFIGURATION_APPLIED',
            `Operational Configuration applied successfully. Hash: ${newConfig.hash}`
        );

        this.eventBus.publish(
            'CONFIGURATION_UPDATED',
            '5.0.0',
            randomUUID(),
            operatorId,
            { hash: newConfig.hash, updates }
        );
        this.eventBus.publish(
            'CONFIGURATION_APPLIED',
            '5.0.0',
            randomUUID(),
            operatorId,
            { hash: newConfig.hash, configuration: newConfig }
        );

        if (updates.provider && updates.provider !== prevConfig.provider) {
            this.eventBus.publish(
                'CONFIGURATION_PROVIDER_CHANGED',
                '5.0.0',
                randomUUID(),
                operatorId,
                { previous: prevConfig.provider, current: updates.provider, minimumChipValue: newConfig.minimumChipValue }
            );
        }

        if (updates.defaultBankroll !== undefined && updates.defaultBankroll !== prevConfig.defaultBankroll) {
            this.eventBus.publish(
                'CONFIGURATION_BANKROLL_CHANGED',
                '5.0.0',
                randomUUID(),
                operatorId,
                { previous: prevConfig.defaultBankroll, current: updates.defaultBankroll }
            );
        }

        if (updates.theme && updates.theme !== prevConfig.theme) {
            this.eventBus.publish(
                'CONFIGURATION_THEME_CHANGED',
                '5.0.0',
                randomUUID(),
                operatorId,
                { previous: prevConfig.theme, current: updates.theme }
            );
        }

        if (updates.language && updates.language !== prevConfig.language) {
            this.eventBus.publish(
                'CONFIGURATION_LANGUAGE_CHANGED',
                '5.0.0',
                randomUUID(),
                operatorId,
                { previous: prevConfig.language, current: updates.language }
            );
        }

        return this.currentConfig;
    }

    public applyConfiguration(
        updates: Partial<OperationalConfigurationData>,
        operatorId: string = 'OP-CORE-001'
    ): OperationalConfiguration {
        return this.updateConfiguration(updates, operatorId);
    }

    public setProvider(provider: ProviderType, operatorId: string = 'OP-CORE-001'): OperationalConfiguration {
        return this.updateConfiguration({ provider }, operatorId);
    }

    public setBankroll(bankroll: number, operatorId: string = 'OP-CORE-001'): OperationalConfiguration {
        return this.updateConfiguration({ defaultBankroll: bankroll }, operatorId);
    }

    public setTheme(theme: ThemeMode, operatorId: string = 'OP-CORE-001'): OperationalConfiguration {
        return this.updateConfiguration({ theme }, operatorId);
    }

    public setLanguage(language: LanguageCode, operatorId: string = 'OP-CORE-001'): OperationalConfiguration {
        return this.updateConfiguration({ language }, operatorId);
    }

    public restoreConfiguration(
        snapshotHash: string,
        operatorId: string = 'OP-CORE-001'
    ): OperationalConfiguration {
        const targetSnapshot = this.history.getByHash(snapshotHash);
        if (!targetSnapshot) {
            throw new Error(`Snapshot de configuração com hash ${snapshotHash} não encontrado.`);
        }

        this.currentConfig = targetSnapshot.configuration;

        this.ledger.append(
            operatorId,
            '5.0.0',
            'CONFIGURATION_RESTORED',
            `Operational Configuration restored to hash: ${targetSnapshot.configuration.hash}`
        );

        this.eventBus.publish(
            'CONFIGURATION_RESTORED',
            '5.0.0',
            randomUUID(),
            operatorId,
            { hash: targetSnapshot.configuration.hash }
        );

        return this.currentConfig;
    }
}
