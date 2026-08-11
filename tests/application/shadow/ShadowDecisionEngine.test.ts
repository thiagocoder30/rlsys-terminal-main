import { describe, it, expect } from 'vitest';
import { ShadowDecisionEngine } from '../../../src/application/shadow/ShadowDecisionEngine';

describe('ShadowDecisionEngine Unit Tests', () => {
    const engine = new ShadowDecisionEngine();

    it('should evaluate WIN when isWin flag is true', () => {
        const result = engine.evaluateDecision(
            { isOpportunity: true, strategy: 'MARKOV_TREND', preFlightStatus: 'APPROVED', status: 'RECOMMENDATION' },
            { isWin: true, pnlDelta: 10 }
        );
        expect(result).toBe('WIN');
    });

    it('should evaluate LOSS when isWin flag is false', () => {
        const result = engine.evaluateDecision(
            { isOpportunity: true, strategy: 'MARKOV_TREND', preFlightStatus: 'APPROVED', status: 'RECOMMENDATION' },
            { isWin: false, pnlDelta: -10 }
        );
        expect(result).toBe('LOSS');
    });

    it('should return BLOCKED when preFlightStatus is REJECTED', () => {
        const result = engine.evaluateDecision(
            { isOpportunity: true, strategy: 'MARKOV_TREND', preFlightStatus: 'REJECTED', status: 'RECOMMENDATION' },
            { isWin: true }
        );
        expect(result).toBe('BLOCKED');
    });

    it('should return BLOCKED when status is BLOCK or lockReason is active', () => {
        const result1 = engine.evaluateDecision(
            { isOpportunity: true, strategy: 'MARKOV_TREND', preFlightStatus: 'APPROVED', status: 'BLOCK' },
            { isWin: true }
        );
        expect(result1).toBe('BLOCKED');

        const result2 = engine.evaluateDecision(
            { isOpportunity: true, strategy: 'MARKOV_TREND', preFlightStatus: 'APPROVED', status: 'RECOMMENDATION', lockReason: 'DRAWDOWN_LOCK' },
            { isWin: true }
        );
        expect(result2).toBe('BLOCKED');
    });

    it('should return NO_TRADE when isOpportunity is false or status is HOLD or strategy is NONE', () => {
        const result1 = engine.evaluateDecision(
            { isOpportunity: false, strategy: 'MARKOV_TREND', preFlightStatus: 'APPROVED', status: 'RECOMMENDATION' },
            { isWin: true }
        );
        expect(result1).toBe('NO_TRADE');

        const result2 = engine.evaluateDecision(
            { isOpportunity: true, strategy: null, preFlightStatus: 'APPROVED', status: 'HOLD' },
            { isWin: true }
        );
        expect(result2).toBe('NO_TRADE');
    });

    it('should evaluate winning number against target numbers when provided', () => {
        const winResult = engine.evaluateDecision(
            { isOpportunity: true, strategy: 'PERSISTENT_SECTOR', preFlightStatus: 'APPROVED', status: 'RECOMMENDATION' },
            { winningNumber: 17, targetNumbers: [17, 34, 6] }
        );
        expect(winResult).toBe('WIN');

        const lossResult = engine.evaluateDecision(
            { isOpportunity: true, strategy: 'PERSISTENT_SECTOR', preFlightStatus: 'APPROVED', status: 'RECOMMENDATION' },
            { winningNumber: 22, targetNumbers: [17, 34, 6] }
        );
        expect(lossResult).toBe('LOSS');
    });
});
