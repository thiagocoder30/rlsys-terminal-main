import { describe, it, expect } from 'vitest';
import { StartupValidator } from '../../../src/application/session-startup/StartupValidator';
import { StartupProgress } from '../../../src/application/session-startup/StartupProgress';

describe('StartupValidator', () => {
    it('should validate complete context as valid', () => {
        const progress = new StartupProgress();
        progress.markCompleted('TableSelection');
        progress.markCompleted('BankrollConfiguration');
        progress.markCompleted('HistorySync');
        progress.markCompleted('Warmup');

        const result = StartupValidator.validate({
            tableProvider: 'Pragmatic',
            bankroll: 1000,
            progress,
            runtimeReady: true
        });

        expect(result.valid).toBe(true);
        expect(result.errors.length).toBe(0);
    });

    it('should return errors for incomplete setup', () => {
        const progress = new StartupProgress();

        const result = StartupValidator.validate({
            tableProvider: null,
            bankroll: null,
            progress,
            runtimeReady: false
        });

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });
});
