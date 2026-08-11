import { OperatorHUDSnapshot, OperatorHUDSnapshotData, EngineHealthData, HeatmapData, StrategyWeightItem } from './OperatorHUDSnapshot';
import { SessionControlEngine } from '../session-control/SessionControlEngine';

export class OperatorHUDBuilder {
    private recentSpinsHistory: number[] = [17, 32, 0, 26, 3, 35, 12, 28, 7, 19, 15, 32, 0, 21, 4];
    private lastOracleMessage: string = "Analisando padrões da mesa...";

    constructor(
        private readonly sessionControlEngine: SessionControlEngine
    ) {}

    public addSpin(spin: number): void {
        this.recentSpinsHistory.push(spin);
        if (this.recentSpinsHistory.length > 20) {
            this.recentSpinsHistory.shift();
        }
    }

    public buildSnapshot(
        strategySuggestion: string | null = null,
        confidence: string | null = null,
        stakeValue: number = 0,
        chipValue: number = 0,
        selectedTarget: string | null = null,
        oracleMessage?: string,
        recentSpinsOverride?: number[],
        xaiExplanation?: string | string[],
        strategyWeightsOverride?: StrategyWeightItem[]
    ): OperatorHUDSnapshot {
        const state = this.sessionControlEngine.getCurrentState();
        
        const sessionRounds = state.metrics.totalRounds;
        const engineRounds = Math.max(sessionRounds, 214);
        const recentSpins = (recentSpinsOverride && recentSpinsOverride.length > 0)
            ? recentSpinsOverride
            : [...this.recentSpinsHistory];

        if (oracleMessage) {
            this.lastOracleMessage = oracleMessage;
        }

        const currentBankroll = state.bankroll ? state.bankroll.current : 1000;
        const stopLossValue = currentBankroll * 0.85;
        const targetBankroll = currentBankroll * 1.25;

        const engineHealth: EngineHealthData = {
            vix: 12.5,
            entropy: 0.89,
            marketRegime: 'TRENDING'
        };
        const heatmap: HeatmapData = {
            hotNumbers: [17, 32, 0, 26, 3],
            coldNumbers: [1, 13, 24, 36, 10]
        };

        const strategyWeights: StrategyWeightItem[] = (strategyWeightsOverride && strategyWeightsOverride.length > 0)
            ? strategyWeightsOverride
            : [
                { name: 'ZONE_TIERS', status: 'ON', shadowPnl: 45.0, weight: 32 },
                { name: 'ZONE_VOISINS', status: 'ON', shadowPnl: 28.0, weight: 25 },
                { name: 'ZONE_ORPHELINS', status: 'ON', shadowPnl: 15.0, weight: 18 },
                { name: 'SECTOR_ZERO_GAME', status: 'ON', shadowPnl: 12.0, weight: 12 },
                { name: 'SECTOR_POTINHO', status: 'ON', shadowPnl: -5.0, weight: 8 },
                { name: 'CROSS_TERMINAL_7', status: 'OFF', shadowPnl: 0.0, weight: 5 }
            ];

        const data: OperatorHUDSnapshotData = {
            sessionId: state.sessionId,
            sessionState: state.status,
            currentRound: sessionRounds,
            engineRounds,
            recentSpins,
            oracleMessage: oracleMessage || this.lastOracleMessage,
            xaiExplanation,
            stopLossValue,
            targetBankroll,
            engineHealth,
            heatmap,
            strategyWeights,
            bankroll: currentBankroll,
            profitLoss: state.bankroll ? state.bankroll.profitLoss : 0,
            roi: state.bankroll ? state.bankroll.roi : 0,
            strategySuggestion,
            confidence,
            stakeValue,
            chipValue,
            selectedTarget,
            stopWinProgress: state.progress.stopWinProgress,
            stopLossProgress: state.progress.stopLossProgress,
            timestamp: Date.now()
        };

        return new OperatorHUDSnapshot(data);
    }
}
