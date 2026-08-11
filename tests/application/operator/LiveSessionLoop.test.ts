import { describe, it, expect } from 'vitest';
import { LiveSessionLoop } from '../../../src/application/operator/LiveSessionLoop';

describe('LiveSessionLoop (FSM)', () => {
    it('initializes in NOT_INITIALIZED state', () => {
        const loop = new LiveSessionLoop('SESS-101');
        expect(loop.getState()).toBe('NOT_INITIALIZED');
        expect(loop.getSessionId()).toBe('SESS-101');
        expect(loop.getLockReason()).toBeNull();
    });

    it('transitions correctly through sync and preflight flow', () => {
        const loop = new LiveSessionLoop('SESS-101');
        loop.startSync();
        expect(loop.getState()).toBe('PREFLIGHT');

        loop.completePreflight(true);
        expect(loop.getState()).toBe('WAITING_SPIN');
    });

    it('transitions to LOCKED when preflight fails', () => {
        const loop = new LiveSessionLoop('SESS-101');
        loop.startSync();
        loop.completePreflight(false, 'Drawdown exceeded');
        expect(loop.getState()).toBe('LOCKED');
        expect(loop.getLockReason()).toBe('Drawdown exceeded');
    });

    it('handles live spin processing cycle', () => {
        const loop = new LiveSessionLoop('SESS-101');
        loop.startSync();
        loop.completePreflight(true);

        loop.startSpinProcessing();
        expect(loop.getState()).toBe('PROCESSING');

        loop.completeSpinProcessing();
        expect(loop.getState()).toBe('WAITING_SPIN');
    });

    it('throws error on invalid FSM transition', () => {
        const loop = new LiveSessionLoop('SESS-101');
        expect(() => loop.startSpinProcessing()).toThrow(/Cannot process spin/);
    });

    it('allows finishing session', () => {
        const loop = new LiveSessionLoop('SESS-101');
        loop.startSync();
        loop.completePreflight(true);
        loop.finishSession();
        expect(loop.getState()).toBe('FINISHED');
    });
});
