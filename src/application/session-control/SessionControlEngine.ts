import { SessionStatus, TableConfiguration, TableProvider } from './SessionState';
import { SessionLifecycleManager } from '../session-lifecycle/SessionLifecycleManager';
import { BankrollManager } from './BankrollManager';
import { RiskLimitCalculator } from './RiskLimitCalculator';
import { StopLossManager } from './StopLossManager';
import { StopWinManager } from './StopWinManager';
import { SessionProgressCalculator } from './SessionProgressCalculator';
import { SessionAuditSnapshot } from './SessionAuditSnapshot';
import { SessionHistory } from './SessionHistory';
import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../runtime/observability/ObservableDecisionLedger';

export class SessionControlEngine {
    private bankrollManager: BankrollManager | null = null;
    private stopLossManager: StopLossManager | null = null;
    private stopWinManager: StopWinManager | null = null;
    
    private sessionId: string;
    private tableConfig: TableConfiguration | null = null;
    private startTime: string | null = null;
    
    private totalRounds = 0;
    private totalSuggestions = 0;
    private confirmedSuggestions = 0;
    private skippedSuggestions = 0;
    private wins = 0;
    private losses = 0;
    public lm?: any;

    constructor(
        private eventBus: ObservabilityEventBus,
        private ledger: ObservableDecisionLedger,
        private sessionHistory: SessionHistory,
        private lifecycleManager: SessionLifecycleManager
    ) {
        this.sessionId = 'SESSION-' + Date.now();
        this.setupEventHandlers();
    }

    private setupEventHandlers() {
        this.eventBus.subscribe('ROUND_PROCESSED', this.handleRoundProcessed.bind(this));
        this.eventBus.subscribe('SESSION_RUNTIME_CLEARED', this.handleRuntimeCleared.bind(this));
    }

    private handleRuntimeCleared() {
        this.bankrollManager = null;
        this.stopLossManager = null;
        this.stopWinManager = null;
        this.tableConfig = null;
        this.startTime = null;
        this.totalRounds = 0;
        this.totalSuggestions = 0;
        this.confirmedSuggestions = 0;
        this.skippedSuggestions = 0;
        this.wins = 0;
        this.losses = 0;
        this.sessionId = 'SESSION-' + Date.now();
    }

    private handleRoundProcessed() {
        if (this.lifecycleManager.getCurrentState() === 'ACTIVE') {
            this.totalRounds++;
        }
    }

    public startSession(initialBankroll: number, tableConfig: TableConfiguration): void {
        if (this.lifecycleManager.getCurrentState() === 'ACTIVE' && this.bankrollManager) return;
        
        this.bankrollManager = new BankrollManager(initialBankroll);
        const riskCalc = new RiskLimitCalculator();
        this.stopLossManager = new StopLossManager(riskCalc.calculateStopLossLimit(initialBankroll));
        this.stopWinManager = new StopWinManager(riskCalc.calculateStopWinLimit(initialBankroll));
        this.tableConfig = tableConfig;
        
        // this.lifecycleManager.getCurrentState() = 'ACTIVE';
        this.startTime = new Date().toISOString();

        const payload = {
            sessionId: this.sessionId,
            initialBankroll,
            tableConfig
        };
        
        this.eventBus.publish('SESSION_STARTED', '5.0.0', 'uuid', this.sessionId, payload);
        this.ledger.append(this.sessionId, '5.0.0', 'SESSION_STARTED', JSON.stringify(payload));
    }

    public getStatus(): string {
        return this.lifecycleManager.getCurrentState();
    }

    public handleRecommendationGenerated(recommendation: any): any {
        if (this.lifecycleManager.getCurrentState() !== 'ACTIVE') return null;
        this.totalSuggestions++;
        
        let stake = recommendation.suggestedStake || 5.0; 
        if (this.tableConfig) {
            stake = Math.max(stake, this.tableConfig.minimumChipValue);
            stake = Math.ceil(stake / this.tableConfig.minimumChipValue) * this.tableConfig.minimumChipValue;
        }

        return {
            ...recommendation,
            stake
        };
    }

    public confirmSuggestion(): void {
        if (this.lifecycleManager.getCurrentState() !== 'ACTIVE') return;
        this.confirmedSuggestions++;
    }

    public skipSuggestion(): void {
        if (this.lifecycleManager.getCurrentState() !== 'ACTIVE') return;
        this.skippedSuggestions++;
    }

    public reportShadowTradeResult(profit: number): void {
        if (!this.bankrollManager) {
            this.bankrollManager = new BankrollManager(1000);
            const riskCalc = new RiskLimitCalculator();
            this.stopLossManager = new StopLossManager(riskCalc.calculateStopLossLimit(1000));
            this.stopWinManager = new StopWinManager(riskCalc.calculateStopWinLimit(1000));
        }
        
        if (profit > 0) this.wins++;
        else if (profit < 0) this.losses++;

        this.bankrollManager.updateBankroll(profit);
        
        const payload = {
            sessionId: this.sessionId,
            currentBankroll: this.bankrollManager.currentBankroll,
            profitLoss: this.bankrollManager.profitLoss
        };
        this.eventBus.publish('BANKROLL_UPDATED', '5.0.0', 'uuid', this.sessionId, payload);
        this.ledger.append(this.sessionId, '5.0.0', 'BANKROLL_UPDATED', JSON.stringify(payload));

        this.checkLimits();
    }

    private checkLimits() {
        if (!this.bankrollManager || !this.stopLossManager || !this.stopWinManager) return;

        if (this.stopLossManager.check(this.bankrollManager)) {
            this.triggerStopLoss();
        } else if (this.stopWinManager.check(this.bankrollManager)) {
            this.triggerStopWin();
        }
    }

    private triggerStopLoss() {
        const payload = { sessionId: this.sessionId, currentBankroll: this.bankrollManager!.currentBankroll };
        this.eventBus.publish('STOP_LOSS_TRIGGERED', '5.0.0', 'uuid', this.sessionId, payload);
        this.ledger.append(this.sessionId, '5.0.0', 'STOP_LOSS_TRIGGERED', JSON.stringify(payload));
        this.lifecycleManager.finishSession('STOP_LOSS');
        this.finishSession('STOP_LOSS');
    }

    private triggerStopWin() {
        const payload = { sessionId: this.sessionId, currentBankroll: this.bankrollManager!.currentBankroll };
        this.eventBus.publish('STOP_WIN_TRIGGERED', '5.0.0', 'uuid', this.sessionId, payload);
        this.ledger.append(this.sessionId, '5.0.0', 'STOP_WIN_TRIGGERED', JSON.stringify(payload));
        this.lifecycleManager.finishSession('STOP_WIN');
        this.finishSession('STOP_WIN');
    }

    public finishSession(reason: string = 'MANUAL'): void {
        // removed
        
        const endTime = new Date().toISOString();
        
        if (this.bankrollManager && this.startTime) {
            const snapshot = new SessionAuditSnapshot({
                sessionId: this.sessionId,
                startTime: this.startTime,
                endTime,
                initialBankroll: this.bankrollManager.initialBankroll,
                finalBankroll: this.bankrollManager.currentBankroll,
                totalRounds: this.totalRounds,
                totalSuggestions: this.totalSuggestions,
                confirmedSuggestions: this.confirmedSuggestions,
                skippedSuggestions: this.skippedSuggestions,
                wins: this.wins,
                losses: this.losses,
                roi: this.bankrollManager.roi,
                stopReason: reason,
                strategyPerformance: {}
            });
            this.sessionHistory.append(snapshot);
        }

        
        // removed

        const payload = { sessionId: this.sessionId, reason };
        this.eventBus.publish('SESSION_FINISHED', '5.0.0', 'uuid', this.sessionId, payload);
        this.ledger.append(this.sessionId, '5.0.0', 'SESSION_FINISHED', JSON.stringify(payload));
    }

    public syncBankroll(newBankroll: number): void {
        if (newBankroll <= 0) return;
        if (!this.bankrollManager) {
            this.bankrollManager = new BankrollManager(newBankroll);
            const riskCalc = new RiskLimitCalculator();
            this.stopLossManager = new StopLossManager(riskCalc.calculateStopLossLimit(newBankroll));
            this.stopWinManager = new StopWinManager(riskCalc.calculateStopWinLimit(newBankroll));
        } else {
            const diff = newBankroll - this.bankrollManager.currentBankroll;
            if (diff !== 0) {
                this.bankrollManager.updateBankroll(diff);
            }
        }
    }

    public syncProvider(provider: string, minimumChipValue: number): void {
        const normalizedProvider: TableProvider = (provider.toUpperCase() === 'EVOLUTION' || provider === 'Evolution') ? 'Evolution' : 'Pragmatic';
        this.tableConfig = {
            provider: normalizedProvider,
            minimumChipValue
        };
    }

    public getTableConfig(): TableConfiguration | null {
        return this.tableConfig;
    }

    public getCurrentState() {
        let progress = { stopLossProgress: 0, stopWinProgress: 0 };
        if (this.bankrollManager && this.stopLossManager && this.stopWinManager) {
            progress = SessionProgressCalculator.calculateProgress(
                this.bankrollManager, this.stopLossManager, this.stopWinManager
            );
        }

        return {
            status: this.lifecycleManager.getCurrentState(),
            sessionId: this.sessionId,
            bankroll: this.bankrollManager ? {
                initial: this.bankrollManager.initialBankroll,
                current: this.bankrollManager.currentBankroll,
                profitLoss: this.bankrollManager.profitLoss,
                roi: this.bankrollManager.roi,
                stopLossLimit: this.stopLossManager?.getLimit() || 0,
                stopWinLimit: this.stopWinManager?.getLimit() || 0,
            } : null,
            progress,
            metrics: {
                totalRounds: this.totalRounds,
                totalSuggestions: this.totalSuggestions,
                confirmedSuggestions: this.confirmedSuggestions,
                skippedSuggestions: this.skippedSuggestions,
                wins: this.wins,
                losses: this.losses
            }
        };
    }
}
