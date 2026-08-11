import { describe, it, expect } from 'vitest';
import { StartupProgress } from '../../../src/application/session-startup/StartupProgress';

describe('StartupProgress', () => {
    it('should track step completion and calculate correct percentage', () => {
        const progress = new StartupProgress();
        expect(progress.getPercentage()).toBe(0);

        progress.markCompleted('TableSelection');
        expect(progress.getPercentage()).toBe(20);

        progress.markCompleted('BankrollConfiguration');
        expect(progress.getPercentage()).toBe(40);

        progress.markCompleted('HistorySync');
        progress.markCompleted('Warmup');
        progress.markCompleted('Validation');
        expect(progress.getPercentage()).toBe(100);
        expect(progress.getCompletedCount()).toBe(5);
    });

    it('should reset properly', () => {
        const progress = new StartupProgress();
        progress.markCompleted('TableSelection');
        expect(progress.getCompletedCount()).toBe(1);

        progress.reset();
        expect(progress.getCompletedCount()).toBe(0);
        expect(progress.getPercentage()).toBe(0);
    });
});
