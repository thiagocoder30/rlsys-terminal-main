export type CasinoProvider = 'EVOLUTION' | 'PRAGMATIC';

export class PositionSizingEngine {
    private provider: CasinoProvider = 'EVOLUTION';

    public setProvider(provider: CasinoProvider): void {
        this.provider = provider;
    }

    public getProvider(): CasinoProvider {
        return this.provider;
    }

    public calculateStake(currentBankroll: number, vix: number): number {
        const minStake = this.provider === 'EVOLUTION' ? 0.50 : 0.10;
        
        // Pseudo-Fractional Kelly: Confiança inversamente proporcional à Entropia (VIX)
        // VIX 95 = 0% confiança. VIX 50 = 45% confiança.
        const confidence = Math.max(0, (95 - vix) / 100);
        
        // Risco máximo conservador: 2% da banca por operação
        const maxRisk = currentBankroll * 0.02;
        let targetStake = maxRisk * confidence;
        
        // Arredonda para o décimo mais próximo para evitar dízimas na API da corretora
        targetStake = Math.round(targetStake * 10) / 10;
        
        // Aplica o Floor limit do provedor
        return Math.max(minStake, targetStake);
    }
}
