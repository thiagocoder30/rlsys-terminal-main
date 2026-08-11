import { ShadowEvaluationResult } from './ShadowDecisionEngine';

export interface ShadowSimulationRequest {
    readonly currentBankroll: number;
    readonly suggestedStake?: number;
    readonly stakePercentage?: number; // e.g. 2 for 2%
    readonly result: ShadowEvaluationResult;
    readonly netPayoutMultiplier?: number; // default 1.8 for typical roulette sector/even-odds net return multiplier
}

export interface ShadowSimulationResult {
    readonly stakeValue: number;
    readonly profitLoss: number;
    readonly newBankroll: number;
    readonly paperOnly: true;
    readonly productionMoneyAllowed: false;
}

export class ShadowTradeSimulator {
    public readonly paperOnly: true = true;
    public readonly productionMoneyAllowed: false = false;

    /**
     * Executes mathematical trade simulation without any live execution or real money connectivity.
     */
    public simulateTrade(request: ShadowSimulationRequest): ShadowSimulationResult {
        const bankroll = Math.max(0, request.currentBankroll);
        
        let stakeValue = 0;
        if (request.suggestedStake && request.suggestedStake > 0) {
            stakeValue = request.suggestedStake;
        } else {
            const pct = request.stakePercentage && request.stakePercentage > 0 ? request.stakePercentage : 2.0;
            stakeValue = Math.round((bankroll * (pct / 100)) * 100) / 100;
        }

        // Cap stake to current bankroll
        stakeValue = Math.min(bankroll, Math.max(0, stakeValue));

        let profitLoss = 0;
        const multiplier = request.netPayoutMultiplier && request.netPayoutMultiplier > 0 ? request.netPayoutMultiplier : 1.8;

        if (request.result === 'WIN') {
            profitLoss = Math.round((stakeValue * multiplier) * 100) / 100;
        } else if (request.result === 'LOSS') {
            profitLoss = -stakeValue;
        } else {
            // NO_TRADE or BLOCKED
            profitLoss = 0;
            stakeValue = 0;
        }

        const newBankroll = Math.max(0, Math.round((bankroll + profitLoss) * 100) / 100);

        return {
            stakeValue,
            profitLoss,
            newBankroll,
            paperOnly: true,
            productionMoneyAllowed: false
        };
    }
}
