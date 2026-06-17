#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - HOTFIX 375.2"
echo " UX: CHRONOLOGICAL TIMELINE ALIGNMENT"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/2] Corrigindo orientação cronológica do motor de rastreio (Most Recent First)..."
cat > src/domain/analytics/LiveMesaTracker.ts <<'EOF'
import { IAnalyticsEngine } from '../interfaces/IAnalyticsEngine';

export class LiveMesaTracker implements IAnalyticsEngine {
    private _history: number[] = [];
    private readonly MAX_CAPACITY = 500;
    
    private readonly RED_NUMS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

    public addNumber(num: number): void {
        this._history.push(num);
        if (this._history.length > this.MAX_CAPACITY) {
            this._history.shift();
        }
    }

    public getHistory(): number[] {
        return [...this._history];
    }

    public getTimeline(length: number): string {
        // Alinhamento com plataformas: fatia os últimos giros e inverte a ordem
        // fazendo com que o número mais recente (último do array) fique na extrema esquerda.
        const slice = this._history.slice(-length).reverse();
        return slice.join(' - ');
    }

    public getFrequencies(): Map<number, number> {
        const freq = new Map<number, number>();
        for (let i = 0; i <= 36; i++) freq.set(i, 0);
        
        this._history.forEach(num => {
            freq.set(num, (freq.get(num) || 0) + 1);
        });
        return freq;
    }

    public getDistributionStats() {
        const stats = { 
            total: this._history.length, 
            red: 0, black: 0, zero: 0, 
            even: 0, odd: 0, 
            high: 0, low: 0,
            dozen1: 0, dozen2: 0, dozen3: 0,
            col1: 0, col2: 0, col3: 0
        };
        
        this._history.forEach(num => {
            if (num === 0) { stats.zero++; return; }
            
            if (this.RED_NUMS.has(num)) stats.red++; else stats.black++;
            if (num % 2 === 0) stats.even++; else stats.odd++;
            if (num >= 1 && num <= 18) stats.low++; else stats.high++;

            if (num >= 1 && num <= 12) stats.dozen1++;
            else if (num >= 13 && num <= 24) stats.dozen2++;
            else if (num >= 25 && num <= 36) stats.dozen3++;

            if (num % 3 === 1) stats.col1++;
            else if (num % 3 === 2) stats.col2++;
            else if (num % 3 === 0) stats.col3++;
        });
        
        return stats;
    }
}
EOF

echo "[2/2] Sincronizando modificação com o repositório Git..."
git add src/domain/analytics/LiveMesaTracker.ts
git commit -m "fix(analytics): reverse timeline output rendering to match live casino platforms UI orientation (Hotfix 375.2)" > /dev/null

echo "======================================"
echo -e "\033[1;32m HOTFIX 375.2 APLICADO COM SUCESSO \033[0m"
echo " STATUS: TIMELINE ALINHADA COM AS PLATAFORMAS"
echo "======================================"
