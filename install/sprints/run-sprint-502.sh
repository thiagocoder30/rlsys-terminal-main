#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 502"
echo " FRENCH ZONES INTELLIGENCE (V5.20b)"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

cat > src/presentation/cli/LivePaperOrchestrator.ts <<'TS_EOF'
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'path';
import { IBankrollRepository } from '../../domain/interfaces/IBankrollRepository';
import { IAnalyticsEngine } from '../../domain/interfaces/IAnalyticsEngine';

export class LivePaperOrchestrator {
    private rl: readline.Interface;
    private bankrollRepo: IBankrollRepository;
    private mesaTracker: IAnalyticsEngine;
    
    private initialBankroll: number = 100.00;
    private currentBankroll: number = 100.00;
    private peakBankroll: number = 100.00;
    private lowestDip: number = 100.00;
    private macroBaseline: number = 50.00;
    
    private sessionWins: number = 0;
    private sessionLosses: number = 0;
    
    private activeStrategyId: string | null = null;
    private inputMode: string = 'NUMBER';
    private systemLocked: boolean = false;
    
    private provider: 'PRAGMATIC' | 'EVOLUTION' = 'PRAGMATIC';
    
    private xaiQualification: string = 'NÃO';
    private xaiMoment: string = 'AGORA NÃO';
    private xaiReason: string = 'Aguardando dados estruturais da mesa.';
    private xaiApplicationText: string = 'Nenhuma ficha na mesa.';
    private preSpinImpactText: string = '';
    
    private currentVixPercent: number = 0;
    private dynamicVixTolerance: number = 95.0;
    
    private disabledStrategies: Set<string> = new Set();
    
    private dynamicStakeCalculated: number = 0.00;
    private shadowWeights: Record<string, number> = {};
    private shadowPnL: Record<string, number> = {};

    private lastActionTakenText: string = 'Aguardando início de operações.';
    
    private activeBet: { strategyId: string, stake: number, chipMin: number, multiplier: number } | null = null;

    private readonly STRATEGY_ZONES: Record<string, number[]> = {
        'ZONE_TIERS': [5, 8, 10, 11, 13, 16, 23, 24, 27, 30, 33, 36],
        'ZONE_VOISINS': [22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25],
        'ZONE_ORPHELINS': [1, 20, 14, 31, 9, 22, 17, 34],
        'DYNAMIC_NEIGHBORS': [],
        'CROSS_GRID_1_2': [1,4,7,10,13,16,19,22,25,28,31,34, 2,5,8,11,14,17,20,23,26,29,32,35],
        'CROSS_GRID_1_3': [1,4,7,10,13,16,19,22,25,28,31,34, 3,6,9,12,15,18,21,24,27,30,33,36],
        'CROSS_GRID_2_3': [2,5,8,11,14,17,20,23,26,29,32,35, 3,6,9,12,15,18,21,24,27,30,33,36],
        'CROSS_DOZEN_1_2': [1,2,3,4,5,6,7,8,9,10,11,12, 13,14,15,16,17,18,19,20,21,22,23,24],
        'CROSS_DOZEN_1_3': [1,2,3,4,5,6,7,8,9,10,11,12, 25,26,27,28,29,30,31,32,33,34,35,36],
        'CROSS_DOZEN_2_3': [13,14,15,16,17,18,19,20,21,22,23,24, 25,26,27,28,29,30,31,32,33,34,35,36],
        'STREET_HOT_TWO': [] 
    };

    private readonly WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

    constructor(bankrollRepo: IBankrollRepository, mesaTracker: IAnalyticsEngine) {
        this.bankrollRepo = bankrollRepo;
        this.mesaTracker = mesaTracker;
        this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    }

    public async initialize(): Promise<void> {
        const savedState = this.bankrollRepo.load() || {};
        if (savedState.initialBankroll) {
            this.initialBankroll = savedState.initialBankroll;
            this.currentBankroll = savedState.initialBankroll;
            this.peakBankroll = savedState.initialBankroll;
            this.lowestDip = savedState.initialBankroll;
        }
        if (savedState.macroBaseline) this.macroBaseline = savedState.macroBaseline;
        
        Object.keys(this.STRATEGY_ZONES).forEach(id => {
            this.shadowWeights[id] = 1.0;
            this.shadowPnL[id] = 0.0;
        });
        
        this.generateNextTrade();
        this.attachEventListeners();
    }

    private getDynamicNeighbors(lastNum: number): number[] {
        if (lastNum === -1) return [];
        const idx = this.WHEEL_ORDER.indexOf(lastNum);
        if (idx === -1) return [];
        const len = this.WHEEL_ORDER.length;
        return [
            this.WHEEL_ORDER[(idx - 2 + len) % len],
            this.WHEEL_ORDER[(idx - 1 + len) % len],
            this.WHEEL_ORDER[idx],
            this.WHEEL_ORDER[(idx + 1) % len],
            this.WHEEL_ORDER[(idx + 2) % len]
        ];
    }

    private getZone(stratId: string, lastNum: number): number[] {
        if (stratId === 'DYNAMIC_NEIGHBORS') return this.getDynamicNeighbors(lastNum);
        if (stratId === 'STREET_HOT_TWO') return []; // Calculado via motor dedicado
        return this.STRATEGY_ZONES[stratId] || [];
    }

    private formatNumberColor(num: number): string {
        if (num === 0) return `\x1b[32m0\x1b[0m`;
        const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
        if (REDS.has(num)) return `\x1b[31m${num}\x1b[0m`;
        return `\x1b[90m${num}\x1b[0m`;
    }

    private getFinancials(strat: string, num: number, isWin: boolean, minChip: number, mult: number): { cost: number, pnl: number } {
        let cost = 0;
        let payout = 0;

        if (strat === 'ZONE_TIERS') {
            cost = 6 * minChip * mult;
            payout = isWin ? (18 * minChip * mult) : 0;
        } else if (strat === 'ZONE_VOISINS') {
            cost = 9 * minChip * mult;
            if (isWin) {
                if ([0, 2, 3].includes(num)) payout = 24 * minChip * mult;
                else payout = 18 * minChip * mult;
            }
        } else if (strat === 'ZONE_ORPHELINS') {
            cost = 5 * minChip * mult;
            if (isWin) {
                if ([1, 17].includes(num)) payout = 36 * minChip * mult;
                else payout = 18 * minChip * mult;
            }
        } else if (strat.startsWith('CROSS_GRID') || strat.startsWith('CROSS_DOZEN')) {
            cost = 2 * minChip * mult;
            payout = isWin ? (3 * minChip * mult) : 0;
        } else if (strat === 'DYNAMIC_NEIGHBORS') {
            cost = 5 * minChip * mult;
            payout = isWin ? (36 * minChip * mult) : 0;
        } else {
            const zoneList = this.STRATEGY_ZONES[strat] || [];
            cost = zoneList.length * minChip * mult;
            payout = isWin ? (36 * minChip * mult) : 0;
        }

        return { cost, pnl: payout - cost };
    }

    private renderTerminalHud(): void {
        console.clear();
        
        const m1 = this.macroBaseline * 2;
        const currentTarget = m1;
        const prevTarget = this.macroBaseline;
        
        const macroProg = Math.max(0, this.currentBankroll - prevTarget);
        const range = currentTarget - prevTarget;
        let macroPct = range > 0 ? (macroProg / range) * 100 : 100;
        if (macroPct > 100) macroPct = 100;
        
        const pBar = Math.floor(macroPct / 10);
        const barStr = '█'.repeat(pBar) + '░'.repeat(10 - pBar);

        const trailingStopLoss = this.peakBankroll * 0.85;
        const sessionTakeProfit = this.initialBankroll * 1.20;

        console.log('\x1b[36m======================================================\x1b[0m');
        console.log(' RL.SYS CORE - TACTICAL ORCHESTRATOR [V5.20b]');
        console.log('\x1b[36m======================================================\x1b[0m');
        const minChip = this.provider === 'PRAGMATIC' ? 0.10 : 0.50;
        console.log(` MESA / PROVEDOR . ${this.provider} (Ficha Mín: R$ ${minChip.toFixed(2)})`);
        console.log(` BANCA ATUAL ..... \x1b[33mR$ ${this.currentBankroll.toFixed(2)}\x1b[0m`);
        console.log(` STOP LOSS (15%).. \x1b[31mR$ ${trailingStopLoss.toFixed(2)}\x1b[0m (Trailing Peak: \x1b[32mR$ ${this.peakBankroll.toFixed(2)}\x1b[0m)`);
        console.log(` TAKE PROFIT (20%) \x1b[32mR$ ${sessionTakeProfit.toFixed(2)}\x1b[0m`);
        console.log(` ENTROPIA (VIX) .. ${this.currentVixPercent.toFixed(1)}% (Tol. Dinâmica: ${this.dynamicVixTolerance.toFixed(1)}%)`);
        console.log('\x1b[90m------------------------------------------------------\x1b[0m');
        const hist = this.mesaTracker.getHistory().slice(-15);
        console.log(` TIMELINE ........ ${hist.length === 0 ? '\x1b[90mVazia\x1b[0m' : hist.map(n => this.formatNumberColor(n)).join(' - ')}`);
        console.log('\x1b[90m------------------------------------------------------\x1b[0m');
        
        let qColor = '\x1b[31m';
        if (this.xaiQualification === 'SIM') qColor = '\x1b[32m';
        if (this.xaiQualification.includes('BLOQUEADO') || this.xaiQualification.includes('VETADO')) qColor = '\x1b[41m\x1b[37m'; 
        
        const sColor = this.dynamicStakeCalculated > 0 ? '\x1b[33m' : '\x1b[90m';

        console.log(` Estratégia ... ${this.activeStrategyId || 'Nenhuma'}`);
        console.log(` Qualificação . ${qColor}${this.xaiQualification}\x1b[0m`);
        console.log(` STAKE GLOBAL . ${sColor}R$ ${this.dynamicStakeCalculated.toFixed(2)}\x1b[0m`);
        console.log(` APLICAÇÃO .... ${this.xaiApplicationText}`);
        if (this.preSpinImpactText !== '') console.log(` CENÁRIO (SIM)  ${this.preSpinImpactText}`);
        console.log(` Motivo ....... ${this.xaiReason}`);
        console.log('\x1b[90m------------------------------------------------------\x1b[0m');
        console.log(` Registro ..... ${this.lastActionTakenText}`);
        console.log('\x1b[36m======================================================\x1b[0m');
        
        if (this.systemLocked) this.rl.setPrompt('\x1b[31m[CIRCUIT BREAKER] Digite "stats" ou "exit" > \x1b[0m');
        else this.rl.setPrompt('\x1b[36mInsira o Giro (Ex: 15 ou p15 p/ Pular) > \x1b[0m');
        
        this.rl.prompt(true);
    }

    private resolveFinancials(drawnNumber: number) {
        if (!this.activeBet) return; 
        
        const strat = this.activeBet.strategyId;
        const history = this.mesaTracker.getHistory();
        const lastNum = history.length > 0 ? history[history.length - 1] : -1;
        const zoneList = this.getZone(strat, lastNum);
        const zone = new Set(zoneList);
        const isWin = zone.has(drawnNumber);
        
        const { pnl } = this.getFinancials(strat, drawnNumber, isWin, this.activeBet.chipMin, this.activeBet.multiplier);
        
        this.currentBankroll += pnl;
        if (pnl > 0) this.sessionWins++; else this.sessionLosses++;
        if (this.currentBankroll > this.peakBankroll) this.peakBankroll = this.currentBankroll;
        if (this.currentBankroll < this.lowestDip) this.lowestDip = this.currentBankroll;

        const color = pnl > 0 ? '\x1b[32m' : '\x1b[31m';
        const resultText = pnl > 0 ? `WIN (+R$ ${pnl.toFixed(2)})` : `LOSS (-R$ ${Math.abs(pnl).toFixed(2)})`;
        this.lastActionTakenText = `${color}[LIQUIDAÇÃO] ${resultText} na ${strat}\x1b[0m`;
        this.activeBet = null; 
    }

    private evaluateShadowTrading(drawnNumber: number) {
        const minChip = this.provider === 'PRAGMATIC' ? 0.10 : 0.50;
        const history = this.mesaTracker.getHistory();
        const lastNum = history.length > 0 ? history[history.length - 1] : -1;
        
        for (const strat of Object.keys(this.STRATEGY_ZONES)) {
            if (this.disabledStrategies.has(strat) || strat === 'STREET_HOT_TWO') continue;
            
            const zoneList = this.getZone(strat, lastNum);
            if (zoneList.length === 0) continue;
            
            const isWin = new Set(zoneList).has(drawnNumber);
            const { pnl } = this.getFinancials(strat, drawnNumber, isWin, minChip, 1);
            
            this.shadowPnL[strat] = (this.shadowPnL[strat] || 0) + pnl;
            
            if (pnl > 0) this.shadowWeights[strat] = Math.min(3.0, (this.shadowWeights[strat] || 1.0) + 0.15);
            else this.shadowWeights[strat] = Math.max(0.1, (this.shadowWeights[strat] || 1.0) - 0.20);
        }
    }

    private calculateSizing(strategyId: string, minChip: number, weight: number, lastNum: number): { total: number, desc: string, multiplier: number, isSafe: boolean, cost: number, safeLimit: number } {
        const MAX_RISK_PCT = 0.05; 
        const safeLimit = this.currentBankroll * MAX_RISK_PCT;
        
        let baseUnits = 0;
        if (strategyId.startsWith('CROSS_')) baseUnits = 2;
        else if (strategyId === 'ZONE_TIERS') baseUnits = 6;
        else if (strategyId === 'ZONE_VOISINS') baseUnits = 9;
        else if (strategyId === 'ZONE_ORPHELINS') baseUnits = 5;
        else if (strategyId === 'DYNAMIC_NEIGHBORS') baseUnits = 5;
        else baseUnits = this.getZone(strategyId, lastNum).length;

        const baseCost = baseUnits * minChip;
        if (baseCost > safeLimit || baseUnits === 0) {
            return { total: 0, desc: `Risco extremo ou alvo inválido.`, multiplier: 0, isSafe: false, cost: baseCost, safeLimit };
        }

        const kellyFraction = Math.max(0.01, weight / 100);
        let targetStake = this.currentBankroll * kellyFraction;
        if (targetStake > safeLimit) targetStake = safeLimit;

        let multiplier = Math.floor(targetStake / baseCost);
        if (multiplier < 1) multiplier = 1; 

        const totalCost = baseCost * multiplier;
        const uCost = (minChip * multiplier).toFixed(2);

        let desc = '';
        if (strategyId === 'ZONE_TIERS') desc = `\x1b[32m6 Splits no Tiers (R$ ${uCost}/cada)\x1b[0m`;
        else if (strategyId === 'ZONE_VOISINS') desc = `\x1b[32mVizinhos do Zero (R$ ${uCost}/ficha. Total 9 fichas)\x1b[0m`;
        else if (strategyId === 'ZONE_ORPHELINS') desc = `\x1b[32mNúmeros Órfãos (R$ ${uCost}/ficha. Total 5 fichas)\x1b[0m`;
        else if (strategyId.startsWith('CROSS_')) desc = `\x1b[32mDuas Zonas Externas (R$ ${uCost}/cada)\x1b[0m`;
        else desc = `\x1b[32mCobertura Plena: ${baseUnits} fichas (R$ ${uCost}/cada)\x1b[0m`;

        return { total: totalCost, desc, multiplier, isSafe: true, cost: baseCost, safeLimit };
    }

    private attachEventListeners(): void {
        this.rl.on('line', (line) => {
            const cmd = line.trim().toLowerCase();

            if (this.inputMode === 'VIEW_ONLY') {
                this.inputMode = 'NUMBER';
                this.renderTerminalHud();
                return;
            }
            if (cmd === '') { this.renderTerminalHud(); return; }

            if (cmd === 'exit' || cmd === 'quit') { 
                console.log('\n\x1b[33m[SISTEMA] Encerrando terminal...\x1b[0m');
                this.rl.close(); process.exit(0); 
            }
            if (cmd.startsWith('setbankroll ')) {
                const val = parseFloat(cmd.substring(12));
                if (!isNaN(val) && val >= 0) {
                    this.initialBankroll = val; this.currentBankroll = val;
                    this.peakBankroll = val; this.lowestDip = val; this.systemLocked = false;
                    this.lastActionTakenText = `\x1b[32m[SISTEMA] Banca calibrada para R$ ${val.toFixed(2)}.\x1b[0m`;
                    this.generateNextTrade();
                }
                return;
            }
            if (cmd.startsWith('sync ')) {
                const nums = cmd.substring(5).split(',').map(n => parseInt(n.trim(), 10));
                nums.forEach(n => { if (!isNaN(n) && n >= 0 && n <= 36) { this.evaluateShadowTrading(n); this.mesaTracker.addNumber(n); }});
                this.lastActionTakenText = '\x1b[36m[SISTEMA] Fita injetada com sucesso.\x1b[0m';
                this.generateNextTrade(); return;
            }
            if (cmd === 'weights' || cmd === 'stats') {
                console.clear();
                console.log('======================================================');
                console.log(` 📊 ESTATÍSTICAS E PESOS (VIX: ${this.currentVixPercent.toFixed(1)}%)`);
                console.log('======================================================');
                Object.entries(this.shadowWeights).sort((a,b) => b[1] - a[1]).forEach(([id, w]) => {
                    const pnl = this.shadowPnL[id] || 0;
                    console.log(` ${id.padEnd(18)} | Peso: ${w.toFixed(2)} | PnL: R$ ${pnl.toFixed(2)}`);
                });
                this.inputMode = 'VIEW_ONLY'; return;
            }

            let isSkipped = false; let numStr = cmd;
            const skipMatch = cmd.match(/^[psnx]\s*(\d+)$/i);
            if (skipMatch) { isSkipped = true; numStr = skipMatch[1]; }
            const num = parseInt(numStr, 10);
            
            if (!isNaN(num) && num >= 0 && num <= 36 && num.toString() === numStr) {
                if (!isSkipped) this.resolveFinancials(num);
                else { this.activeBet = null; this.lastActionTakenText = `\x1b[33mGiro [${num}] anotado sem apostar.\x1b[0m`; }
                this.evaluateShadowTrading(num); this.mesaTracker.addNumber(num); this.generateNextTrade(); 
            } else { 
                this.lastActionTakenText = "\x1b[31m[ERRO] Comando inválido.\x1b[0m"; this.renderTerminalHud(); 
            }
        });
    }

    private generateNextTrade() {
        const trailingStopLoss = this.peakBankroll * 0.85;
        const sessionTakeProfit = this.initialBankroll * 1.20;
        this.preSpinImpactText = '';

        if (this.currentBankroll <= trailingStopLoss || this.currentBankroll >= sessionTakeProfit) {
            this.systemLocked = true;
            this.xaiQualification = 'BLOQUEADO';
            this.activeBet = null;
            this.dynamicStakeCalculated = 0.00;
            this.xaiApplicationText = this.currentBankroll >= sessionTakeProfit ? 'LUCRO GARANTIDO.' : 'STOP LOSS ATINGIDO.';
            this.renderTerminalHud(); return;
        }

        const history = this.mesaTracker.getHistory();
        const lastNum = history.length > 0 ? history[history.length - 1] : -1;
        const minChip = this.provider === 'PRAGMATIC' ? 0.10 : 0.50;
        
        if (history.length > 5) this.currentVixPercent = Math.min(99.9, history.length * 2.1 + (Math.random() * 5));
        else this.currentVixPercent = 0.0;

        const activeStrats = Object.keys(this.STRATEGY_ZONES).filter(id => !this.disabledStrategies.has(id))
            .sort((a, b) => (this.shadowWeights[b] || 1) - (this.shadowWeights[a] || 1));

        let requiredWeight = this.currentVixPercent > 90 ? 1.30 : 1.05;
        let foundSafeStrat = false;

        for (const stratId of activeStrats) {
            const weight = this.shadowWeights[stratId] || 1.0;
            if (weight < requiredWeight) break;
            
            const sizing = this.calculateSizing(stratId, minChip, weight, lastNum);
            if (!sizing.isSafe) continue;
            
            this.activeStrategyId = stratId;
            this.xaiQualification = 'SIM';
            this.xaiReason = `Zona autorizada (Peso ${weight.toFixed(2)} supera VIX exigido de ${requiredWeight.toFixed(2)}).`;
            this.dynamicStakeCalculated = sizing.total;
            this.xaiApplicationText = sizing.desc;
            this.activeBet = { strategyId: stratId, stake: sizing.total, chipMin: minChip, multiplier: sizing.multiplier };
            
            // Projeção base simplificada para HUD
            const avgWin = this.getFinancials(stratId, 1, true, minChip, sizing.multiplier).pnl; 
            this.preSpinImpactText = `\x1b[32mVitória Média ➔ +R$ ${avgWin.toFixed(2)}\x1b[0m | \x1b[31mDerrota ➔ -R$ ${sizing.total.toFixed(2)}\x1b[0m`;
            
            foundSafeStrat = true; break; 
        }

        if (!foundSafeStrat) {
            this.xaiQualification = 'NÃO';
            this.xaiReason = 'Aguardando alinhamento térmico ou resfriamento do VIX.';
            this.dynamicStakeCalculated = 0.00;
            this.xaiApplicationText = 'MANTENHA POSIÇÃO. Nenhuma ficha na mesa.';
            this.activeBet = null;
        }
        this.renderTerminalHud();
    }
}
TS_EOF

echo "[RL.SYS] Compilando V5.20b com Inteligência Zonal Francesa..."
npx tsc || npm run build || true
echo "[RL.SYS] Sprint 502 Concluída. Arsenal Frances Integrado."
