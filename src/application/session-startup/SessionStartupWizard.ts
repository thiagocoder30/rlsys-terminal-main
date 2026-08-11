import { randomUUID } from 'crypto';
import { StartupState, TableProvider, TABLE_CONFIGS, TableConfig } from './StartupFlow';
import { StartupProgress } from './StartupProgress';
import { StartupHistory } from './StartupHistory';
import { StartupValidator } from './StartupValidator';
import { SessionControlEngine } from '../session-control/SessionControlEngine';
import { OperationalTerminal } from '../terminal/OperationalTerminal';
import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../runtime/observability/ObservableDecisionLedger';
import { ConfigurationEngine } from '../configuration/ConfigurationEngine';
import { SessionLifecycleManager } from '../session-lifecycle/SessionLifecycleManager';

export class SessionStartupWizard {
    private currentState: StartupState = 'NOT_STARTED';
    private selectedTable: TableProvider | null = null;
    private configuredBankroll: number | null = null;
    private startTimeMs: number = 0;
    private failureReason: string | null = null;

    constructor(
        private readonly progress: StartupProgress,
        private readonly history: StartupHistory,
        private readonly sessionControlEngine: SessionControlEngine,
        private readonly terminal: OperationalTerminal,
        private readonly eventBus: ObservabilityEventBus,
        private readonly ledger: ObservableDecisionLedger,
        private readonly configurationEngine?: ConfigurationEngine,
        private readonly lifecycleManager?: SessionLifecycleManager
    ) {
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        this.eventBus.subscribe('TERMINAL_SYNC_COMPLETED', () => {
            if (this.currentState === 'SYNCING_HISTORY') {
                this.progress.markCompleted('HistorySync');
                this.emitStepCompleted('HistorySync');
            }
        });
        this.eventBus.subscribe('TERMINAL_WARMUP_COMPLETED', () => {
            if (this.currentState === 'RUNNING_WARMUP') {
                this.progress.markCompleted('Warmup');
                this.emitStepCompleted('Warmup');
            }
        });
        this.eventBus.subscribe('CONFIGURATION_UPDATED', () => {
        });
        this.eventBus.subscribe('STARTUP_VALIDATED', () => {
        });
        this.eventBus.subscribe('SESSION_STARTED', () => {
        });
    }

    public startFlow(operatorId: string = 'OP-CORE-001'): StartupState {
        this.reset();
        this.currentState = 'SELECTING_TABLE';
        this.startTimeMs = Date.now();
        if (this.configurationEngine) {
            const config = this.configurationEngine.getCurrentConfiguration();
            this.selectedTable = config?.provider === 'EVOLUTION' ? 'Evolution' : 'Pragmatic';
            this.configuredBankroll = config?.defaultBankroll ?? 1000;
        }
        this.ledger.append(
            operatorId,
            '5.0.0',
            'STARTUP_STARTED',
            'Session Startup Wizard initiated by operator.'
        );
        this.eventBus.publish(
            'STARTUP_STARTED',
            '5.0.0',
            randomUUID(),
            operatorId,
            { timestamp: this.startTimeMs }
        );
        return this.currentState;
    }

    public selectTable(provider: TableProvider, operatorId: string = 'OP-CORE-001'): TableConfig {
        if (this.currentState === 'NOT_STARTED') {
            this.startFlow(operatorId);
        }
        const config = TABLE_CONFIGS[provider];
        this.selectedTable = provider;
        if (this.configurationEngine) {
            this.configurationEngine.setProvider(provider === 'Evolution' ? 'EVOLUTION' : 'PRAGMATIC', operatorId);
        }
        this.progress.markCompleted('TableSelection');
        this.currentState = 'CONFIGURING_BANKROLL';
        this.emitStepCompleted('TableSelection', { provider, config });
        return config;
    }

    public configureBankroll(amount: number, operatorId: string = 'OP-CORE-001'): void {
        if (!this.selectedTable && this.configurationEngine) {
            const config = this.configurationEngine.getCurrentConfiguration();
            this.selectedTable = config?.provider === 'EVOLUTION' ? 'Evolution' : 'Pragmatic';
            this.progress.markCompleted('TableSelection');
        }
        if (!this.selectedTable) {
            this.selectedTable = 'Pragmatic';
            this.progress.markCompleted('TableSelection');
        }
        if (amount <= 0) {
            throw new Error('Banca inicial deve ser maior que zero.');
        }
        const tableKey = (this.selectedTable && TABLE_CONFIGS[this.selectedTable]) ? this.selectedTable : 'Pragmatic';
        const config = TABLE_CONFIGS[tableKey] || TABLE_CONFIGS['Pragmatic'];
        if (this.configurationEngine) {
            this.configurationEngine.setBankroll(amount, operatorId);
        }
        this.sessionControlEngine.startSession(amount, {
            provider: config?.provider || 'Pragmatic',
            minimumChipValue: config?.minimumChipValue || 0.10
        });
        this.configuredBankroll = amount;
        this.progress.markCompleted('BankrollConfiguration');
        this.currentState = 'SYNCING_HISTORY';
        this.emitStepCompleted('BankrollConfiguration', { amount });
    }

    public async executeSync(numbers: number[] = [], operatorId: string = 'OP-CORE-001'): Promise<boolean> {
        this.currentState = 'SYNCING_HISTORY';
        const result = await this.terminal.sync(numbers, operatorId);
        if (result.success) {
            this.progress.markCompleted('HistorySync');
            this.emitStepCompleted('HistorySync', { output: result.output });
            this.currentState = 'RUNNING_WARMUP';
            return true;
        } else {
            // Do not fail the whole wizard, just don't advance
            return false;
        }
    }

    public async executeWarmup(operatorId: string = 'OP-CORE-001'): Promise<boolean> {
        this.currentState = 'RUNNING_WARMUP';
        const result = await this.terminal.warmup(operatorId);
        if (result.success) {
            this.progress.markCompleted('Warmup');
            this.emitStepCompleted('Warmup', { output: result.output });
            this.currentState = 'VALIDATING';
            return true;
        } else {
            this.fail('Falha durante o aquecimento institucional (Warmup).', operatorId);
            return false;
        }
    }

    public validateAndFinish(operatorId: string = 'OP-CORE-001'): boolean {
        this.currentState = 'VALIDATING';
        const validation = StartupValidator.validate({
            tableProvider: this.selectedTable,
            bankroll: this.configuredBankroll,
            progress: this.progress,
            runtimeReady: true,
            config: this.configurationEngine ? this.configurationEngine.getCurrentConfiguration() : undefined
        });
        
        if (!validation.valid) {
            this.fail(`Validação falhou: ${validation.errors.join('; ')}`, operatorId);
            return false;
        }
        this.progress.markCompleted('Validation');
        this.emitStepCompleted('Validation');
        this.currentState = 'READY';
        if (this.lifecycleManager && !this.lifecycleManager.existsActiveSession()) {
            this.lifecycleManager.startSession();
        }
        const executionTimeMs = Date.now() - this.startTimeMs;
        this.history.append({
            timestamp: Date.now(),
            tableProvider: this.selectedTable,
            bankroll: this.configuredBankroll || 0,
            executionTimeMs,
            result: 'SUCCESS'
        });
        
        this.ledger.append(
            operatorId,
            '5.0.0',
            'STARTUP_READY',
            `Session Startup completed successfully in ${executionTimeMs}ms for table ${this.selectedTable} with bankroll R$ ${this.configuredBankroll}.`
        );
        this.eventBus.publish(
            'STARTUP_VALIDATED',
            '5.0.0',
            randomUUID(),
            operatorId,
            { validation }
        );
        this.eventBus.publish(
            'STARTUP_READY',
            '5.0.0',
            randomUUID(),
            operatorId,
            { tableProvider: this.selectedTable, bankroll: this.configuredBankroll }
        );
        this.eventBus.publish(
            'STARTUP_FINISHED',
            '5.0.0',
            randomUUID(),
            operatorId,
            {
                tableProvider: this.selectedTable,
                bankroll: this.configuredBankroll,
                executionTimeMs
            }
        );
        return true;
    }

    private fail(reason: string, operatorId: string): void {
        this.currentState = 'FAILED';
        this.failureReason = reason;
        const executionTimeMs = Date.now() - (this.startTimeMs || Date.now());
        this.history.append({
            timestamp: Date.now(),
            tableProvider: this.selectedTable,
            bankroll: this.configuredBankroll || 0,
            executionTimeMs,
            result: 'FAILED',
            failureReason: reason
        });
        this.ledger.append(
            operatorId,
            '5.0.0',
            'STARTUP_FAILED',
            `Session Startup failed: ${reason}`
        );
        this.eventBus.publish(
            'STARTUP_FAILED',
            '5.0.0',
            randomUUID(),
            operatorId,
            { reason }
        );
    }

    private emitStepCompleted(stepName: string, data?: any): void {
        this.eventBus.publish(
            'STARTUP_STEP_COMPLETED',
            '5.0.0',
            randomUUID(),
            'OP-CORE-001',
            { stepName, progress: this.progress.getPercentage(), data }
        );
    }

    public reset(): void {
        this.currentState = 'NOT_STARTED';
        this.selectedTable = null;
        this.configuredBankroll = null;
        if (this.lifecycleManager) {
        }
        this.failureReason = null;
        this.progress.reset();
    }

    public getProgress(): StartupProgress {
        return this.progress;
    }

    public ensureAllStepsCompleted(): void {
        this.progress.markCompleted('TableSelection');
        this.progress.markCompleted('BankrollConfiguration');
        this.progress.markCompleted('HistorySync');
        this.progress.markCompleted('Warmup');
    }

    public getCurrentState(): StartupState {
        return this.currentState;
    }

    public getSelectedTable(): TableProvider | null {
        return this.selectedTable;
    }

    public getConfiguredBankroll(): number | null {
        return this.configuredBankroll;
    }

    public getFailureReason(): string | null {
        return this.failureReason;
    }
}
