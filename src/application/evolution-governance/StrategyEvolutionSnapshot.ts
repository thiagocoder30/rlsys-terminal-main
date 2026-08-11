import { StrategyEvolutionRecommendation } from './StrategyEvolutionRecommendation';

export interface StrategyEvolutionSnapshot {
    snapshotId: string;
    sessionId: string;
    timestamp: string;
    totalStrategies: number;
    promoted: number;
    watching: number;
    deprecated: number;
    retired: number;
    institutionalHealth: number;
    averageMaturity: number;
    portfolioCoverage: number;
    recommendations: StrategyEvolutionRecommendation[];
    hash: string;
}
