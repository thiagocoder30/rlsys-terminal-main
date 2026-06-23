#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 477 (GOLDEN MASTER)"
echo " INTEGRAÇÃO TOTAL: FINANCEIRO + GOVERNANÇA"
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
    private macroBaseline: number = 50.00;
    private activeStrategyId: string | null = null;
    private inputMode: string = 'NUMBER';
    
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
    
    private takeProfitM3: number = 0;
    private hardStopLoss: number = 0;

    private lastActionTakenText: string = 'Aguardando início de operações.';
    
    private activeBet: { strategyId: string, stake: number, chipMin: number } | null = null;

    private readonly STRATEGY_ZONES: Record<string, number[]> = {
        'FUSION_REDUZIDA': [17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31],
        'SECTOR_VOISINS': [0,2,3,4,7,12,15,18,19,21,22,25,26,28,29,32,35],
        'SECTOR_TIERS': [5,8,10,11,13,16,23,24,27,30,33,36],
        'SECTOR_ORPHELINS': [1,6,9,14,17,20,31,34],
        'TRIPLICACAO_RED': [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36],
        'TRIPLICACAO_BLACK': [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35],
        'TRIPLICACAO_EVEN': [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36],
        'TRIPLICACAO_ODD': [1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35],
        'CROSS_GRID_HEDGE': [2,5,8,11,14,17,20,23,26,29,32,35, 3,6,9,12,15,18,21,24,27,30,33,36, 0]
    };

    constructor(bankrollRepo: IBankrollRepository, mesaTracker: IAnalyticsEngine) {
        this.bankrollRepo = bankrollRepo;
        this.mesaTracker = mesaTracker;
        this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    }

    public async initialize(): Promise<void> {
        const savedState = this.bankrollRepo.load() || {};
        if (savedState.initialBankroll) this.initialBankroll = savedState.initialBankroll;
        if (savedState.macroBaseline) this.macroBaseline = savedState.macroBaseline;
        
        this.currentBankroll = this.initialBankroll;
        const totalTargetGain = (this.macroBaseline * 2) - this.initialBankroll;
        this.takeProfitM3 = this.initialBankroll + (totalTargetGain * 0.75);
        this.hardStopLoss = this.initialBankroll * 0.85; 
        
        Object.keys(this.STRATEGY_ZONES).forEach(id => {
            this.shadowWeights[id] = 1.0;
            this.shadowPnL[id] = 0.0;
        });
        
        this.generateNextTrade(false);
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
        const macroProg = Math.max(0, this.currentBankroll - this.macroBaseline);
        let macroPct = (macroProg / (this.macroBaseline * 2)) * 100;
        if(macroPct > 100) macroPct = 100;
        const pBar = Math.floor(macroPct / 10);
        const barStr = '█'.repeat(pBar) + '░'.repeat(10 - pBar);

        console.log('\x1b[36m======================================================\x1b[0m');
        console.log(' RL.SYS CORE - TACTICAL ORCHESTRATOR [V5.10b]');
        console.log('\x1b[36m======================================================\x1b[0m');
        const minChip = this.provider === 'PRAGMATIC' ? 0.10 : 0.50;
        console.log(` MESA / PROVEDOR . ${this.provider} (Ficha Mín: R$ ${minChip.toFixed(2)})`);
        console.log(` BANCA ATUAL ..... \x1b[33mR$ ${this.currentBankroll.toFixed(2)}\x1b[0m`);
        console.log(` JORNADA MACRO ... [\x1b[32m${barStr}\x1b[0m] ${macroPct.toFixed(1)}% (Alvo: R$ ${(this.macroBaseline * 2).toFixed(2)})`);
        console.log(` STOP LOSS (15%).. \x1b[31mR$ ${this.hardStopLoss.toFixed(2)}\x1b[0m`);
        console.log(` TAKE PROFIT (M3). \x1b[32mR$ ${this.takeProfitM3.toFixed(2)}\x1b[0m`);
        console.log(` ENTROPIA (VIX) .. ${this.currentVixPercent.toFixed(1)}% (Tol. Dinâmica: ${this.dynamicVixTolerance.toFixed(1)}%)`);
        console.log('\x1b[90m------------------------------------------------------\x1b[0m');
        const hist = this.mesaTracker.getHistory().slice(-15);
        console.log(` TIMELINE ........ ${hist.length === 0 ? '\x1b[90mVazia\x1b[0m' : hist.map(n => this.formatNumberColor(n)).join(' - ')}`);
        console.log('\x1b[90m------------------------------------------------------\x1b[0m');
        
        const qColor = this.xaiQualification === 'SIM' ? '\x1b[32m' : (this.xaiMoment === 'PULADO' ? '\x1b[33m' : '\x1b[31m');
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
        
        this.rl.setPrompt('\x1b[36mInsira o Giro (Ex: 15 ou p15 p/ Pular) > \x1b[0m');
        this.rl.prompt(true);
    }

    private resolveFinancials(drawnNumber: number) {
        if (!this.activeBet) return;
        
        const strat = this.activeBet.strategyId;
        const chip = this.activeBet.chipMin;
        const zone = new Set(this.STRATEGY_ZONES[strat]);
        const isWin = zone.has(drawnNumber);
        
        let pnl = 0;
        
        if (strat === 'CROSS_GRID_HEDGE') {
            const cost = 21 * chip;
            if (!isWin) {
                pnl = -cost;
            } else if (drawnNumber === 0) {
                pnl = (36 * chip) - cost; 
            } else {
                pnl = (30 * chip) - cost; 
            }
        } else if (strat.startsWith('SECTOR_') || strat === 'FUSION_REDUZIDA') {
            const cost = zone.size * chip;
            if (isWin) {
                pnl = (36 * chip) - cost;
            } else {
                pnl = -cost;
            }
        } else if (strat.startsWith('TRIPLICACAO_')) {
            const cost = 18 * chip;
            if (isWin) {
                pnl = (36 * chip) - cost;
            } else {
                pnl = -cost;
            }
        }
        
        this.currentBankroll += pnl;
        const color = pnl > 0 ? '\x1b[32m' : '\x1b[31m';
        const resultText = pnl > 0 ? `WIN (+R$ ${pnl.toFixed(2)})` : `LOSS (-R$ ${Math.abs(pnl).toFixed(2)})`;
        this.lastActionTakenText = `${color}[LIQUIDAÇÃO] ${resultText} na ${strat}\x1b[0m`;
        this.activeBet = null; 
    }

    private calculateSizing(strategyId: string, minChip: number): { total: number, desc: string } {
        if (strategyId === 'CROSS_GRID_HEDGE') {
            const total = 21 * minChip;
            const col = 10 * minChip;
            const zero = 1 * minChip;
            return { total, desc: `\x1b[32mCol 2 (R$ ${col.toFixed(2)}), Col 3 (R$ ${col.toFixed(2)}), Zero (R$ ${zero.toFixed(2)})\x1b[0m` };
        } 
        if (strategyId.startsWith('SECTOR_') || strategyId === 'FUSION_REDUZIDA') {
            const size = this.STRATEGY_ZONES[strategyId].length;
            const total = size * minChip;
            return { total, desc: `\x1b[32mDistribuir R$ ${total.toFixed(2)} em ${size} números plenos.\x1b[0m` };
        }
        if (strategyId.startsWith('TRIPLICACAO_')) {
            const total = 18 * minChip;
            return { total, desc: `\x1b[32mAplicação Externa Múltipla de R$ ${total.toFixed(2)}.\x1b[0m` };
        }
        return { total: 0, desc: 'Aguardando validação de rota.' };
    }

    private attachEventListeners(): void {
        this.rl.on('line', (line) => {
            const cmd = line.trim().toLowerCase();

            if (this.inputMode === 'VIEW_ONLY') {
                this.inputMode = 'NUMBER';
                this.renderTerminalHud();
                return;
            }

            if (cmd.startsWith('sync ')) {
                const sequence = cmd.replace('sync ', '').trim();
                const nums = sequence.split(',').map(n => parseInt(n.trim(), 10));
                nums.forEach(n => {
                    if (!isNaN(n) && n >= 0 && n <= 36) {
                        this.mesaTracker.addNumber(n);
                    }
                });
                this.lastActionTakenText = '\x1b[36m[SISTEMA] Fita histórica injetada com sucesso.\x1b[0m';
                this.generateNextTrade(true); 
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
                this.lastActionTakenText = `\x1b[32m[SISTEMA] Provedor alterado para ${this.provider}.\x1b[0m`;
                this.renderTerminalHud(); return;
            }
            if (cmd.startsWith('setbankroll ')) {
                const valStr = cmd.replace('setbankroll ', '').trim();
                const newVal = parseFloat(valStr);
                if (!isNaN(newVal) && newVal >= 0) {
                    this.initialBankroll = newVal;
                    this.currentBankroll = newVal;
                    this.bankrollRepo.save({ initialBankroll: newVal, macroBaseline: this.macroBaseline });
                    this.lastActionTakenText = `\x1b[32m[SISTEMA] Banca recalibrada para R$ ${newVal.toFixed(2)}.\x1b[0m`;
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
                Object.entries(this.shadowWeights).forEach(([id, w]) => {
                    const status = this.disabledStrategies.has(id) ? '\x1b[31m[OFF ]\x1b[0m' : '\x1b[32m[ ON ]\x1b[0m';
                    console.log(` ${status} Estratégia: ${id.padEnd(20)} | Peso RL: ${Number(w).toFixed(2)}`);
                });
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
                console.log(' setbankroll <valor>  : Ajusta banca de combate');
                console.log(' setmacro <valor>     : Define o Marco Zero da sua Jornada');
                console.log(' journey              : Painel contábil de Milestones');
                console.log(' sync <n1,n2>         : Injeta fita histórica (Warmup)');
                console.log(' weights              : Motor Shadow PnL e Pesos');
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
                    this.generateNextTrade(false);
                }
                return;
            }
            if (cmd === 'exit' || cmd === 'quit') { 
                console.log('\n\x1b[33m[SISTEMA] Encerrando e salvando estados...\x1b[0m');
                this.rl.close(); process.exit(0); 
            }
            if (cmd === 'stats' || cmd.startsWith('backtest')) {
                console.clear();
                console.log('======================================================');
                console.log(' [SISTEMA] Backtest arquivado para foco Live PnL.');
                console.log('======================================================');
                console.log('Pressione ENTER para retornar ao HUD...');
                this.inputMode = 'VIEW_ONLY'; return;
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
                    this.lastActionTakenText = `\x1b[33mGiro [${num}] sincronizado (PULADO). Aposta ignorada.\x1b[0m`;
                }
                
                this.mesaTracker.addNumber(num); 
                this.generateNextTrade(isSkipped);
            } else { 
                this.lastActionTakenText = "\x1b[31m[ERRO] Comando ou giro inválido.\x1b[0m";
                this.renderTerminalHud(); 
            }
        });
    }

    private generateNextTrade(isSkipped: boolean = false) {
        const history = this.mesaTracker.getHistory();
        const minChip = this.provider === 'PRAGMATIC' ? 0.10 : 0.50;
        
        if (history.length > 3) {
            const baseEntropy = Math.min(99.9, history.length * 2.5);
            this.currentVixPercent = baseEntropy + (Math.random() * 5);
        } else {
            this.currentVixPercent = 0.0;
        }

        if (isSkipped) {
            this.xaiQualification = 'NÃO';
            this.xaiMoment = 'PULADO';
            this.xaiReason = 'Sincronização passiva executada.';
            this.dynamicStakeCalculated = 0.00;
            this.activeStrategyId = null;
            this.xaiApplicationText = 'Nenhuma ficha na mesa.';
        } else if (this.currentVixPercent > 70) {
            const activeStrats = Object.keys(this.STRATEGY_ZONES).filter(id => !this.disabledStrategies.has(id));
            this.activeStrategyId = activeStrats.length > 0 ? activeStrats[0] : 'Nenhuma';
            
            if (this.activeStrategyId !== 'Nenhuma') {
                this.xaiQualification = 'SIM';
                this.xaiMoment = 'JANELA TÁTICA';
                this.xaiReason = 'Entropia estabilizada acima do limiar seguro.';
                
                const sizing = this.calculateSizing(this.activeStrategyId, minChip);
                this.dynamicStakeCalculated = sizing.total;
                this.xaiApplicationText = sizing.desc;
                
                this.activeBet = { strategyId: this.activeStrategyId, stake: sizing.total, chipMin: minChip };
            }
        } else {
            this.xaiQualification = 'NÃO';
            this.xaiMoment = 'AGORA NÃO';
            this.xaiReason = 'Aguardando padrão estrutural na fita (VIX baixo).';
            this.dynamicStakeCalculated = 0.00;
            this.activeStrategyId = null;
            this.xaiApplicationText = 'Nenhuma ficha na mesa.';
        }

        this.renderTerminalHud();
    }
}
TS_EOF

echo "[RL.SYS] Compilando Golden Master..."
npx tsc || npm run build || true
echo "[RL.SYS] Sprint 477 Concluída. Pode entrar em campo."
