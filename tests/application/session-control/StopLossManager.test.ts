import { describe, it, expect } from 'vitest';
import { StopLossManager } from '../../../src/application/session-control/StopLossManager';
import { BankrollManager } from '../../../src/application/session-control/BankrollManager';

describe('StopLossManager', () => {
    it('should trigger when current bankroll is less than or equal to limit', () => {
        const bankroll = new BankrollManager(1000);
        const stopLoss = new StopLossManager(850);
        
        expect(stopLoss.check(bankroll)).toBe(false);
        
        bankroll.updateBankroll(-150); // bankroll now 850
        expect(stopLoss.check(bankroll)).toBe(true);
        
        bankroll.updateBankroll(-10); // bankroll now 840
        expect(stopLoss.check(bankroll)).toBe(true);
    });
});
