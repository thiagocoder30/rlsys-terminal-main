export class DynamicEmotionalCooldownGuard {
    public currentBankroll: number;
    public nextMilestone: number;
    public isSessionEnded: boolean = false;

    constructor(initialBankroll: number, savedState: any) {
        this.currentBankroll = initialBankroll;
        // Alvo de segurança institucional: +10% da banca atual
        this.nextMilestone = initialBankroll * 1.10; 
    }

    public exportState(): any {
        return { initialBankroll: this.currentBankroll };
    }

    public registerOutcome(isWin: boolean, newBankroll: number): void {
        this.currentBankroll = newBankroll;
    }

    public isLocked(): boolean {
        return false;
    }

    public getRemainingStatus(): any {
        return null;
    }
}
