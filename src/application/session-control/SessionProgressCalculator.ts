import { BankrollManager } from './BankrollManager';
import { StopLossManager } from './StopLossManager';
import { StopWinManager } from './StopWinManager';

export class SessionProgressCalculator {
    public static calculateProgress(
        bankrollManager: BankrollManager,
        stopLossManager: StopLossManager,
        stopWinManager: StopWinManager
    ): { stopLossProgress: number; stopWinProgress: number } {
        const initial = bankrollManager.initialBankroll;
        const current = bankrollManager.currentBankroll;
        const stopLoss = stopLossManager.getLimit();
        const stopWin = stopWinManager.getLimit();

        let stopLossProgress = 0;
        let stopWinProgress = 0;

        if (current <= stopLoss) {
            stopLossProgress = 1.0;
        } else if (current < initial) {
            stopLossProgress = (initial - current) / (initial - stopLoss);
        }

        if (current >= stopWin) {
            stopWinProgress = 1.0;
        } else if (current > initial) {
            stopWinProgress = (current - initial) / (stopWin - initial);
        }

        return {
            stopLossProgress,
            stopWinProgress
        };
    }
}
