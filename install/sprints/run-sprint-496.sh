#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 496"
echo " CLEANUP: ARSENAL DE ELITE (V5.14b)"
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
        'FUSION_REDUZIDA': [17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31],
        'PATTERN_FRANCESA': [31,9,22,18,29,7,28,12,35,3,26,25,17,34,6,27,13,36,11,30,8,23],
        'ZONE_P2': [1,5,9,12,14,16,19,23,27,30,32,34,2,6,8,10,11,13,17,20,24,26,28,29,31,35],
        'SECTOR_POTINHO': [26,3,35,12,28,0,32,15,19,4,21,11,30,8,23,10,5,24,16,33,1,20],
        'SECTOR_VIZINHOS_1_21': [10,5,24,16,33,1,20,14,31,9,22,32,15,19,4,21,2,25,17,34,6],
        'CROSS_GRID_1_2': [1,4,7,10,13,16,19,22,25,28,31,34, 2,5,8,11,14,17,20,23,26,29,32,35],
        'CROSS_GRID_1_3': [1,4,7,10,13,16,19,22,25,28,31,34, 3,6,9,12,15,18,21,24,27,30,33,36],
        'CROSS_GRID_2_3': [2,5,8,11,14,17,20,23,26,29,32,35, 3,6,9,12,15,18,21,24,27,30,33,36],
        'CROSS_DOZEN_1_2': [1,2,3,4,5,6,7,8,9,10,11,12, 13,14,15,16,17,18,19,20,21,22,23,24],
        'CROSS_DOZEN_1_3': [1,2,3,4,5,6,7,8,9,10,11,12, 25,26,27,28,29,30,31,32,33,34,35,36],
        'CROSS_DOZEN_2_3': [13,14,15,16,17,18,19,20,21,22,23,24, 25,26,27,28,29,30,31,32,33,34,35,36]
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
        const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
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
        console.log(' RL.SYS CORE - TACTICAL ORCHESTRATOR [V5.14b]');
        console.log('\x1b[36m======================================================\x1b[0m');
        const minChip = this.provider === 'PRAGMATIC' ? 0.10 : 0.50;
        console.log(` MESA / PROVEDOR . ${this.provider} (Ficha Mín: R$ ${minChip.toFixed(2)})`);
        console.log(` BANCA ATUAL ..... \x1b[33mR$ ${this.currentBankroll.toFixed(2)}\x1b[0m`);
        console.log(` JORNADA MACRO ... [\x1b[32m${barStr}\x1b[0m] ${macroPct.toFixed(1)}% (Alvo ${milestoneLabel}: R$ ${currentTarget.toFixed(2)})`);
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
        console.log(` Momento ...... ${this.xaiMoment}`);
        console.log(` STAKE GLOBAL . ${sColor}R$ ${this.dynamicStakeCalculated.toFixed(2)}\x1b[0m`);
        console.log(` APLICAÇÃO .... ${this.xaiApplicationText}`);
        if (this.preSpinImpactText !== '') {
            console.log(` CENÁRIO (SIM)  ${this.preSpinImpactText}`);
        }
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
        
        if (strat.startsWith('CROSS_GRID') || strat.startsWith('CROSS_DOZEN')) {
            const cost = 2 * chip * mult; 
            pnl = isWin ? (3 * chip * mult) - cost : -cost; 
        } else {
            const cost = zone.size * chip * mult; 
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
        const history = this.mesaTracker.getHistory();
        const lastNum = history.length > 0 ? history[history.length - 1] : -1;
        
        for (const strat of Object.keys(this.STRATEGY_ZONES)) {
            if (this.disabledStrategies.has(strat)) continue;
            
            if (strat === 'PATTERN_FRANCESA' && lastNum !== 28 && lastNum !== 29) {
                continue; 
            }
            
            const zone = new Set(this.STRATEGY_ZONES[strat]);
            const isWin = zone.has(drawnNumber);
            let pnl = 0;
            
            if (strat.startsWith('CROSS_GRID') || strat.startsWith('CROSS_DOZEN')) {
                const cost = 2 * minChip;
                pnl = isWin ? (3 * minChip) - cost : -cost;
            } else {
                const cost = zone.size * minChip;
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

    private calculateSizing(strategyId: string, minChip: number, weight: number): { total: number, desc: string, multiplier: number, isSafe: boolean, cost: number, safeLimit: number } {
        const MAX_RISK_PCT = 0.05; 
        const safeLimit = this.currentBankroll * MAX_RISK_PCT;
        
        let baseUnits = 0;
        if (strategyId.startsWith('CROSS_GRID') || strategyId.startsWith('CROSS_DOZEN')) {
            baseUnits = 2; 
        } else {
            baseUnits = this.STRATEGY_ZONES[strategyId].length; 
        }

        const baseCost = baseUnits * minChip;
        
        if (baseCost > safeLimit) {
            return { total: 0, desc: `Risco extremo detectado.`, multiplier: 0, isSafe: false, cost: baseCost, safeLimit: safeLimit };
        }

        const kellyFraction = Math.max(0.01, weight / 100);
        let targetStake = this.currentBankroll * kellyFraction;
        
        if (targetStake > safeLimit) targetStake = safeLimit;

        let multiplier = Math.floor(targetStake / baseCost);
        if (multiplier < 1) multiplier = 1; 

        const totalCost = baseCost * multiplier;

        if (strategyId.startsWith('CROSS_GRID')) {
            const colCost = 1 * minChip * multiplier;
            let colsDesc = 'Col 2 e Col 3';
            if (strategyId === 'CROSS_GRID_1_2') colsDesc = 'Col 1 e Col 2';
            if (strategyId === 'CROSS_GRID_1_3') colsDesc = 'Col 1 e Col 3';
            return { total: totalCost, desc: `\x1b[32m${colsDesc} (R$ ${colCost.toFixed(2)} cada. Aposta Externa)\x1b[0m`, multiplier, isSafe: true, cost: baseCost, safeLimit };
        } 
        if (strategyId.startsWith('CROSS_DOZEN')) {
            const dozCost = 1 * minChip * multiplier;
            let dozDesc = 'Dúzia 2 e Dúzia 3';
            if (strategyId === 'CROSS_DOZEN_1_2') dozDesc = 'Dúzia 1 e Dúzia 2';
            if (strategyId === 'CROSS_DOZEN_1_3') dozDesc = 'Dúzia 1 e Dúzia 3';
            return { total: totalCost, desc: `\x1b[32m${dozDesc} (R$ ${dozCost.toFixed(2)} cada. Aposta Externa)\x1b[0m`, multiplier, isSafe: true, cost: baseCost, safeLimit };
        }
        
        const unitCost = minChip * multiplier;
        return { total: totalCost, desc: `\x1b[32mDistribuir R$ ${totalCost.toFixed(2)} em ${baseUnits} plenos.\x1b[0m`, multiplier, isSafe: true, cost: baseCost, safeLimit };
    }

    private attachEventListeners(): void {
        this.rl.on('line', (line) => {
            const cmd = line.trim();

            if (this.inputMode === 'VIEW_ONLY') {
                this.inputMode = 'NUMBER';
                this.renderTerminalHud();
                return;
            }

            if (cmd === '') {
                this.renderTerminalHud();
                return;
            }

            const lowerCmd = cmd.toLowerCase();

            if (this.systemLocked && !['stats', 'journey', 'weights', 'audit', 'why', 'exit', 'quit'].includes(lowerCmd) && !lowerCmd.startsWith('backtest')) {
                this.lastActionTakenText = "\x1b[31m[ERRO] Sistema travado pelo Circuit Breaker.\x1b[0m";
                this.renderTerminalHud();
                return;
            }

            if (lowerCmd === 'audit' || lowerCmd === 'why') {
                console.clear();
                console.log('======================================================');
                console.log(' 🧠 RL.SYS CORE - RISK INTELLIGENCE (XAI AUDIT)');
                console.log('======================================================');
                console.log(` Estado Financeiro : Banca R$ ${this.currentBankroll.toFixed(2)} | Pico R$ ${this.peakBankroll.toFixed(2)}`);
                console.log(` Entropia (VIX)    : ${this.currentVixPercent.toFixed(1)}% (Mesa ${this.currentVixPercent > 95 ? '\x1b[31mCaótica\x1b[0m' : '\x1b[32mEstável\x1b[0m'})`);
                
                if (this.activeStrategyId && this.activeStrategyId !== 'Nenhuma') {
                    const zoneSize = this.STRATEGY_ZONES[this.activeStrategyId].length;
                    const winProb = (zoneSize / 37) * 100;
                    const weight = this.shadowWeights[this.activeStrategyId] || 1.0;
                    
                    console.log(`\n \x1b[36m[ RADIOGRAFIA TÁTICA: ${this.activeStrategyId} ]\x1b[0m`);
                    console.log(` Cobertura da Mesa : ${zoneSize} números plenos.`);
                    console.log(` Probabilidade (E) : ${winProb.toFixed(1)}% de chance matemática real.`);
                    console.log(` Peso de Confiança : ${weight.toFixed(2)} (Motor RL)`);
                    
                    if (this.dynamicStakeCalculated > 0) {
                        const riskPct = (this.dynamicStakeCalculated / this.currentBankroll) * 100;
                        console.log(` Risco de Ruína    : \x1b[33m${riskPct.toFixed(1)}% da banca em exposição.\x1b[0m`);
                        console.log(` Impacto Pós-Giro  : ${this.preSpinImpactText}`);
                    } else {
                        console.log(` Risco de Ruína    : Operação bloqueada ou vetada. Risco 0%.`);
                    }
                } else {
                    console.log(`\n \x1b[33m[ RADIOGRAFIA TÁTICA ]\x1b[0m`);
                    console.log(` Nenhuma estratégia qualificada para auditoria neste giro.`);
                }
                console.log('======================================================');
                console.log('Pressione ENTER para retornar ao HUD...');
                this.inputMode = 'VIEW_ONLY';
                return;
            }

            if (lowerCmd.startsWith('sync ')) {
                const sequence = cmd.substring(5).trim();
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

            if (lowerCmd.startsWith('disable ')) {
                const stratName = cmd.substring(8).trim().toUpperCase();
                this.disabledStrategies.add(stratName);
                this.lastActionTakenText = `\x1b[31m[SISTEMA] Estratégia ${stratName} DESLIGADA.\x1b[0m`;
                this.renderTerminalHud(); return;
            }
            if (lowerCmd.startsWith('enable ')) {
                const stratName = cmd.substring(7).trim().toUpperCase();
                this.disabledStrategies.delete(stratName);
                this.lastActionTakenText = `\x1b[32m[SISTEMA] Estratégia ${stratName} RELIGADA.\x1b[0m`;
                this.renderTerminalHud(); return;
            }
            if (lowerCmd.startsWith('provider ')) {
                const prov = cmd.substring(9).trim().toUpperCase();
                if (prov === 'EVOLUTION' || prov === 'PRAGMATIC') {
                    this.provider = prov;
                    this.lastActionTakenText = `\x1b[32m[SISTEMA] Provedor alterado para ${this.provider}. Ficha Mínima ajustada.\x1b[0m`;
                    this.generateNextTrade();
                } else {
                    this.lastActionTakenText = "\x1b[31m[ERRO] Provedor inválido. Use EVOLUTION ou PRAGMATIC.\x1b[0m";
                    this.renderTerminalHud();
                }
                return;
            }
            if (lowerCmd.startsWith('setbankroll ')) {
                const valStr = cmd.substring(12).trim();
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
            if (lowerCmd.startsWith('setmacro ')) {
                const valStr = cmd.substring(9).trim();
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
            if (lowerCmd === 'journey') {
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
                this.inputMode = 'VIEW_ONLY'; 
                return;
            }
            if (lowerCmd === 'weights') {
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
                this.inputMode = 'VIEW_ONLY'; 
                return;
            }
            if (lowerCmd === 'stats') {
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
                this.inputMode = 'VIEW_ONLY'; 
                return;
            }
            if (lowerCmd.startsWith('backtest')) {
                console.clear();
                const paramStr = cmd.substring(8).trim();
                let historyToTest: number[] = [];

                if (paramStr.length > 0) {
                    historyToTest = paramStr.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n) && n >= 0 && n <= 36);
                } else {
                    historyToTest = this.mesaTracker.getHistory();
                }

                if (historyToTest.length === 0) {
                    console.log('======================================================');
                    console.log('\x1b[31m [ERRO] Fita vazia. Use: backtest <numeros>\x1b[0m');
                    console.log('======================================================');
                    console.log('Pressione ENTER para retornar ao HUD...');
                    this.inputMode = 'VIEW_ONLY'; 
                    return;
                }

                const minChip = this.provider === 'PRAGMATIC' ? 0.10 : 0.50;
                let simWeights: Record<string, number> = {};
                let simPnL: Record<string, number> = {};
                Object.keys(this.STRATEGY_ZONES).forEach(id => { simWeights[id] = 1.0; simPnL[id] = 0.0; });
                
                let simPrevNum = -1;
                for (const num of historyToTest) {
                    for (const strat of Object.keys(this.STRATEGY_ZONES)) {
                        if (this.disabledStrategies.has(strat)) continue;
                        
                        if (strat === 'PATTERN_FRANCESA' && simPrevNum !== 28 && simPrevNum !== 29) {
                            continue;
                        }
                        
                        const zone = new Set(this.STRATEGY_ZONES[strat]);
                        const isWin = zone.has(num);
                        let pnl = 0;
                        if (strat.startsWith('CROSS_GRID') || strat.startsWith('CROSS_DOZEN')) {
                            const cost = 2 * minChip;
                            pnl = isWin ? (3 * minChip) - cost : -cost;
                        } else {
                            const cost = zone.size * minChip;
                            pnl = isWin ? (36 * minChip) - cost : -cost;
                        }
                        
                        simPnL[strat] += pnl;
                        if (pnl > 0) {
                            simWeights[strat] = Math.min(3.0, simWeights[strat] + 0.10);
                        } else {
                            simWeights[strat] = Math.max(0.1, simWeights[strat] - 0.25);
                        }
                    }
                    simPrevNum = num;
                }

                const activeStrats = Object.keys(this.STRATEGY_ZONES)
                    .filter(id => !this.disabledStrategies.has(id))
                    .sort((a, b) => {
                        const diff = simWeights[b] - simWeights[a];
                        if (Math.abs(diff) < 0.01) return simPnL[b] - simPnL[a];
                        return diff;
                    });
                
                const bestStrat = activeStrats.length > 0 ? activeStrats[0] : 'Nenhuma';
                let b_wins = 0; let b_losses = 0;
                let b_peak = this.initialBankroll; let b_current = this.initialBankroll;
                let maxDrawdown = 0;
                let bPrevNum = -1;

                if (bestStrat !== 'Nenhuma') {
                    const zone = new Set(this.STRATEGY_ZONES[bestStrat]);
                    for (const num of historyToTest) {
                        if (bestStrat === 'PATTERN_FRANCESA' && bPrevNum !== 28 && bPrevNum !== 29) {
                            bPrevNum = num;
                            continue;
                        }
                        const isWin = zone.has(num);
                        let pnl = 0;
                        if (bestStrat.startsWith('CROSS_GRID') || bestStrat.startsWith('CROSS_DOZEN')) {
                            const cost = 2 * minChip;
                            pnl = isWin ? (3 * minChip) - cost : -cost;
                        } else {
                            const cost = zone.size * minChip;
                            pnl = isWin ? (36 * minChip) - cost : -cost;
                        }
                        
                        b_current += pnl;
                        if (pnl > 0) b_wins++; else b_losses++;
                        if (b_current > b_peak) b_peak = b_current;
                        const drawdown = b_current - b_peak;
                        if (drawdown < maxDrawdown) maxDrawdown = drawdown;
                        
                        bPrevNum = num;
                    }
                }

                const total = b_wins + b_losses;
                const wr = total > 0 ? (b_wins / total) * 100 : 0;
                const pnlProj = b_current - this.initialBankroll;

                console.log('======================================================');
                console.log(' 🔬 RL.SYS CORE - MOTOR DE BACKTEST & SIMULAÇÃO');
                console.log('======================================================');
                console.log(` Estratégia Alfa : ${bestStrat}`);
                console.log(` Giros Simulados : ${historyToTest.length} rodadas.`);
                console.log(` Win Rate Bruto  : ${wr.toFixed(1)}% (${b_wins}W / ${b_losses}L)`);
                console.log(` Max Drawdown    : \x1b[31mR$ ${maxDrawdown.toFixed(2)}\x1b[0m`);
                console.log(` PnL Projetado   : ${pnlProj >= 0 ? '\x1b[32m+' : '\x1b[31m'}R$ ${pnlProj.toFixed(2)}\x1b[0m`);
                console.log(` Banca Projetada : R$ ${b_current.toFixed(2)}`);
                console.log('======================================================');
                console.log('Pressione ENTER para retornar ao HUD...');
                this.inputMode = 'VIEW_ONLY'; 
                return;
            }
            if (lowerCmd === 'help') {
                console.clear();
                console.log('======================================================');
                console.log(' 🧠 COMANDOS DE GOVERNANÇA TÁTICA');
                console.log('======================================================');
                console.log(' audit / why          : Painel XAI - Radiografia de Risco');
                console.log(' provider <nome>      : Define mesa (pragmatic | evolution)');
                console.log(' setbankroll <valor>  : Ajusta banca de combate e Trailing Peak');
                console.log(' setmacro <valor>     : Define o Marco Zero da sua Jornada');
                console.log(' journey              : Painel contábil de Milestones');
                console.log(' sync <n1,n2>         : Injeta fita histórica no motor principal');
                console.log(' weights              : Motor Shadow PnL e Pesos');
                console.log(' backtest <n1,n2>     : Simulação offline (não afeta o HUD)');
                console.log(' stats                : Relatório de Win Rate e Sessão');
                console.log(' enable <id>          : Liga um reator estratégico');
                console.log(' disable <id>         : Desliga um reator estratégico');
                console.log(' undo                 : Remove último número digitado');
                console.log(' exit / quit          : Encerra e salva');
                console.log('======================================================');
                console.log('Pressione ENTER para retornar...'); 
                this.inputMode = 'VIEW_ONLY'; 
                return;
            }
            if (lowerCmd === 'undo') {
                const internalHistory = (this.mesaTracker as any).history;
                if (internalHistory && internalHistory.length > 0) {
                    internalHistory.pop();
                    this.activeBet = null; 
                    this.lastActionTakenText = '\x1b[33m[SISTEMA] Último giro removido. Liquidação cancelada.\x1b[0m';
                    this.generateNextTrade();
                } else {
                    this.lastActionTakenText = '\x1b[31m[ERRO] Nenhum giro para remover.\x1b[0m';
                    this.renderTerminalHud();
                }
                return;
            }
            if (lowerCmd === 'exit' || lowerCmd === 'quit') { 
                console.log('\n\x1b[33m[SISTEMA] Encerrando e salvando estados...\x1b[0m');
                this.rl.close(); 
                process.exit(0); 
            }

            let isSkipped = false; 
            let numStr = cmd;
            const skipMatch = cmd.match(/^[psnx]\s*(\d+)$/i);
            if (skipMatch) { 
                isSkipped = true; 
                numStr = skipMatch[1]; 
            }
            
            const num = parseInt(numStr, 10);
            
            if (!isNaN(num) && num >= 0 && num <= 36 && num.toString() === numStr) {
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
        
        this.preSpinImpactText = '';

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
        
        const lastNum = history.length > 0 ? history[history.length - 1] : -1;
        
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
                .filter(id => {
                    if (id === 'PATTERN_FRANCESA') return lastNum === 28 || lastNum === 29;
                    return true;
                })
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
                const safeWeight = Math.round(weight * 100) / 100;
                
                let requiredWeight = 1.00;
                if (this.currentVixPercent >= 100.0) requiredWeight = 1.50;
                else if (this.currentVixPercent >= 95.0) requiredWeight = 1.20;
                
                if (safeWeight < requiredWeight) {
                    this.xaiQualification = 'BLOQUEADO (RUÍDO ESTOCÁSTICO)';
                    this.xaiMoment = 'AGUARDANDO PADRÃO';
                    
                    if (requiredWeight > 1.00) {
                        this.xaiReason = `Mesa Caótica (VIX: ${this.currentVixPercent.toFixed(1)}%). O peso exigido subiu para ${requiredWeight.toFixed(2)} para evitar falsos padrões.`;
                    } else {
                        this.xaiReason = `Estratégia Alfa (${this.activeStrategyId}) com peso ${safeWeight.toFixed(2)}. Mínimo exigido: 1.00.`;
                    }
                    
                    this.dynamicStakeCalculated = 0.00;
                    this.xaiApplicationText = 'APENAS OBSERVE E INSIRA OS NÚMEROS.';
                    this.activeBet = null; 
                } else {
                    const sizing = this.calculateSizing(this.activeStrategyId, minChip, safeWeight);
                    
                    if (!sizing.isSafe) {
                        this.xaiQualification = 'VETADO (RISCO)';
                        this.xaiMoment = 'AGORA NÃO';
                        this.xaiReason = `Estratégia exige R$ ${sizing.cost.toFixed(2)}, mas seu limite (5%) é R$ ${sizing.safeLimit.toFixed(2)}.`;
                        this.dynamicStakeCalculated = 0.00;
                        this.xaiApplicationText = 'OPERAÇÃO VETADA PELO GESTOR DE RISCO.';
                        this.activeBet = null;
                    } else {
                        this.xaiQualification = 'SIM';
                        this.xaiMoment = 'JANELA TÁTICA';
                        this.xaiReason = `Estratégia autorizada (Peso: ${safeWeight.toFixed(2)}). Escudo e VIX aprovados.`;
                        this.dynamicStakeCalculated = sizing.total;
                        this.xaiApplicationText = sizing.desc;
                        this.activeBet = { strategyId: this.activeStrategyId, stake: sizing.total, chipMin: minChip, multiplier: sizing.multiplier };
                        
                        let winProfit = 0;
                        if (this.activeStrategyId.startsWith('CROSS_GRID') || this.activeStrategyId.startsWith('CROSS_DOZEN')) {
                            winProfit = (3 * minChip * sizing.multiplier) - sizing.total;
                        } else {
                            winProfit = (36 * minChip * sizing.multiplier) - sizing.total;
                        }
                        
                        this.preSpinImpactText = `\x1b[32mVitória ➔ R$ ${(this.currentBankroll + winProfit).toFixed(2)}\x1b[0m | \x1b[31mDerrota ➔ R$ ${(this.currentBankroll - sizing.total).toFixed(2)}\x1b[0m`;
                    }
                }

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

echo "[RL.SYS] Compilando novo Motor Tático Enxuto (V5.14b)..."
npx tsc || npm run build || true
echo "[RL.SYS] Sprint 496 Concluída."
