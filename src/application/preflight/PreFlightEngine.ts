import { PreFlightContext } from './PreFlightContext';
import { PreFlightPolicy } from './PreFlightPolicy';
import { PreFlightResult } from './PreFlightResult';
import { PreFlightReason } from './PreFlightReason';
import { OperationalReadiness } from './OperationalReadiness';
import { TableReadiness } from './TableReadiness';
import { StrategyEligibility } from './StrategyEligibility';

export class PreFlightEngine {
    constructor(private readonly policies: PreFlightPolicy[]) {}

    public evaluate(context: PreFlightContext): PreFlightResult {
        const reasons: PreFlightReason[] = [];
        
        for (const policy of this.policies) {
            const result = policy.evaluate(context);
            if (!result.passed && result.reason) {
                reasons.push(result.reason);
            }
        }

        const isReady = reasons.length === 0;
        
        const readiness: OperationalReadiness = {
            isReady,
            vixLevel: context.operationalVix,
            entropyLevel: context.shannonEntropy,
            burnInProgress: Math.min(100, (context.burnInCount / 36) * 100)
        };

        const tableReadiness: TableReadiness = {
            isStabilized: context.burnInCount >= 36,
            spinCount: context.burnInCount,
            lastPattern: 'N/A'
        };

        if (!isReady) {
            return {
                status: 'REJECTED',
                readiness,
                tableReadiness,
                rejection: {
                    reasons,
                    rejectionTimestamp: new Date().toISOString()
                }
            };
        }

        // Generate Eligibility
        const eligibleStrategies: StrategyEligibility[] = context.activeStrategies.map(strategyId => ({
            strategyId,
            status: 'ENABLED'
        }));

        // Approved Stake: 5% of Bankroll
        const approvedStake = context.currentBankroll * 0.05;

        return {
            status: 'APPROVED',
            readiness,
            tableReadiness,
            approval: {
                approvedStake,
                eligibleStrategies,
                confidence: context.adaptiveConfidence,
                approvalTimestamp: new Date().toISOString()
            }
        };
    }
}
