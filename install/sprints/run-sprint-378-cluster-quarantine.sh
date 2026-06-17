#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 378"
echo " RISK: CORRELATED CLUSTER QUARANTINE"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/2] Recalibrando o Avaliador de Performance para Dano Simpático (Famílias)..."
cat > src/domain/risk/StrategyPerformanceEvaluator.ts <<'EOF'
export class StrategyPerformanceEvaluator {
    private weights: Map<string, number> = new Map();
    private readonly MIN_THRESHOLD = 0.6; 
    private readonly DEGRADATION_FACTOR = 0.5; // Penalidade direta (Circuit Breaker)
    private readonly SYMPATHETIC_PENALTY = 0.4; // Penalidade para irmãs da mesma família
    private readonly BONIFICATION_FACTOR = 0.2; 
    private readonly MAX_WEIGHT = 1.2;
    private readonly MIN_WEIGHT = 0.1;

    // Mapeamento de Correlação de Risco
    private readonly strategyFamilies: Record<string, string> = {
        'SECTOR_OMEGA': 'SECTORS',
        'SECTOR_ALPHA': 'SECTORS',
        'FUSION_SECTOR': 'SECTORS',
        'HEDGE_BLACK_COL3': 'HEDGES',
        'HEDGE_RED_COL2': 'HEDGES',
        'TRIPLICACAO_RED': 'PATTERNS',
        'TRIPLICACAO_BLACK': 'PATTERNS',
        'TRIPLICACAO_EVEN': 'PATTERNS',
        'TRIPLICACAO_ODD': 'PATTERNS'
    };

    constructor(strategyIds: string[]) {
        strategyIds.forEach(id => this.weights.set(id, 1.0));
    }

    public getWeight(strategyId: string): number {
        return this.weights.get(strategyId) ?? 1.0;
    }

    public isAllowed(strategyId: string): boolean {
        return this.getWeight(strategyId) >= this.MIN_THRESHOLD;
    }

    private applyPenalty(strategyId: string, penalty: number): void {
        const current = this.getWeight(strategyId);
        const next = Math.max(this.MIN_WEIGHT, current - penalty);
        this.weights.set(strategyId, Math.round(next * 10) / 10);
    }

    public registerLoss(strategyId: string): void {
        const family = this.strategyFamilies[strategyId] || 'UNKNOWN';

        // 1. Penaliza a estratégia que executou o erro e quebrou o circuito
        this.applyPenalty(strategyId, this.DEGRADATION_FACTOR);

        // 2. Penalidade Simpática: Degrada a confiança nas estratégias da mesma família
        // Se uma falhou, a probabilidade da irmã falhar devido ao regime da mesa é altíssima.
        this.weights.forEach((_, key) => {
            if (key !== strategyId && this.strategyFamilies[key] === family) {
                this.applyPenalty(key, this.SYMPATHETIC_PENALTY);
            }
        });
    }

    public registerWin(strategyId: string): void {
        const current = this.getWeight(strategyId);
        const next = Math.min(this.MAX_WEIGHT, current + this.BONIFICATION_FACTOR);
        this.weights.set(strategyId, Math.round(next * 10) / 10);
    }

    public getAllWeights(): Record<string, number> {
        const record: Record<string, number> = {};
        this.weights.forEach((val, key) => { record[key] = val; });
        return record;
    }

    public setWeights(record: Record<string, number>): void {
        Object.entries(record).forEach(([key, val]) => {
            this.weights.set(key, val);
        });
    }
}
EOF

echo "[2/2] Registrando arquitetura de Correlação de Risco..."
git add src/domain/risk/StrategyPerformanceEvaluator.ts
git commit -m "feat(risk): implement correlated cluster quarantine to apply sympathetic weight degradation across strategies sharing the same physical/mathematical logic (Sprint 378)" > /dev/null

echo "======================================"
echo -e "\033[1;32m SPRINT 378 HOMOLOGADA E ATIVADA \033[0m"
echo " STATUS: PROTEÇÃO DE FAMÍLIA OPERACIONAL"
echo "======================================"
