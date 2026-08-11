import { describe, it, expect } from 'vitest';
import { BankrollManager } from '../../../src/application/session-control/BankrollManager';

describe('BankrollManager', () => {
    it('should initialize correctly', () => {
        const manager = new BankrollManager(1000);
        expect(manager.initialBankroll).toBe(1000);
        expect(manager.currentBankroll).toBe(1000);
        expect(manager.profitLoss).toBe(0);
        expect(manager.roi).toBe(0);
        expect(manager.highestBalance).toBe(1000);
        expect(manager.lowestBalance).toBe(1000);
    });

    it('should update bankroll and track profit/loss correctly', () => {
        const manager = new BankrollManager(1000);
        manager.updateBankroll(100);
        expect(manager.currentBankroll).toBe(1100);
        expect(manager.profitLoss).toBe(100);
        expect(manager.roi).toBe(0.1);
        expect(manager.highestBalance).toBe(1100);
        
        manager.updateBankroll(-300);
        expect(manager.currentBankroll).toBe(800);
        expect(manager.profitLoss).toBe(-200);
        expect(manager.roi).toBe(-0.2);
        expect(manager.lowestBalance).toBe(800);
        expect(manager.highestBalance).toBe(1100);
    });

    it('should throw error on invalid initial bankroll', () => {
        expect(() => new BankrollManager(0)).toThrow('Initial bankroll must be greater than 0');
    });
});
