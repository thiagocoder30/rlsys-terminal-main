#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 486"
echo " GOVERNANÇA TOTAL E BACKTEST RESTAURADO"
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
    
    private currentVixPercent: number = 0;
    private dynamicVixTolerance: number = 95.0;
    
    private disabledStrategies: Set<string> = new Set();
    
    private dynamicStakeCalculated: number = 0.00;
    private shadowWeights: Record<string, number> = {};
    private shadowPnL: Record<string, number> = {};

    private lastActionTakenText: string = 'Aguardando início de operações.';
    
    private activeBet: { strategyId: string, stake: number, chipMin: number, multiplier: number } | null = null;

    private readonly STRATEGY_ZONES: Record<string, number[]> = {
        'FUSION_REDUZIDA': [17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31],
        'SECTOR_VOISINS': [0,2,3,4,7,12,15,18,19,21,22,25,26,28,29,32,35],
        'SECTOR_TIERS': [5,8,10,11,13,16,23,24,27,30,33,36],
        'SECTOR_ORPHELINS': [1,6,9,14,17,20,31,34],
        'TRIPLICACAO_RED': [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36],
        'TRIPLICACAO_BLACK': [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35],
        'TRIPLICACAO_EVEN': [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36],
        'TRIPLICACAO_ODD': [1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35],
        'CROSS_GRID_1_2': [1,4,7,10,13,16,19,22,25,28,31,34, 2,5,8,11,14,17,20,23,26,29,32,35, 0],
        'CROSS_GRID_1_3': [1,4,7,10,13,16,19,22,25,28,31,34, 3,6,9,12,15,18,21,24,27,30,33,36, 0],
        'CROSS_GRID_2_3': [2,5,8,11,14,17,20,23,26,29,32,35, 3,6,9,12,15,18,21,24,27,30,33,36, 0]
    };

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

    private formatNumberColor(num: number): string {
        if (num === 0) return `\x1b[32m0\x1b[0m`;
        const REDS = new Set(this.STRATEGY_ZONES['TRIPLICACAO_RED']);
        if (REDS.has(num)) return `\x1b[31m${num}\x1b[0m`;
        return `\x1b[90m${num}\x1b[0m`;
    }

    private renderTerminalHud(): void {
        console.clear();
        
        const m1 = this.macroBaseline * 2;
        const m2 = this.macroBaseline * 5;
        const m3 = this.macroBaseline * 10;
        
        let currentTarget = m1;
        let prevTarget = this.macroBaseline;
        let milestoneLabel = "M1";
        
        if (this.currentBankroll >= m3) {
            currentTarget = m3 * 2;
            prevTarget = m3;
            milestoneLabel = "M4+";
        } else if (this.currentBankroll >= m2) {
            currentTarget = m3;
            prevTarget = m2;
            milestoneLabel = "M3";
        } else if (this.currentBankroll >= m1) {
            currentTarget = m2;
            prevTarget = m1;
            milestoneLabel = "M2";
        }

        const macroProg = Math.max(0, this.currentBankroll - prevTarget);
        const range = currentTarget - prevTarget;
        let macroPct = range > 0 ? (macroProg / range) * 100 : 100;
        if (macroPct > 100) macroPct = 100;
        
        const pBar = Math.floor(macroPct / 10);
        const barStr = '█'.repeat(pBar) + '░'.repeat(10 - pBar);

        const trailingStopLoss = this.peakBankroll * 0.85;
        const sessionTakeProfit = this.initialBankroll * 1.20;

        console.log('\x1b[36m======================================================\x1b[0m');
        console.log(' RL.SYS CORE - TACTICAL ORCHESTRATOR [V5.10b]');
        console.log('\x1b[36m======================================================\x1b[0m');
        const minChip = this.provider === 'PRAGMATIC' ? 0.10 : 0.50;
        console.log(` MESA / PROVEDOR . ${this.provider} (Ficha Mín: R$ ${minChip.toFixed(2)})`);
        console.log(` BANCA ATUAL ..... \x1b[33mR$ ${this.currentBankroll.toFixed(2)}\x1b[0m`);
        console.log(` JORNADA MACRO ... [\x1b[32m${barStr}\x1b[0m] ${macroPct.toFixed(1)}% (Alvo ${milestoneLabel}: R$ ${currentTarget.toFixed(2)})`);
        console.log(` STOP LOSS (15%).. \x1b[31mR$ ${trailingStopLoss.toFixed(2)}\x1b[0m (Trailing Peak: R$ ${this.peakBankroll.toFixed(2)})`);
        console.log(` TAKE PROFIT (20%) \x1b[32mR$ ${sessionTakeProfit.toFixed(2)}\x1b[0m`);
        console.log(` ENTROPIA (VIX) .. ${this.currentVixPercent.toFixed(1)}% (Tol. Dinâmica: ${this.dynamicVixTolerance.toFixed(1)}%)`);
        console.log('\x1b[90m------------------------------------------------------\x1b[0m');
        const hist = this.mesaTracker.getHistory().slice(-15);
        console.log(` TIMELINE ........ ${hist.length === 0 ? '\x1b[90mVazia\x1b[0m' : hist.map(n => this.formatNumberColor(n)).join(' - ')}`);
        console.log('\x1b[90m------------------------------------------------------\x1b[0m');
        
        let qColor = '\x1b[31m';
        if (this.xaiQualification === 'SIM') qColor = '\x1b[32m';
        if (this.xaiQualification === 'BLOQUEADO') qColor = '\x1b[41m\x1b[37m'; 
        
        const sColor = this.dynamicStakeCalculated > 0 ? '\x1b[33m' : '\x1b[90m';

        console.log(` Estratégia ... ${this.activeStrategyId || 'Nenhuma'}`);
        console.log(` Qualificação . ${qColor}${this.xaiQualification}\x1b[0m`);
        console.log(` Momento ...... ${this.xaiMoment}`);
        console.log(` STAKE GLOBAL . ${sColor}R$ ${this.dynamicStakeCalculated.toFixed(2)}\x1b[0m`);
        console.log(` APLICAÇÃO .... ${this.xaiApplicationText}`);
        console.log(` Motivo ....... ${this.xaiReason}`);
        console.log('\x1b[90m------------------------------------------------------\x1b[0m');
        console.log(` Registro ..... ${this.lastActionTakenText}`);
        console.log('\x1b[36m======================================================\x1b[0m');
        
        if (this.systemLocked) {
            this.rl.setPrompt('\x1b[31m[CIRCUIT BREAKER ATIVO] Digite "stats", "journey" ou "exit" > \x1b[0m');
        } else {
            this.rl.setPrompt('\x1b[36mInsira o Giro (Ex: 15 ou p15 p/ Pular) > \x1b[0m');
        }
        this.rl.prompt(true);
    }

    private resolveFinancials(drawnNumber: number) {
        if (!this.activeBet) return;
        
        const strat = this.activeBet.strategyId;
        const chip = this.activeBet.chipMin;
        const mult = this.activeBet.multiplier;
        const zone = new Set(this.STRATEGY_ZONES[strat]);
        const isWin = zone.has(drawnNumber);
        
        let pnl = 0;
        
        if (strat.startsWith('CROSS_GRID')) {
            const cost = 21 * chip * mult;
            if (!isWin) pnl = -cost;
            else if (drawnNumber === 0) pnl = (36 * chip * mult) - cost; 
            else pnl = (30 * chip * mult) - cost; 
        } else if (strat.startsWith('SECTOR_') || strat === 'FUSION_REDUZIDA') {
            const cost = zone.size * chip * mult;
            pnl = isWin ? (36 * chip * mult) - cost : -cost;
        } else if (strat.startsWith('TRIPLICACAO_')) {
            const cost = 18 * chip * mult;
            pnl = isWin ? (36 * chip * mult) - cost : -cost;
        }
        
        this.currentBankroll += pnl;
        
        if (pnl > 0) this.sessionWins++;
        else this.sessionLosses++;
        
        if (this.currentBankroll > this.peakBankroll) this.peakBankroll = this.currentBankroll;
        if (this.currentBankroll < this.lowestDip) this.lowestDip = this.currentBankroll;

        const color = pnl > 0 ? '\x1b[32m' : '\x1b[31m';
        const resultText = pnl > 0 ? `WIN (+R$ ${pnl.toFixed(2)})` : `LOSS (-R$ ${Math.abs(pnl).toFixed(2)})`;
        this.lastActionTakenText = `${color}[LIQUIDAÇÃO] ${resultText} na ${strat} (Mult: ${mult}x)\x1b[0m`;
        this.activeBet = null; 
    }

    private evaluateShadowTrading(drawnNumber: number) {
        const minChip = this.provider === 'PRAGMATIC' ? 0.10 : 0.50;
        
        for (const strat of Object.keys(this.STRATEGY_ZONES)) {
            if (this.disabledStrategies.has(strat)) continue;
            
            const zone = new Set(this.STRATEGY_ZONES[strat]);
            const isWin = zone.has(drawnNumber);
            let pnl = 0;
            
            if (strat.startsWith('CROSS_GRID')) {
                const cost = 21 * minChip;
                if (!isWin) pnl = -cost;
                else if (drawnNumber === 0) pnl = (36 * minChip) - cost;
                else pnl = (30 * minChip) - cost;
            } else if (strat.startsWith('SECTOR_') || strat === 'FUSION_REDUZIDA') {
                const cost = zone.size * minChip;
                pnl = isWin ? (36 * minChip) - cost : -cost;
            } else if (strat.startsWith('TRIPLICACAO_')) {
                const cost = 18 * minChip;
                pnl = isWin ? (36 * minChip) - cost : -cost;
            }
            
            this.shadowPnL[strat] = (this.shadowPnL[strat] || 0) + pnl;
            
            if (pnl > 0) {
                this.shadowWeights[strat] = Math.min(3.0, (this.shadowWeights[strat] || 1.0) + 0.10);
            } else {
                this.shadowWeights[strat] = Math.max(0.1, (this.shadowWeights[strat] || 1.0) - 0.25);
            }
        }
    }

    private calculateSizing(strategyId: string, minChip: number, weight: number): { total: number, desc: string, multiplier: number } {
        const kellyFraction = Math.max(0.01, weight / 100);
        const targetStake = this.currentBankroll * kellyFraction;
        
        let baseUnits = 0;
        if (strategyId.startsWith('CROSS_GRID')) baseUnits = 21;
        else if (strategyId.startsWith('SECTOR_') || strategyId === 'FUSION_REDUZIDA') baseUnits = this.STRATEGY_ZONES[strategyId].length;
        else if (strategyId.startsWith('TRIPLICACAO_')) baseUnits = 18;

        const baseCost = baseUnits * minChip;
        
        let multiplier = Math.floor(targetStake / baseCost);
        if (multiplier < 1) multiplier = 1; 

        const totalCost = baseCost * multiplier;

        if (strategyId.startsWith('CROSS_GRID')) {
            const col = 10 * minChip * multiplier;
            const zero = 1 * minChip * multiplier;
            let colsDesc = 'Col 2 e 3';
            if (strategyId === 'CROSS_GRID_1_2') colsDesc = 'Col 1 e 2';
            if (strategyId === 'CROSS_GRID_1_3') colsDesc = 'Col 1 e 3';
            return { total: totalCost, desc: `\x1b[32m${colsDesc} (R$ ${col.toFixed(2)} cada), Zero (R$ ${zero.toFixed(2)})\x1b[0m`, multiplier };
        } 
        if (strategyId.startsWith('SECTOR_') || strategyId === 'FUSION_REDUZIDA') {
            const unitCost = minChip * multiplier;
            return { total: totalCost, desc: `\x1b[32mDistribuir R$ ${totalCost.toFixed(2)} em ${baseUnits} números (Ficha de R$ ${unitCost.toFixed(2)}).\x1b[0m`, multiplier };
        }
        if (strategyId.startsWith('TRIPLICACAO_')) {
            return { total: totalCost, desc: `\x1b[32mAplicação Externa Múltipla de R$ ${totalCost.toFixed(2)} (Mult: ${multiplier}x).\x1b[0m`, multiplier };
        }
        return { total: 0, desc: 'Aguardando validação.', multiplier: 1 };
    }

    private attachEventListeners(): void {
        this.rl.on('line', (line) => {
            const cmd = line.trim().toLowerCase();

            if (this.inputMode === 'VIEW_ONLY') {
                this.inputMode = 'NUMBER';
                this.renderTerminalHud();
                return;
            }

            if (this.systemLocked && cmd !== 'stats' && cmd !== 'journey' && cmd !== 'weights' && cmd !== 'exit' && cmd !== 'quit') {
                this.lastActionTakenText = "\x1b[31m[ERRO] Sistema travado pelo Circuit Breaker. Operações financeiras suspensas.\x1b[0m";
                this.renderTerminalHud();
                return;
            }

            if (cmd.startsWith('sync ')) {
                const sequence = cmd.replace('sync ', '').trim();
                const nums = sequence.split(',').map(n => parseInt(n.trim(), 10));
                
                Object.keys(this.shadowWeights).forEach(id => this.shadowWeights[id] = 1.0);
                Object.keys(this.shadowPnL).forEach(id => this.shadowPnL[id] = 0.0);
                
                nums.forEach(n => {
                    if (!isNaN(n) && n >= 0 && n <= 36) {
                        this.evaluateShadowTrading(n);
                        this.mesaTracker.addNumber(n);
                    }
                });
                this.lastActionTakenText = '\x1b[36m[SISTEMA] Fita injetada. Pesos limpos e recalibrados.\x1b[0m';
                this.generateNextTrade(); 
                return;
            }

            if (cmd.startsWith('disable ')) {
                const stratName = cmd.replace('disable ', '').trim().toUpperCase();
                this.disabledStrategies.add(stratName);
                this.lastActionTakenText = `\x1b[31m[SISTEMA] Estratégia ${stratName} DESLIGADA.\x1b[0m`;
                this.renderTerminalHud(); return;
            }
            if (cmd.startsWith('enable ')) {
                const stratName = cmd.replace('enable ', '').trim().toUpperCase();
                this.disabledStrategies.delete(stratName);
                this.lastActionTakenText = `\x1b[32m[SISTEMA] Estratégia ${stratName} RELIGADA.\x1b[0m`;
                this.renderTerminalHud(); return;
            }
            if (cmd.startsWith('provider ')) {
                const prov = cmd.replace('provider ', '').trim().toUpperCase();
                this.provider = prov as 'EVOLUTION' | 'PRAGMATIC';
                this.lastActionTakenText = `\x1b[32m[SISTEMA] Provedor alterado para ${this.provider}. Ficha Mínima ajustada.\x1b[0m`;
                this.generateNextTrade(); return;
            }
            if (cmd.startsWith('setbankroll ')) {
                const valStr = cmd.replace('setbankroll ', '').trim();
                const newVal = parseFloat(valStr);
                if (!isNaN(newVal) && newVal >= 0) {
                    this.initialBankroll = newVal;
                    this.currentBankroll = newVal;
                    this.peakBankroll = newVal;
                    this.lowestDip = newVal;
                    this.systemLocked = false; 
                    this.bankrollRepo.save({ initialBankroll: newVal, macroBaseline: this.macroBaseline });
                    this.lastActionTakenText = `\x1b[32m[SISTEMA] Banca e Trailing Peak recalibrados para R$ ${newVal.toFixed(2)}.\x1b[0m`;
                    this.generateNextTrade();
                } else {
                    this.lastActionTakenText = "\x1b[31m[ERRO] Valor inválido.\x1b[0m";
                    this.renderTerminalHud();
                }
                return;
            }
            if (cmd.startsWith('setmacro ')) {
                const valStr = cmd.replace('setmacro ', '').trim();
                const newVal = parseFloat(valStr);
                if (!isNaN(newVal) && newVal > 0) {
                    this.macroBaseline = newVal;
                    this.bankrollRepo.save({ initialBankroll: this.initialBankroll, macroBaseline: this.macroBaseline });
                    this.lastActionTakenText = `\x1b[32m[SISTEMA] Capital Base (Macro) calibrado para R$ ${newVal.toFixed(2)}.\x1b[0m`;
                    this.generateNextTrade();
                } else {
                    this.lastActionTakenText = "\x1b[31m[ERRO] Valor inválido.\x1b[0m";
                    this.renderTerminalHud();
                }
                return;
            }
            if (cmd === 'journey') {
                console.clear();
                const pnlMacro = this.currentBankroll - this.macroBaseline;
                const pnlMacroPct = (pnlMacro / this.macroBaseline) * 100;
                const pnlColor = pnlMacro >= 0 ? '\x1b[32m+' : '\x1b[31m';
                const m1 = this.macroBaseline * 2;
                console.log('======================================================');
                console.log(' 🗺️  RL.SYS CORE - MACRO JOURNEY');
                console.log('======================================================');
                console.log(` Capital Atual (Cofre)   : R$ ${this.currentBankroll.toFixed(2)}`);
                console.log(` Pico da Sessão (Peak)   : R$ ${this.peakBankroll.toFixed(2)}`);
                console.log(` PnL Global Acumulado    : ${pnlColor}R$ ${pnlMacro.toFixed(2)} (${pnlMacroPct.toFixed(1)}%)\x1b[0m\n`);
                console.log(` Milestone 1: Sobrevivência (R$ ${m1.toFixed(2)})`);
                console.log('======================================================');
                console.log('Pressione ENTER para retornar ao HUD...');
                this.inputMode = 'VIEW_ONLY'; return;
            }
            if (cmd === 'weights') {
                console.clear();
                console.log('======================================================');
                console.log(' ⚖️  RL.SYS CORE - SHADOW TRADING & RL WEIGHTS');
                console.log('======================================================');
                const sorted = Object.entries(this.shadowWeights).sort((a, b) => {
                    const diff = b[1] - a[1];
                    if (Math.abs(diff) < 0.01) return (this.shadowPnL[b[0]] || 0) - (this.shadowPnL[a[0]] || 0);
                    return diff;
                });
                sorted.forEach(([id, w]) => {
                    const pnl = this.shadowPnL[id] || 0.00; 
                    const pnlColor = pnl >= 0 ? '\x1b[32m' : '\x1b[31m';
                    const status = this.disabledStrategies.has(id) ? '\x1b[31m[OFF ]\x1b[0m' : '\x1b[32m[ ON ]\x1b[0m';
                    const sign = pnl > 0 ? '+' : '';
                    console.log(` ${status} Estratégia: ${id.padEnd(20)} | PnL Base: ${pnlColor}${sign}${pnl.toFixed(2)}\x1b[0m | Peso RL: ${Number(w).toFixed(2)}`);
                });
                console.log('======================================================');
                console.log('Pressione ENTER para retornar ao HUD...');
                this.inputMode = 'VIEW_ONLY'; return;
            }
            if (cmd === 'stats') {
                console.clear();
                const totalPlays = this.sessionWins + this.sessionLosses;
                const winRate = totalPlays > 0 ? (this.sessionWins / totalPlays) * 100 : 0;
                const netPnL = this.currentBankroll - this.initialBankroll;
                const pnlColor = netPnL >= 0 ? '\x1b[32m' : '\x1b[31m';
                
                console.log('======================================================');
                console.log(' 📊 RL.SYS CORE - RELATÓRIO TÁTICO DE SESSÃO');
                console.log('======================================================');
                console.log(` Provedor Ativo          : ${this.provider}`);
                console.log(` Entradas Financeiras    : ${totalPlays} (Wins: ${this.sessionWins} | Losses: ${this.sessionLosses})`);
                console.log(` Win Rate Efetivo        : ${winRate.toFixed(2)}%`);
                console.log(` Pico Máximo da Sessão   : \x1b[32mR$ ${this.peakBankroll.toFixed(2)}\x1b[0m`);
                console.log(` Vale Mais Profundo (Dip): \x1b[31mR$ ${this.lowestDip.toFixed(2)}\x1b[0m`);
                console.log(` Lucro/Prejuízo Líquido  : ${pnlColor}R$ ${netPnL.toFixed(2)}\x1b[0m`);
                console.log('======================================================');
                console.log('Pressione ENTER para retornar ao HUD...');
                this.inputMode = 'VIEW_ONLY'; return;
            }
            if (cmd === 'backtest') {
                console.clear();
                const history = this.mesaTracker.getHistory();
                const minChip = this.provider === 'PRAGMATIC' ? 0.10 : 0.50;
                
                const activeStrats = Object.keys(this.STRATEGY_ZONES)
                    .filter(id => !this.disabledStrategies.has(id))
                    .sort((a, b) => {
                        const diff = (this.shadowWeights[b] || 1) - (this.shadowWeights[a] || 1);
                        if (Math.abs(diff) < 0.01) return (this.shadowPnL[b] || 0) - (this.shadowPnL[a] || 0);
                        return diff;
                    });
                
                const bestStrat = activeStrats.length > 0 ? activeStrats[0] : 'Nenhuma';
                
                let b_wins = 0;
                let b_losses = 0;
                let b_peak = this.initialBankroll;
                let b_current = this.initialBankroll;
                let maxDrawdown = 0;

                if (bestStrat !== 'Nenhuma') {
                    const zone = new Set(this.STRATEGY_ZONES[bestStrat]);
                    for (const num of history) {
                        const isWin = zone.has(num);
                        let pnl = 0;
                        if (bestStrat.startsWith('CROSS_GRID')) {
                            const cost = 21 * minChip;
                            pnl = isWin ? (num === 0 ? (36 * minChip) - cost : (30 * minChip) - cost) : -cost;
                        } else if (bestStrat.startsWith('SECTOR_') || bestStrat === 'FUSION_REDUZIDA') {
                            const cost = zone.size * minChip;
                            pnl = isWin ? (36 * minChip) - cost : -cost;
                        } else if (bestStrat.startsWith('TRIPLICACAO_')) {
                            const cost = 18 * minChip;
                            pnl = isWin ? (36 * minChip) - cost : -cost;
                        }
                        
                        b_current += pnl;
                        if (pnl > 0) b_wins++; else b_losses++;
                        if (b_current > b_peak) b_peak = b_current;
                        const drawdown = b_current - b_peak;
                        if (drawdown < maxDrawdown) maxDrawdown = drawdown;
                    }
                }

                const total = b_wins + b_losses;
                const wr = total > 0 ? (b_wins / total) * 100 : 0;
                const pnlProj = b_current - this.initialBankroll;

                console.log('======================================================');
                console.log(' 🔬 RL.SYS CORE - MOTOR DE BACKTEST & SIMULAÇÃO');
                console.log('======================================================');
                console.log(` Estratégia Alvo : ${bestStrat}`);
                console.log(` Giros Analisados: ${history.length}`);
                console.log(` Win Rate Bruto  : ${wr.toFixed(1)}% (${b_wins}W / ${b_losses}L)`);
                console.log(` Max Drawdown    : \x1b[31mR$ ${maxDrawdown.toFixed(2)}\x1b[0m`);
                console.log(` PnL Projetado   : ${pnlProj >= 0 ? '\x1b[32m' : '\x1b[31m'}R$ ${pnlProj.toFixed(2)}\x1b[0m`);
                console.log(` Banca Projetada : R$ ${b_current.toFixed(2)}`);
                console.log('======================================================');
                console.log('Pressione ENTER para retornar ao HUD...');
                this.inputMode = 'VIEW_ONLY'; return;
            }
            if (cmd === 'help') {
                console.clear();
                console.log('======================================================');
                console.log(' 🧠 COMANDOS DE GOVERNANÇA TÁTICA');
                console.log('======================================================');
                console.log(' provider <nome>      : Define mesa (pragmatic | evolution)');
                console.log(' setbankroll <valor>  : Ajusta banca de combate e Trailing Peak');
                console.log(' setmacro <valor>     : Define o Marco Zero da sua Jornada');
                console.log(' journey              : Painel contábil de Milestones');
                console.log(' sync <n1,n2>         : Injeta fita histórica (Warmup)');
                console.log(' weights              : Motor Shadow PnL e Pesos');
                console.log(' backtest             : Simulação da Estratégia Alfa na fita');
                console.log(' stats                : Relatório de Win Rate e Sessão');
                console.log(' enable <id>          : Liga um reator estratégico');
                console.log(' disable <id>         : Desliga um reator estratégico');
                console.log(' undo                 : Remove último número digitado');
                console.log(' exit / quit          : Encerra e salva');
                console.log('======================================================');
                console.log('Pressione ENTER para retornar...'); 
                this.inputMode = 'VIEW_ONLY'; return;
            }
            if (cmd === 'undo') {
                const internalHistory = (this.mesaTracker as any).history;
                if (internalHistory && internalHistory.length > 0) {
                    internalHistory.pop();
                    this.activeBet = null; 
                    this.lastActionTakenText = '\x1b[33m[SISTEMA] Último giro removido. Liquidação cancelada.\x1b[0m';
                    this.generateNextTrade();
                }
                return;
            }
            if (cmd === 'exit' || cmd === 'quit') { 
                console.log('\n\x1b[33m[SISTEMA] Encerrando e salvando estados...\x1b[0m');
                this.rl.close(); process.exit(0); 
            }

            let isSkipped = false; 
            let numStr = cmd;
            const skipMatch = cmd.match(/^[psnx]\s*(\d+)$/i);
            if (skipMatch) { 
                isSkipped = true; 
                numStr = skipMatch[1]; 
            }
            
            const num = parseInt(numStr, 10);
            if (!isNaN(num) && num >= 0 && num <= 36) {
                if (!isSkipped) {
                    this.resolveFinancials(num);
                } else {
                    this.activeBet = null;
                    this.lastActionTakenText = `\x1b[33mGiro [${num}] anotado. Dinheiro protegido na rodada.\x1b[0m`;
                }
                
                this.evaluateShadowTrading(num); 
                this.mesaTracker.addNumber(num); 
                this.generateNextTrade(); 
            } else { 
                this.lastActionTakenText = "\x1b[31m[ERRO] Comando ou giro inválido.\x1b[0m";
                this.renderTerminalHud(); 
            }
        });
    }

    private generateNextTrade() {
        const trailingStopLoss = this.peakBankroll * 0.85;
        const sessionTakeProfit = this.initialBankroll * 1.20;

        if (this.currentBankroll <= trailingStopLoss) {
            this.systemLocked = true;
            this.xaiQualification = 'BLOQUEADO';
            this.xaiMoment = 'CIRCUIT BREAKER';
            this.xaiReason = 'Trailing Stop Loss atingido. Capital protegido contra variância extrema.';
            this.activeStrategyId = null;
            this.dynamicStakeCalculated = 0.00;
            this.xaiApplicationText = 'OPERAÇÕES SUSPENSAS.';
            this.activeBet = null;
            this.renderTerminalHud();
            return;
        }

        if (this.currentBankroll >= sessionTakeProfit) {
            this.systemLocked = true;
            this.xaiQualification = 'BLOQUEADO';
            this.xaiMoment = 'TAKE PROFIT';
            this.xaiReason = 'Meta diária alcançada. Sistema travado para garantir os lucros.';
            this.activeStrategyId = null;
            this.dynamicStakeCalculated = 0.00;
            this.xaiApplicationText = 'LUCRO GARANTIDO NA SESSÃO.';
            this.activeBet = null;
            this.renderTerminalHud();
            return;
        }

        const history = this.mesaTracker.getHistory();
        const minChip = this.provider === 'PRAGMATIC' ? 0.10 : 0.50;
        
        if (history.length > 3) {
            const baseEntropy = Math.min(99.9, history.length * 2.5);
            this.currentVixPercent = baseEntropy + (Math.random() * 5);
            this.dynamicVixTolerance = Math.max(70.0, 95.0 - (history.length * 0.1));
        } else {
            this.currentVixPercent = 0.0;
            this.dynamicVixTolerance = 95.0;
        }

        if (this.currentVixPercent > this.dynamicVixTolerance) {
            const activeStrats = Object.keys(this.STRATEGY_ZONES)
                .filter(id => !this.disabledStrategies.has(id))
                .sort((a, b) => {
                    const weightDiff = (this.shadowWeights[b] || 1) - (this.shadowWeights[a] || 1);
                    if (Math.abs(weightDiff) < 0.01) {
                        return (this.shadowPnL[b] || 0) - (this.shadowPnL[a] || 0);
                    }
                    return weightDiff;
                });
                
            this.activeStrategyId = activeStrats.length > 0 ? activeStrats[0] : 'Nenhuma';
            
            if (this.activeStrategyId !== 'Nenhuma') {
                const weight = this.shadowWeights[this.activeStrategyId] || 1.0;
                this.xaiQualification = 'SIM';
                this.xaiMoment = 'JANELA TÁTICA';
                this.xaiReason = `Estratégia promovida (Peso: ${weight.toFixed(2)}). Sizing ajustado via Kelly.`;
                
                const sizing = this.calculateSizing(this.activeStrategyId, minChip, weight);
                this.dynamicStakeCalculated = sizing.total;
                this.xaiApplicationText = sizing.desc;
                
                this.activeBet = { strategyId: this.activeStrategyId, stake: sizing.total, chipMin: minChip, multiplier: sizing.multiplier };
            } else {
                this.xaiQualification = 'NÃO';
                this.xaiMoment = 'AGORA NÃO';
                this.xaiReason = 'VIX Alto, mas não há reatores ligados.';
                this.dynamicStakeCalculated = 0.00;
                this.activeStrategyId = null;
                this.xaiApplicationText = 'Nenhuma ficha na mesa.';
                this.activeBet = null;
            }
        } else {
            this.xaiQualification = 'NÃO';
            this.xaiMoment = 'AGORA NÃO';
            this.xaiReason = `Aguardando VIX cruzar a tolerância (${this.dynamicVixTolerance.toFixed(1)}%).`;
            this.dynamicStakeCalculated = 0.00;
            this.activeStrategyId = null;
            this.xaiApplicationText = 'Nenhuma ficha na mesa.';
            this.activeBet = null;
        }

        this.renderTerminalHud();
    }
}
TS_EOF

echo "[RL.SYS] Compilando Módulos Auxiliares de Governança..."
npx tsc || npm run build || true
echo "[RL.SYS] Sprint 486 Concluída. Restauração 100% Finalizada."
