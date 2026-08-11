import { createHash } from 'crypto';

export interface EngineHealthData {
    vix: number;
    entropy: number;
    marketRegime: 'TRENDING' | 'CHAOTIC' | 'STABLE' | 'NEUTRAL';
}

export interface HeatmapData {
    hotNumbers: number[];
    coldNumbers: number[];
}

export interface StrategyWeightItem {
    name: string;
    status: 'ON' | 'OFF';
    shadowPnl: number;
    weight: number;
}

export interface OperatorHUDSnapshotData {
    sessionId: string;
    sessionState: string;
    currentRound: number;
    engineRounds?: number;
    recentSpins?: number[];
    oracleMessage?: string;
    xaiExplanation?: string | string[];
    targetBankroll?: number;
    stopLossValue?: number;
    engineHealth?: EngineHealthData;
    heatmap?: HeatmapData;
    strategyWeights?: StrategyWeightItem[];
    bankroll: number;
    profitLoss: number;
    roi: number;
    strategySuggestion: string | null;
    confidence: string | null;
    stakeValue: number;
    chipValue: number;
    selectedTarget: string | null;
    stopWinProgress: number;
    stopLossProgress: number;
    timestamp: number;
}

export class OperatorHUDSnapshot {
    public readonly data: Readonly<OperatorHUDSnapshotData>;
    public readonly hash: string;

    constructor(data: OperatorHUDSnapshotData) {
        this.data = Object.freeze({ ...data });
        this.hash = this.generateHash();
        Object.freeze(this);
    }

    private generateHash(): string {
        return createHash('sha256')
            .update(JSON.stringify(this.data))
            .digest('hex');
    }
}
