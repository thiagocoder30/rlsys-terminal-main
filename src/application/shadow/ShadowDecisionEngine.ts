export type ShadowEvaluationResult = 'WIN' | 'LOSS' | 'NO_TRADE' | 'BLOCKED';

export interface DecisionEvaluationInput {
    readonly isOpportunity?: boolean;
    readonly strategy?: string | null;
    readonly preFlightStatus?: 'APPROVED' | 'REJECTED' | string;
    readonly status?: 'RECOMMENDATION' | 'BLOCK' | 'HOLD' | string;
    readonly lockReason?: string | null;
    readonly confidence?: number;
    readonly consensus?: number;
}

export interface OutcomeEvaluationInput {
    readonly pnlDelta?: number;
    readonly isWin?: boolean;
    readonly winningNumber?: number;
    readonly targetNumbers?: number[];
}

export class ShadowDecisionEngine {
    /**
     * Evaluates an existing operational decision against an actual spin outcome.
     * Does NOT generate new decisions or modify original recommendations.
     */
    public evaluateDecision(
        decision: DecisionEvaluationInput,
        outcome: OutcomeEvaluationInput
    ): ShadowEvaluationResult {
        // Check for preflight rejection, explicit blocks, or active lock reasons
        if (
            decision.preFlightStatus === 'REJECTED' ||
            decision.status === 'BLOCK' ||
            Boolean(decision.lockReason)
        ) {
            return 'BLOCKED';
        }

        // Check if there was no trade opportunity or hold state
        if (
            decision.isOpportunity === false ||
            decision.status === 'HOLD' ||
            !decision.strategy ||
            decision.strategy === 'NONE'
        ) {
            return 'NO_TRADE';
        }

        // Evaluate outcome if explicit win flag or pnlDelta is provided
        if (outcome.isWin !== undefined) {
            return outcome.isWin ? 'WIN' : 'LOSS';
        }

        if (typeof outcome.pnlDelta === 'number' && outcome.pnlDelta !== 0) {
            return outcome.pnlDelta > 0 ? 'WIN' : 'LOSS';
        }

        // Evaluate winning number against target numbers if available
        if (typeof outcome.winningNumber === 'number' && Array.isArray(outcome.targetNumbers)) {
            const isTargetHit = outcome.targetNumbers.includes(outcome.winningNumber);
            return isTargetHit ? 'WIN' : 'LOSS';
        }

        return 'NO_TRADE';
    }
}
