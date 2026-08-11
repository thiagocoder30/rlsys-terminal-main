export class BankrollManager {
    private _initialBankroll: number;
    private _currentBankroll: number;
    private _highestBalance: number;
    private _lowestBalance: number;

    constructor(initialBankroll: number) {
        if (initialBankroll <= 0) {
            throw new Error('Initial bankroll must be greater than 0');
        }
        this._initialBankroll = initialBankroll;
        this._currentBankroll = initialBankroll;
        this._highestBalance = initialBankroll;
        this._lowestBalance = initialBankroll;
    }

    public updateBankroll(amount: number): void {
        this._currentBankroll += amount;
        
        if (this._currentBankroll > this._highestBalance) {
            this._highestBalance = this._currentBankroll;
        }
        if (this._currentBankroll < this._lowestBalance) {
            this._lowestBalance = this._currentBankroll;
        }
    }

    public get initialBankroll(): number {
        return this._initialBankroll;
    }

    public get currentBankroll(): number {
        return this._currentBankroll;
    }

    public get profitLoss(): number {
        return this._currentBankroll - this._initialBankroll;
    }

    public get roi(): number {
        return this.profitLoss / this._initialBankroll;
    }

    public get highestBalance(): number {
        return this._highestBalance;
    }

    public get lowestBalance(): number {
        return this._lowestBalance;
    }
}
