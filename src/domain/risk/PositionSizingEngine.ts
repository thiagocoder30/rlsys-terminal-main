export type CasinoProvider = 'EVOLUTION' | 'PRAGMATIC';

export class PositionSizingEngine {
    private provider: CasinoProvider = 'EVOLUTION';

    public setProvider(provider: CasinoProvider): void {
        this.provider = provider;
    }

    public getProvider(): CasinoProvider {
        return this.provider;
    }

    /**
     * Calcula o dimensionamento baseado no valor da ficha unitária exigida pelo layout
     */
    public calculateOperationalSizing(currentBankroll: number, vix: number, baseStrategyStake: number): { finalStake: number; multiplier: number } {
        // Define o tamanho físico da ficha mínima baseada no provedor real
        const floorChip = this.provider === 'EVOLUTION' ? 0.50 : 0.10;
        
        // Deduz a quantidade de posições/fichas que o layout original exige (assumindo base histórica de 0.10)
        const totalChipsRequired = Math.max(1, Math.round(baseStrategyStake / 0.10));
        
        // Custo mínimo real inevitável para conseguir montar essa estratégia na mesa ativa
        const absoluteMinLayoutCost = totalChipsRequired * floorChip;
        
        // Kelly Fracionário: Define o orçamento máximo de risco teórico mitigado pela confiança do VIX
        const confidence = Math.max(0, (95 - vix) / 100);
        const maxRiskBudget = currentBankroll * 0.02 * confidence;
        
        // Calcula o multiplicador inteiro de fichas (1x, 2x, 3x...)
        let chipMultiplier = 1;
        if (maxRiskBudget > absoluteMinLayoutCost) {
            chipMultiplier = Math.floor(maxRiskBudget / absoluteMinLayoutCost);
            if (chipMultiplier < 1) chipMultiplier = 1;
        }
        
        // A stake final passa a ser um múltiplo exato e executável do layout físico da mesa
        const finalStake = chipMultiplier * absoluteMinLayoutCost;
        
        // O multiplicador de retorno (P&L) é normalizado contra o benchmark padrão de cálculo do sistema
        const multiplier = (chipMultiplier * floorChip) / 0.10;
        
        return {
            finalStake: Math.round(finalStake * 100) / 100,
            multiplier: multiplier
        };
    }
}
