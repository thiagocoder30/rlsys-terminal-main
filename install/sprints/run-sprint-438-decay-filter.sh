#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 438"
echo " DYNAMIC DECAY COMPENSATION FILTER"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/2] Injetando Filtro Matemático EMA (O(1))..."
cat > src/domain/intelligence/DecayCompensationFilter.ts <<'EOF'
/**
 * @file DecayCompensationFilter.ts
 * @description Filtro de compensação dinâmica de decaimento utilizando Média Móvel Exponencial (EMA).
 * Mitiga ruídos de curto prazo em sistemas de alta frequência sem alocação de arrays dinâmicos.
 */

export class DecayCompensationFilter {
    private readonly alpha: number;
    private currentEma: number | null = null;

    /**
     * @param alpha Fator de suavização (0 < alpha <= 1). Valores menores dão mais peso ao histórico estrutural.
     */
    constructor(alpha: number = 0.2) {
        if (alpha <= 0 || alpha > 1) {
            throw new Error('ERR_INVALID_ALPHA_PARAMETER: Alpha deve ser estritamente maior que 0 e menor ou igual a 1.');
        }
        this.alpha = alpha;
    }

    /**
     * Aplica a compensação matemática no decaimento bruto capturado.
     * Complexidade Assintótica: O(1) tempo | O(1) espaço.
     * @param rawDecay Valor bruto de decaimento lido no tick atual.
     * @returns Valor do decaimento ponderado e protegido contra ruídos.
     */
    public apply(rawDecay: number): number {
        if (this.currentEma === null) {
            this.currentEma = rawDecay;
            return rawDecay;
        }

        // Fórmula Institucional EMA: (Valor_Atual * Alpha) + (EMA_Anterior * (1 - Alpha))
        this.currentEma = (rawDecay * this.alpha) + (this.currentEma * (1 - this.alpha));
        return this.currentEma;
    }

    /**
     * Zera o estado dinâmico do filtro (necessário durante os eventos de Hard Reset ou troca de sessão).
     */
    public reset(): void {
        this.currentEma = null;
    }
    
    /**
     * @returns O valor da média móvel de decaimento atual ou nulo se não houver amostragem.
     */
    public getConsolidatedDecay(): number | null {
        return this.currentEma;
    }
}
EOF

echo "[2/2] Atualizando o repositório Git com o novo filtro estrutural..."
git add src/domain/intelligence/DecayCompensationFilter.ts
git add install/sprints/run-sprint-438-decay-filter.sh
git commit -m "feat(intelligence): implement DecayCompensationFilter using O(1) Exponential Moving Average (EMA) to mitigate signal degradation spikes without array allocation overhead (Sprint 438)" > /dev/null

echo "======================================"
echo -e "\033[1;32m SPRINT 438 INSTALADA COM SUCESSO \033[0m"
echo " STATUS: FILTRO DE COMPENSAÇÃO EMA ATIVO"
echo "======================================"
