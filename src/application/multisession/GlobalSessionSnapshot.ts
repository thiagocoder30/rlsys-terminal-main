export interface GlobalSessionSnapshot {
    globalSessionId: string;
    timestamp: string;
    correlationIndex: number;
    stabilityIndex: number;
    recurringPatterns: string[];
    seasonalityScore: number;
    institutionalConfidence: number;
    hash: string;
}
