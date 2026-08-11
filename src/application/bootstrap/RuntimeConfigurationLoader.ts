import { ConfigurationEngine } from '../configuration/ConfigurationEngine';
import { SessionControlEngine } from '../session-control/SessionControlEngine';
import { SessionLifecycleManager } from '../session-lifecycle/SessionLifecycleManager';
import { SessionStartupWizard } from '../session-startup/SessionStartupWizard';
import { RuntimeConfigurationState } from './RuntimeConfigurationState';

export class RuntimeConfigurationLoader {
    public static loadState(
        configEngine: ConfigurationEngine,
        sessionControlEngine?: SessionControlEngine,
        startupWizard?: SessionStartupWizard,
        lifecycleManager?: SessionLifecycleManager
    ): RuntimeConfigurationState {
        const config = configEngine.getCurrentConfiguration();
        const sessionState = sessionControlEngine ? sessionControlEngine.getCurrentState() : null;
        
        const isSessionActive = lifecycleManager ? lifecycleManager.getCurrentState() === 'ACTIVE' : false;
        const wizardState = startupWizard ? startupWizard.getCurrentState() : null;
        const isWizardCompleted = wizardState === 'READY' || isSessionActive;

        const currentBankroll = sessionState && sessionState.bankroll
            ? sessionState.bankroll.current
            : config.defaultBankroll;

        const isConfigured = config.defaultBankroll > 0 && Boolean(config.provider);

        return new RuntimeConfigurationState({
            configured: isConfigured,
            provider: config.provider,
            minimumChipValue: config.minimumChipValue,
            initialBankroll: config.defaultBankroll,
            currentBankroll,
            theme: config.theme,
            language: config.language,
            hudMode: config.hudCompactMode ? 'COMPACT' : 'DEFAULT',
            terminalEnabled: config.terminalAutocomplete,
            startupCompleted: isWizardCompleted || isConfigured,
            updatedAt: Date.now()
        });
    }
}
