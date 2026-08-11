export interface DecisionTimelineEntry {
    readonly timestamp: string;
    readonly event: string;
    readonly description: string;
    readonly reference: string;
    readonly hash: string;
}

export interface DecisionExplanation {
    readonly chosenStrategy: string;
    readonly discardedStrategies: string[];
    readonly consensus: number;
    readonly confidence: number;
    readonly operationalVix: number;
    readonly entropy: number;
    readonly marketRegime: string;
    readonly dynamicWeight: number;
    readonly shadowPerformance: number;
    readonly feedbackStatus: string;
    readonly suggestedStake: number;
    readonly primaryReason: string;
    readonly favorableFactors: string[];
    readonly unfavorableFactors: string[];
    readonly institutionalConclusion: string;
}

export interface DecisionReplaySnapshot {
    readonly decisionId: string;
    readonly sessionId: string;
    readonly timestamp: string;
    readonly timeline: DecisionTimelineEntry[];
    readonly explanation: DecisionExplanation;
    readonly decisionHash: string;
    readonly hash: string;
}
