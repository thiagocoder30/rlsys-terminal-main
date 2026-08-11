import { describe, it, expect } from 'vitest';
import { ShadowPortfolio } from '../../../src/application/shadow/ShadowPortfolio';

describe('ShadowPortfolio Unit Tests', () => {
    it('should initialize portfolio with default bankroll and zero metrics', () => {
        const portfolio = new ShadowPortfolio(10000);
        expect(portfolio.getInitialBankroll()).toBe(10000);
        expect(portfolio.getCurrentBankroll()).toBe(10000);
        expect(portfolio.getTotalTrades()).toBe(0);
        expect(portfolio.getRoi()).toBe(0);
        expect(portfolio.getDrawdown()).toBe(0);
        expect(portfolio.getMaxLossSequence()).toBe(0);
    });

    it('should update bankroll, win rate, and ROI accurately on winning trades', () => {
        const portfolio = new ShadowPortfolio(10000);
        portfolio.recordTrade(500, true);

        expect(portfolio.getCurrentBankroll()).toBe(10500);
        expect(portfolio.getTotalTrades()).toBe(1);
        expect(portfolio.getWins()).toBe(1);
        expect(portfolio.getWinRate()).toBe(100);
        expect(portfolio.getRoi()).toBe(5); // +5%
        expect(portfolio.getDrawdown()).toBe(0);
    });

    it('should track drawdown and loss sequence accurately', () => {
        const portfolio = new ShadowPortfolio(10000);
        // Win to reach peak 11000
        portfolio.recordTrade(1000, true);
        expect(portfolio.getCurrentBankroll()).toBe(11000);

        // Consecutive losses
        portfolio.recordTrade(-500, false);
        portfolio.recordTrade(-500, false);

        expect(portfolio.getCurrentBankroll()).toBe(10000);
        expect(portfolio.getWins()).toBe(1);
        expect(portfolio.getLosses()).toBe(2);
        expect(portfolio.getMaxLossSequence()).toBe(2);
        // Drawdown from peak 11000 to 10000 is 1000/11000 = 9.09%
        expect(portfolio.getDrawdown()).toBe(9.09);
    });

    it('should reset current loss sequence on win but retain max loss sequence', () => {
        const portfolio = new ShadowPortfolio(10000);
        portfolio.recordTrade(-100, false);
        portfolio.recordTrade(-100, false);
        expect(portfolio.getCurrentLossSequence()).toBe(2);
        expect(portfolio.getMaxLossSequence()).toBe(2);

        portfolio.recordTrade(200, true);
        expect(portfolio.getCurrentLossSequence()).toBe(0);
        expect(portfolio.getMaxLossSequence()).toBe(2);
    });
});
