export interface PreFlightContext {
    operationalVix: number;
    shannonEntropy: number;
    adaptiveConfidence: number;
    shadowPerformance: number;
    consensusRate: number;
    sessionStatus: string;
    burnInCount: number;
    isInCooldown: boolean;
    currentBankroll: number;
    drawdown: number;
    activeStrategies: string[];
}
