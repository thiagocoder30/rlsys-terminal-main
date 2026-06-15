export class TrailingStopGuard {
    private highestBankroll: number;
    private readonly startBankroll: number;
    private readonly activationThresholdPercent = 1.05; // Requer 5% de lucro para armar o escudo
    private readonly trailingDistancePercent = 0.02;    // Tolerância de 2% de rebaixamento a partir do pico

    constructor(startBankroll: number) {
        this.startBankroll = startBankroll;
        this.highestBankroll = startBankroll;
    }

    public updatePeak(currentBankroll: number): void {
        if (currentBankroll > this.highestBankroll) {
            this.highestBankroll = currentBankroll;
        }
    }

    public checkStop(currentBankroll: number): { isStopped: boolean; reason: string } {
        const activationPoint = this.startBankroll * this.activationThresholdPercent;

        if (this.highestBankroll >= activationPoint) {
            const stopLine = this.highestBankroll * (1 - this.trailingDistancePercent);
            if (currentBankroll <= stopLine) {
                return { isStopped: true, reason: 'TRAILING STOP ALCANÇADO (Lucro Residual Protegido)' };
            }
        }
        return { isStopped: false, reason: '' };
    }
}
