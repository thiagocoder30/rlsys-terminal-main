import { describe, it, expect } from 'vitest';
import { ShadowTradeSimulator } from '../../../src/application/shadow/ShadowTradeSimulator';

describe('ShadowTradeSimulator Unit Tests', () => {
    const simulator = new ShadowTradeSimulator();

    it('should calculate stake value correctly from percentage and update balance on WIN', () => {
        const result = simulator.simulateTrade({
            currentBankroll: 10000,
            stakePercentage: 2.0, // 2% of 10000 = 200
            result: 'WIN',
            netPayoutMultiplier: 1.8 // +360 net profit
        });

        expect(result.stakeValue).toBe(200);
        expect(result.profitLoss).toBe(360);
        expect(result.newBankroll).toBe(10360);
        expect(result.paperOnly).toBe(true);
        expect(result.productionMoneyAllowed).toBe(false);
    });

    it('should update balance on LOSS', () => {
        const result = simulator.simulateTrade({
            currentBankroll: 10000,
            stakePercentage: 2.0, // 200
            result: 'LOSS'
        });

        expect(result.stakeValue).toBe(200);
        expect(result.profitLoss).toBe(-200);
        expect(result.newBankroll).toBe(9800);
    });

    it('should result in zero profit/loss for NO_TRADE and BLOCKED', () => {
        const noTrade = simulator.simulateTrade({
            currentBankroll: 10000,
            stakePercentage: 2.0,
            result: 'NO_TRADE'
        });
        expect(noTrade.stakeValue).toBe(0);
        expect(noTrade.profitLoss).toBe(0);
        expect(noTrade.newBankroll).toBe(10000);

        const blocked = simulator.simulateTrade({
            currentBankroll: 10000,
            stakePercentage: 2.0,
            result: 'BLOCKED'
        });
        expect(blocked.stakeValue).toBe(0);
        expect(blocked.profitLoss).toBe(0);
        expect(blocked.newBankroll).toBe(10000);
    });

    it('should strictly guarantee Paper Only properties', () => {
        expect(simulator.paperOnly).toBe(true);
        expect(simulator.productionMoneyAllowed).toBe(false);
    });
});
