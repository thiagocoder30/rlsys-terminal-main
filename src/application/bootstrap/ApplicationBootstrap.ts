import { randomUUID } from 'crypto';
import { ConfigurationEngine } from '../configuration/ConfigurationEngine';
import { SessionControlEngine } from '../session-control/SessionControlEngine';
import { SessionStartupWizard } from '../session-startup/SessionStartupWizard';
import { SessionLifecycleManager } from '../session-lifecycle/SessionLifecycleManager';
import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../runtime/observability/ObservableDecisionLedger';
import { RuntimeConfigurationState } from './RuntimeConfigurationState';
import { RuntimeConfigurationLoader } from './RuntimeConfigurationLoader';
import { BootstrapValidator, BootstrapDecision } from './BootstrapValidator';

export type BootstrapState =
    | 'INITIALIZING'
    | 'LOADING_CONFIGURATION'
    | 'VALIDATING'
    | 'READY_FOR_STARTUP'
    | 'READY_FOR_SESSION'
    | 'PROMPT_RESUME'
    | 'FAILED';

export class ApplicationBootstrap {
    private currentState: BootstrapState = 'INITIALIZING';
    private decision: BootstrapDecision = 'READY_FOR_STARTUP';
    private errors: string[] = [];

    constructor(
        private readonly configEngine: ConfigurationEngine,
        private readonly sessionControlEngine: SessionControlEngine,
        private readonly startupWizard: SessionStartupWizard,
        private readonly lifecycleManager: SessionLifecycleManager,
        private readonly eventBus: ObservabilityEventBus,
        private readonly ledger: ObservableDecisionLedger
    ) {}

    public bootstrap(operatorId: string = 'OP-CORE-001'): RuntimeConfigurationState {
        console.log("BOOTSTRAP_STARTED"); this.currentState = 'INITIALIZING';
        this.errors = [];

        this.eventBus.publish(
            'BOOTSTRAP_STARTED',
            '5.0.0',
            randomUUID(),
            operatorId,
            { timestamp: Date.now() }
        );

        this.currentState = 'LOADING_CONFIGURATION';
        const loadedState = RuntimeConfigurationLoader.loadState(
            this.configEngine,
            this.sessionControlEngine,
            this.startupWizard,
            this.lifecycleManager
        );

        this.eventBus.publish(
            'CONFIGURATION_LOADED',
            '5.0.0',
            randomUUID(),
            operatorId,
            { state: loadedState.toJSON() }
        );

        this.currentState = 'VALIDATING';
        const validation = BootstrapValidator.validate(loadedState, this.lifecycleManager.existsActiveSession());
        this.errors = validation.errors;
        this.decision = validation.decision;

        this.eventBus.publish(
            'CONFIGURATION_VALIDATED',
            '5.0.0',
            randomUUID(),
            operatorId,
            { valid: validation.valid, decision: validation.decision, errors: validation.errors }
        );

        if (!validation.valid) {
            this.currentState = 'FAILED';
            console.log("BOOTSTRAP_FINISHED"); return loadedState;
        }

        this.syncRuntimeInternal(loadedState, operatorId);
        this.currentState = this.decision;

        this.ledger.append(
            operatorId,
            '5.0.0',
            'BOOTSTRAP_COMPLETED',
            `Application bootstrap completed. Decision: ${this.decision}`
        );
        this.ledger.append(
            operatorId,
            '5.0.0',
            'RUNTIME_CONFIGURATION_APPLIED',
            `Runtime Configuration Applied: ${JSON.stringify(loadedState.toJSON())}`
        );

        console.log("BOOTSTRAP_FINISHED"); return loadedState;
    }

    public syncRuntime(operatorId: string = 'OP-CORE-001'): RuntimeConfigurationState {
        const loadedState = RuntimeConfigurationLoader.loadState(
            this.configEngine,
            this.sessionControlEngine,
            this.startupWizard,
            this.lifecycleManager
        );
        this.syncRuntimeInternal(loadedState, operatorId);
        console.log("BOOTSTRAP_FINISHED"); return loadedState;
    }

    private syncRuntimeInternal(state: RuntimeConfigurationState, operatorId: string): void {
        if (this.sessionControlEngine) {
            this.sessionControlEngine.syncBankroll(state.initialBankroll);
            this.sessionControlEngine.syncProvider(state.provider, state.minimumChipValue);
        }

        this.eventBus.publish(
            'BANKROLL_STATE_SYNCHRONIZED',
            '5.0.0',
            randomUUID(),
            operatorId,
            { bankroll: state.currentBankroll }
        );

        this.eventBus.publish(
            'PROVIDER_STATE_SYNCHRONIZED',
            '5.0.0',
            randomUUID(),
            operatorId,
            { provider: state.provider, minimumChipValue: state.minimumChipValue }
        );

        this.eventBus.publish(
            'RUNTIME_CONFIGURATION_READY',
            '5.0.0',
            randomUUID(),
            operatorId,
            { state: state.toJSON() }
        );
    }

    public getStatus(): { currentState: BootstrapState; decision: BootstrapDecision; state: RuntimeConfigurationState; errors: string[] } {
        const freshState = RuntimeConfigurationLoader.loadState(
            this.configEngine,
            this.sessionControlEngine,
            this.startupWizard,
            this.lifecycleManager
        );
        const validation = BootstrapValidator.validate(freshState, this.lifecycleManager.existsActiveSession());
        
        return {
            currentState: validation.valid ? validation.decision : 'FAILED',
            decision: validation.decision,
            state: freshState,
            errors: validation.errors
        };
    }

    public getCurrentState(): RuntimeConfigurationState {
        return RuntimeConfigurationLoader.loadState(
            this.configEngine,
            this.sessionControlEngine,
            this.startupWizard,
            this.lifecycleManager
        );
    }
}
