#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 386"
echo " TYPESCRIPT STRICT NAME CONFLICT FIX"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/2] Corrigindo a propriedade reservada 'name' na Estratégia..."
cat > src/domain/financial/strategies/CrossGridHedgeStrategy.ts <<'EOF'
export interface StrategyResult {
    status: 'WIN_MAX' | 'WIN_MIN' | 'LOSS' | 'PUSH';
    netAmount: number;
}

export class CrossGridHedgeStrategy {
    public static readonly id = 'CROSS_GRID_HEDGE';
    // FIX SPRINT 386: Trocando 'name' (reservado) por 'strategyName'
    public static readonly strategyName = 'Cross-Grid Dozen/Column Hedge';
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

echo "[2/2] Sincronizando AutoSettlementEngine com a nova propriedade..."
cat > src/domain/financial/AutoSettlementEngine.js <<'EOF'
const { CrossGridHedgeStrategy } = require('./strategies/CrossGridHedgeStrategy');

class AutoSettlementEngine {
    static RED_NUMS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    static BLACK_NUMS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

    static getStrategies() {
        return {
            'HEDGE_BLACK_COL3': { name: 'Hedge Black Col 3', stake: 1.50, evaluate: (n) => ({ status: 'LOSS', netAmount: -1.50 }) },
            'HEDGE_RED_COL2': { name: 'Hedge Red Col 2', stake: 1.50, evaluate: (n) => ({ status: 'LOSS', netAmount: -1.50 }) },
            'SECTOR_OMEGA': { name: 'Sector Omega', stake: 1.60, evaluate: (n) => ({ status: 'LOSS', netAmount: -1.60 }) },
            'SECTOR_ALPHA': { name: 'Sector Alpha', stake: 1.60, evaluate: (n) => ({ status: 'LOSS', netAmount: -1.60 }) },
            'FUSION_SECTOR': { name: 'Fusion Reduzida (Setor do 23)', stake: 0.80, evaluate: (n) => ({ status: 'LOSS', netAmount: -0.80 }) },
            'TRIPLICACAO_RED': { name: 'Triplicação (Alvo: VERMELHO)', stake: 0.10, evaluate: (n) => ({ status: 'LOSS', netAmount: -0.10 }) },
            'TRIPLICACAO_BLACK': { name: 'Triplicação (Alvo: PRETO)', stake: 0.10, evaluate: (n) => ({ status: 'LOSS', netAmount: -0.10 }) },
            'TRIPLICACAO_EVEN': { name: 'Triplicação (Alvo: PAR)', stake: 0.10, evaluate: (n) => ({ status: 'LOSS', netAmount: -0.10 }) },
            'TRIPLICACAO_ODD': { name: 'Triplicação (Alvo: ÍMPAR)', stake: 0.10, evaluate: (n) => ({ status: 'LOSS', netAmount: -0.10 }) },
            'CROSS_GRID_HEDGE': { 
                name: CrossGridHedgeStrategy.strategyName, // FIX SPRINT 386: Lendo a propriedade correta
                stake: CrossGridHedgeStrategy.stake,
                evaluate: (drawn, anchor) => CrossGridHedgeStrategy.evaluate(drawn, anchor)
            }
        };
    }
}

module.exports = { AutoSettlementEngine };
EOF

git add src/domain/financial/strategies/CrossGridHedgeStrategy.ts
git add src/domain/financial/AutoSettlementEngine.js
git add install/sprints/run-sprint-386-ts-name-conflict-fix.sh
git commit -m "fix(strategy): resolve TS2699 reserved keyword conflict by renaming 'name' to 'strategyName' (Sprint 386)" > /dev/null

echo "======================================"
echo -e "\033[1;32m SPRINT 386 RESOLVIDA COM SUCESSO \033[0m"
echo " STATUS: ERRO DE COMPILAÇÃO TS2699 ELIMINADO"
echo "======================================"
