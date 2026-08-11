import { MarketRegimeType } from './RegimeSnapshot';

export interface StrategyEligibilityRule {
    readonly regime: MarketRegimeType;
    readonly favoredFamilies: ReadonlyArray<string>;
    readonly neutralFamilies: ReadonlyArray<string>;
    readonly penalizedFamilies: ReadonlyArray<string>;
}

export class StrategyEligibilityMatrix {
    private readonly matrix: Record<MarketRegimeType, StrategyEligibilityRule> = {
        TRENDING: {
            regime: 'TRENDING',
            favoredFamilies: ['MARKOV_TREND', 'PERSISTENT_SECTOR', 'HOT_NUMBER_FOLLOW'],
            neutralFamilies: ['DOZEN_COLUMN_FLOW'],
            penalizedFamilies: ['MEAN_REVERSION_ZSCORE', 'ANTI_PERSISTENCE']
        },
        MEAN_REVERSION: {
            regime: 'MEAN_REVERSION',
            favoredFamilies: ['MEAN_REVERSION_ZSCORE', 'COLD_SLEEPER_RECOVERY', 'EQUILIBRIUM_SECTOR'],
            neutralFamilies: ['DOZEN_COLUMN_FLOW'],
            penalizedFamilies: ['MARKOV_TREND', 'PERSISTENT_SECTOR']
        },
        BALANCED: {
            regime: 'BALANCED',
            favoredFamilies: ['DOZEN_COLUMN_FLOW', 'MARKOV_STATISTICAL', 'ENTROPY_OPTIMIZED'],
            neutralFamilies: ['MEAN_REVERSION_ZSCORE', 'PERSISTENT_SECTOR'],
            penalizedFamilies: ['HIGH_LEVERAGE_RARE']
        },
        CHAOTIC: {
            regime: 'CHAOTIC',
            favoredFamilies: ['CAPITAL_PRESERVATION_HOLD', 'DEFENSIVE_SECTOR'],
            neutralFamilies: ['LOW_STAKE_BALANCED'],
            penalizedFamilies: ['MARKOV_TREND', 'MEAN_REVERSION_ZSCORE', 'HIGH_LEVERAGE_RARE']
        },
        LOW_INFORMATION: {
            regime: 'LOW_INFORMATION',
            favoredFamilies: ['CAPITAL_PRESERVATION_HOLD', 'WARMUP_OBSERVATION'],
            neutralFamilies: ['LOW_STAKE_BALANCED'],
            penalizedFamilies: ['MARKOV_TREND', 'MEAN_REVERSION_ZSCORE', 'HIGH_LEVERAGE_RARE']
        }
    };

    public getEligibleFamilies(regime: MarketRegimeType): ReadonlyArray<string> {
        return this.matrix[regime]?.favoredFamilies || ['CAPITAL_PRESERVATION_HOLD'];
    }

    public getRuleForRegime(regime: MarketRegimeType): StrategyEligibilityRule {
        return this.matrix[regime];
    }
}
