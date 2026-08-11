import { BankrollManager } from './BankrollManager';

export class StopLossManager {
    private stopLossLimit: number;

    constructor(stopLossLimit: number) {
        this.stopLossLimit = stopLossLimit;
    }

    public check(bankrollManager: BankrollManager): boolean {
        return bankrollManager.currentBankroll <= this.stopLossLimit;
    }

    public getLimit(): number {
        return this.stopLossLimit;
    }
}
