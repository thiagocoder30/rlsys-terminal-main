import { BankrollManager } from './BankrollManager';

export class StopWinManager {
    private stopWinLimit: number;

    constructor(stopWinLimit: number) {
        this.stopWinLimit = stopWinLimit;
    }

    public check(bankrollManager: BankrollManager): boolean {
        return bankrollManager.currentBankroll >= this.stopWinLimit;
    }

    public getLimit(): number {
        return this.stopWinLimit;
    }
}
