import { StrategyEligibility } from './StrategyEligibility';

export interface OperationalApproval {
    approvedStake: number;
    eligibleStrategies: StrategyEligibility[];
    confidence: number;
    approvalTimestamp: string;
}
