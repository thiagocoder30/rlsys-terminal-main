import { describe, it, expect } from 'vitest';
import { StopWinManager } from '../../../src/application/session-control/StopWinManager';
import { BankrollManager } from '../../../src/application/session-control/BankrollManager';

describe('StopWinManager', () => {
    it('should trigger when current bankroll is greater than or equal to limit', () => {
        const bankroll = new BankrollManager(1000);
        const stopWin = new StopWinManager(1300);
        
        expect(stopWin.check(bankroll)).toBe(false);
        
        bankroll.updateBankroll(300); // bankroll now 1300
        expect(stopWin.check(bankroll)).toBe(true);
        
        bankroll.updateBankroll(10); // bankroll now 1310
        expect(stopWin.check(bankroll)).toBe(true);
    });
});
