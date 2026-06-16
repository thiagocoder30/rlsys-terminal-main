#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 384"
echo " STRATEGY: CROSS-GRID HEDGES"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

# Garante que o diretório de destino das estratégias existe
mkdir -p src/domain/financial/strategies

echo "[1/2] Gravando a estratégia Cross-Grid Dozen/Column Hedge..."
cat > src/domain/financial/strategies/CrossGridHedgeStrategy.ts <<'EOF'
export interface StrategyResult {
    status: 'WIN_MAX' | 'WIN_MIN' | 'LOSS' | 'PUSH';
    netAmount: number;
}

export class CrossGridHedgeStrategy {
    public static readonly id = 'CROSS_GRID_HEDGE';
    public static readonly name = 'Cross-Grid Dozen/Column Hedge';
    public static readonly stake = 0.20; // Requer 2 fichas de piso (R$ 0.10 por coluna)

    // Definição das Colunas baseadas no layout físico da mesa
    private static readonly COL1 = new Set([1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]);
    private static readonly COL2 = new Set([2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35]);
    private static readonly COL3 = new Set([3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]);

    /**
     * Valida se a microestrutura recente cumpre o Filtro de Exaustão Estatística.
     * O gatilho só é liberado se a coluna que vamos omitir tiver se repetido nos últimos 3 giros.
     */
    public static isFilterSatisfied(history: number[]): boolean {
        if (history.length < 4) return false;
        
        const lastNum = history[history.length - 1];
        const timelineRecent = history.slice(-3); // Pega as 3 últimas rodadas para exaustão

        let columnToOmit = 0;
        if (lastNum >= 1 && lastNum <= 12) columnToOmit = 1;      // Dúzia 1 ignora Coluna 1
        else if (lastNum >= 13 && lastNum <= 24) columnToOmit = 2; // Dúzia 2 ignora Coluna 2
        else if (lastNum >= 25 && lastNum <= 36) columnToOmit = 3; // Dúzia 3 ignora Coluna 3
        else return false; // Ignora se for o número Zero

        // O filtro retorna VERDADEIRO se todos os 3 giros recentes caíram na coluna omitida
        return timelineRecent.every(num => {
            if (columnToOmit === 1) return this.COL1.has(num);
            if (columnToOmit === 2) return this.COL2.has(num);
            if (columnToOmit === 3) return this.COL3.has(num);
            return false;
        });
    }

    /**
     * Processa a liquidação financeira baseada no número âncora anterior
     */
    public static evaluate(drawnNumber: number, lastAnchorNumber: number): StrategyResult {
        if (drawnNumber === 0) {
            return { status: 'LOSS', netAmount: -this.stake };
        }

        let targetColA = 0;
        let targetColB = 0;

        // Mapeamento ortogonal: Dúzia de origem dita quais colunas cobrir
        if (lastAnchorNumber >= 1 && lastAnchorNumber <= 12) {
            targetColA = 2; targetColB = 3; // Dúzia 1 entra nas colunas 2 e 3
        } else if (lastAnchorNumber >= 13 && lastAnchorNumber <= 24) {
            targetColA = 1; targetColB = 3; // Dúzia 2 entra nas colunas 1 e 3
        } else if (lastAnchorNumber >= 25 && lastAnchorNumber <= 36) {
            targetColA = 1; targetColB = 2; // Dúzia 3 entra nas colunas 1 e 2
        }

        const hitCol1 = this.COL1.has(drawnNumber);
        const hitCol2 = this.COL2.has(drawnNumber);
        const currentColumn = hitCol1 ? 1 : hitCol2 ? 2 : 3;

        if (currentColumn === targetColA || currentColumn === targetColB) {
            return { status: 'WIN_MAX', netAmount: 0.10 }; // Lucro líquido de 1 unidade (R$ 0.10)
        }

        return { status: 'LOSS', netAmount: -this.stake }; // Perda de 2 unidades (R$ 0.20)
    }
}
EOF

echo "[2/2] Registrando nova lógica no controle de versão Git..."
git add src/domain/financial/strategies/CrossGridHedgeStrategy.ts
git add install/sprints/run-sprint-384-cross-grid-hedge.sh
git commit -m "feat(strategy): implement CrossGridHedgeStrategy and setup automated deployment script under install/sprints (Sprint 384)" > /dev/null

echo "======================================"
echo -e "\033[1;32m SPRINT 384 COMPILADA E CONFIGURADA \033[0m"
echo " PASTA: install/sprints/"
echo "======================================"
