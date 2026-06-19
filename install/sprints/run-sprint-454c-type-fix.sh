#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 454-C"
echo " TYPESCRIPT STRICT MODE FIX"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/2] Corrigindo a inferência de tipo do Decision Engine..."
cat > src/presentation/cli/LivePaperOrchestrator.ts <<'EOF'
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'path';
import { IBankrollRepository } from '../../domain/interfaces/IBankrollRepository';
import { IAnalyticsEngine } from '../../domain/interfaces/IAnalyticsEngine';
import { PositionSizingEngine, CasinoProvider } from '../../domain/risk/PositionSizingEngine';
import { TrailingStopGuard } from '../../domain/risk/TrailingStopGuard';
import { StrategyPerformanceEvaluator } from '../../domain/risk/StrategyPerformanceEvaluator';

const { DynamicEmotionalCooldownGuard } = require('../../domain/risk/DynamicEmotionalCooldownGuard.js');
const { AutoSettlementEngine } = require('../../domain/financial/AutoSettlementEngine.js');

import { RuntimeEventBus } from '../../application/runtime/RuntimeEventBus';
import { PooledSignal } from '../../domain/memory/SignalObjectPool';
import { HFTPipelineCoordinator } from '../../application/coordinators/HFTPipelineCoordinator';
import { InstitutionalStrategyAllocationEngine } from '../../domain/decision/InstitutionalStrategyAllocationEngine';

export class LivePaperOrchestrator {
    private rl: readline.Interface;
    private bankrollRepo: IBankrollRepository;
    private mesaTracker: IAnalyticsEngine;
    private sizingEngine: PositionSizingEngine;
    private performanceEvaluator: StrategyPerformanceEvaluator;
    private eventBus: RuntimeEventBus;
    private hftPipeline: HFTPipelineCoordinator;
    private allocationEngine: InstitutionalStrategyAllocationEngine;
    
    private initialBankroll: number = 100.00;
    private savedState: any;
    private activeStrategyId: string | null = null;
    private inputMode: string = 'NUMBER';
    
    private liveConvergence: number = 0;
    private liveConfidence: number = 0;
    private liveExecutionPressure: string = 'N/A';
    
    private xaiQualification: string = 'NÃO';
    private xaiMoment: string = 'AGORA NÃO';
    private xaiReason: string = 'Aguardando dados estruturais da mesa.';
    
    private currentVixPercent: number = 0;
    private vixTolerance: number = 95.0;
    private disabledStrategies: Set<string> = new Set();
    private cooldownGuard: any;
    
    private dynamicStakeCalculated: number = 0.00;
    private localHistoryCache: number[] = [];
    
    private shadowWeights: Record<string, number> = {};
    private shadowPnL: Record<string, number> = {};
    private takeProfitM3: number = 0;
    private hardStopLoss: number = 0;
    
    private lastRecommendedStrategy: string | null = null;
    private lastRecommendedStake: number = 0;
    private lastQualification: string = 'NÃO';
    private lastActionTakenText: string = 'Aguardando início de operações.';
    
    private readonly OPERATIONAL_WINDOW_SIZE = 90; 

    constructor(bankrollRepo: IBankrollRepository, mesaTracker: IAnalyticsEngine) {
        this.bankrollRepo = bankrollRepo;
        this.mesaTracker = mesaTracker;
        this.sizingEngine = new PositionSizingEngine();
        const availableStrategies = Object.keys(AutoSettlementEngine.getStrategies());
        this.performanceEvaluator = new StrategyPerformanceEvaluator(availableStrategies);
        this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        this.eventBus = new RuntimeEventBus(250);
        this.hftPipeline = new HFTPipelineCoordinator(this.eventBus, 85);
        this.allocationEngine = new InstitutionalStrategyAllocationEngine(15);
    }

    public async initialize(): Promise<void> {
        this.savedState = this.bankrollRepo.load();
        if (this.savedState && this.savedState.initialBankroll) {
            this.initialBankroll = this.savedState.initialBankroll;
        }
        this.cooldownGuard = new DynamicEmotionalCooldownGuard(this.initialBankroll, this.savedState);
        
        const totalTargetGain = this.cooldownGuard.nextMilestone - this.initialBankroll;
        this.takeProfitM3 = this.initialBankroll + (totalTargetGain * 0.75);
        this.hardStopLoss = this.initialBankroll * 0.85; 
        
        Object.keys(AutoSettlementEngine.getStrategies()).forEach(id => {
            this.shadowWeights[id] = 1.0;
            this.shadowPnL[id] = 0.0;
        });
        
        this.generateNextTrade();
        this.attachEventListeners();
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
                        this.localHistoryCache.push(n);
                        this.processShadowTrading(n);
                    }
                });
                this.lastActionTakenText = '\x1b[36mSincronização de Warmup concluída com sucesso.\x1b[0m';
                this.generateNextTrade();
                return;
            }

            if (cmd === 'weights') {
                console.clear();
                console.log('======================================================');
                console.log(' ⚖️  RL.SYS CORE - SHADOW TRADING & RL WEIGHTS');
                console.log('======================================================');
                Object.entries(this.shadowWeights).forEach(([id, w]) => {
                    const pnl = this.shadowPnL[id];
                    const pnlColor = pnl >= 0 ? '\x1b[32m' : '\x1b[31m';
                    const st = this.disabledStrategies.has(id) ? '\x1b[31m[OFF]\x1b[0m' : '\x1b[32m[ON]\x1b[0m';
                    console.log(` Estratégia: ${id.padEnd(20)} | PnL Sombra: ${pnlColor}${pnl > 0 ? '+' : ''}${pnl.toFixed(1)}\x1b[0m | Peso RL: ${Number(w).toFixed(2)} | ${st}`);
                });
                console.log('======================================================');
                console.log('Pressione ENTER para retornar ao HUD...');
                this.inputMode = 'VIEW_ONLY';
                return;
            }

            if (cmd === 'undo') {
                if (this.localHistoryCache.length > 0) {
                    this.localHistoryCache.pop();
                    const internalHistory = (this.mesaTracker as any).history;
                    if (internalHistory && Array.isArray(internalHistory)) internalHistory.pop();
                    this.lastActionTakenText = '\x1b[33mÚltimo número removido da fita.\x1b[0m';
                    this.generateNextTrade();
                }
                return;
            }

            if (cmd === 'help') {
                console.clear();
                console.log('======================================================');
                console.log(' 🧠 COMANDOS DE GOVERNANÇA TÁTICA');
                console.log('======================================================');
                console.log(' sync <n1,n2> : Injeta fita de dados histórica');
                console.log(' undo         : Remove último número');
                console.log(' weights      : Motor Shadow PnL e Pesos');
                console.log(' exit / quit  : Encerra com salvamento');
                console.log('======================================================');
                console.log('Pressione ENTER para retornar...');
                this.inputMode = 'VIEW_ONLY';
                return;
            }

            if (cmd === 'exit' || cmd === 'quit') { this.rl.close(); process.exit(0); }
            
            const num = parseInt(cmd, 10);
            if (!isNaN(num) && num >= 0 && num <= 36) {
                this.mesaTracker.addNumber(num);
                this.localHistoryCache.push(num);
                
                this.processRealSettlement(num);
                this.processShadowTrading(num);
                this.generateNextTrade();
            }
        });
    }

    private processRealSettlement(num: number): void {
        if (this.lastQualification === 'SIM' && this.lastRecommendedStrategy && this.lastRecommendedStake > 0) {
            const REDS = new Set(AutoSettlementEngine.RED_NUMS);
            let isWin = false;
            let profitMultiplier = 1.0;
            const id = this.lastRecommendedStrategy;

            if (num === 0) {
                isWin = false;
            } else if (id === 'TRIPLICACAO_RED') isWin = REDS.has(num);
            else if (id === 'TRIPLICACAO_BLACK') isWin = !REDS.has(num);
            else if (id === 'TRIPLICACAO_EVEN') isWin = (num % 2 === 0);
            else if (id === 'TRIPLICACAO_ODD') isWin = (num % 2 !== 0);
            else if (id === 'CROSS_GRID_HEDGE' || id === 'FUSION_REDUZIDA') {
                isWin = (num > 12); 
                profitMultiplier = 0.5; 
            }

            if (isWin) {
                const profit = this.lastRecommendedStake * profitMultiplier;
                this.cooldownGuard.currentBankroll += profit;
                this.lastActionTakenText = `\x1b[32m[WIN] Acertou o ${num}. Lucro: +R$ ${profit.toFixed(2)}\x1b[0m`;
            } else {
                const loss = this.lastRecommendedStake;
                this.cooldownGuard.currentBankroll -= loss;
                this.lastActionTakenText = `\x1b[31m[LOSS] Errou o ${num}. Risco Deduzido: -R$ ${loss.toFixed(2)}\x1b[0m`;
            }
            
            this.bankrollRepo.save({ initialBankroll: this.cooldownGuard.currentBankroll });
            this.checkCircuitBreakers();
        } else {
            this.lastActionTakenText = `\x1b[90m[SKIP] Giro ${num} contabilizado para análise.\x1b[0m`;
        }
    }

    private processShadowTrading(num: number): void {
        const REDS = new Set(AutoSettlementEngine.RED_NUMS);
        Object.keys(this.shadowWeights).forEach(id => {
            if (this.disabledStrategies.has(id)) return;
            let isWin = false;
            if (num === 0) isWin = false;
            else if (id === 'TRIPLICACAO_RED') isWin = REDS.has(num);
            else if (id === 'TRIPLICACAO_BLACK') isWin = !REDS.has(num);
            else if (id === 'TRIPLICACAO_EVEN') isWin = (num % 2 === 0);
            else if (id === 'TRIPLICACAO_ODD') isWin = (num % 2 !== 0);
            else if (id === 'CROSS_GRID_HEDGE' || id === 'FUSION_REDUZIDA') isWin = (num > 12); 

            if (isWin) {
                this.shadowPnL[id] += 1.0;
                this.shadowWeights[id] = Math.min(2.5, this.shadowWeights[id] * 1.15);
            } else {
                this.shadowPnL[id] -= 1.0;
                this.shadowWeights[id] = Math.max(0.1, this.shadowWeights[id] * 0.85);
            }
        });
    }

    private checkCircuitBreakers(): void {
        if (this.cooldownGuard.currentBankroll >= this.takeProfitM3) {
            console.clear();
            console.log('\x1b[32m======================================================');
            console.log(' [CIRCUIT BREAKER] TAKE PROFIT ATINGIDO (M3)');
            console.log('======================================================\x1b[0m');
            console.log(` Banca Final: R$ ${this.cooldownGuard.currentBankroll.toFixed(2)}`);
            process.exit(0);
        }
        if (this.cooldownGuard.currentBankroll <= this.hardStopLoss) {
            console.clear();
            console.log('\x1b[31m======================================================');
            console.log(' [CIRCUIT BREAKER] STOP LOSS INSTITUCIONAL ACIONADO');
            console.log('======================================================\x1b[0m');
            console.log(` Banca Final: R$ ${this.cooldownGuard.currentBankroll.toFixed(2)}`);
            process.exit(0);
        }
    }

    private generateNextTrade(): void {
        const fullHistory = this.mesaTracker.getHistory();
        const REDS = new Set(AutoSettlementEngine.RED_NUMS);
        const operationalHistory = fullHistory.slice(-this.OPERATIONAL_WINDOW_SIZE);

        if (operationalHistory.length < 10) {
            this.updateXaiTranslation(null);
            this.renderTerminalHud();
            return;
        }

        const extractTrios = (mapFn: (v:number)=>string) => {
            let tc = 0, ntc = 0, ta = 0, nta = 0;
            const rev = [...operationalHistory].reverse();
            for (let i = rev.length - 1; i >= 2; i -= 3) {
                const t = [rev[i], rev[i-1], rev[i-2]];
                if(t.includes(0)) continue;
                const m = t.map(mapFn);
                if(m[0]===m[1] && m[1]===m[2]) tc++;
                else if(m[0]===m[1] && m[1]!==m[2]) ntc++;
                else if(m[0]!==m[1] && m[1]!==m[2] && m[0]===m[2]) ta++;
                else nta++;
            }
            const tot = tc+ntc+ta+nta;
            let ent = 0;
            [tc,ntc,ta,nta].forEach(c => { if(c>0) { const p = c/tot; ent -= p*Math.log2(p); }});
            let maxC = 0;
            [['TC',tc],['NTC',ntc],['TA',ta],['NTA',nta]].forEach(([n,c]) => { if(c as number>maxC) maxC=c as number; });
            return { vix: tot>0 ? (ent/2)*100 : 0, ratio: tot>0 ? maxC/tot : 0 };
        };

        const cStats = extractTrios(v => REDS.has(v) ? 'A' : 'B');
        const pStats = extractTrios(v => v%2===0 ? 'A' : 'B');
        this.currentVixPercent = (cStats.vix + pStats.vix) / 2;

        let highestWeight = -1;
        // CORREÇÃO DE TIPAGEM ESTIRTA: Declarado explicitamente como string | null
        let bestStrat: string | null = null;
        Object.keys(this.shadowWeights).forEach(id => {
            if (!this.disabledStrategies.has(id)) {
                if (this.shadowWeights[id] > highestWeight) {
                    highestWeight = this.shadowWeights[id];
                    bestStrat = id;
                }
            }
        });
        
        // Agora prospectiveId herda a tipagem correta e a função .includes() funciona
        let prospectiveId: string | null = bestStrat;
        this.activeStrategyId = bestStrat;

        this.liveConvergence = Math.round(100 - this.currentVixPercent);
        const maxRatio = Math.max(cStats.ratio, pStats.ratio);
        this.liveConfidence = Math.round((maxRatio / 0.5) * 100); 

        if (this.liveConvergence > 80 && this.liveConfidence > 75) this.liveExecutionPressure = 'AGGRESSIVE_ENTRY';
        else if (this.liveConvergence > 65 && this.liveConfidence > 60) this.liveExecutionPressure = 'STANDARD_ENTRY';
        else this.liveExecutionPressure = 'REDUCE_EXPOSURE';

        this.updateXaiTranslation(prospectiveId);

        if (prospectiveId && this.xaiQualification === 'SIM') {
            const isComplex = prospectiveId.includes('CROSS_GRID_HEDGE') || prospectiveId.includes('FUSION_REDUZIDA');
            const minFichas = isComplex ? 2 : 1; 
            const b = isComplex ? 0.5 : 1.0;
            const p = (this.liveConfidence > 0 ? this.liveConfidence : 50) / 100;
            
            let kellyFraction = (b * p - (1 - p)) / b;
            if (kellyFraction <= 0) kellyFraction = 0.02;

            let calculatedStake = this.cooldownGuard.currentBankroll * kellyFraction * 0.25;
            
            if (this.liveExecutionPressure === 'AGGRESSIVE_ENTRY') calculatedStake *= 1.5;
            if (this.liveExecutionPressure === 'REDUCE_EXPOSURE') calculatedStake *= 0.5;

            const minStakeTotal = minFichas * 0.10;
            if (calculatedStake < minStakeTotal) {
                this.dynamicStakeCalculated = minStakeTotal;
            } else {
                let steps = Math.round(calculatedStake / 0.10);
                if (steps % minFichas !== 0) steps += (minFichas - (steps % minFichas));
                this.dynamicStakeCalculated = steps * 0.10;
            }
        } else {
            this.dynamicStakeCalculated = 0.00;
        }

        this.lastRecommendedStrategy = prospectiveId;
        this.lastRecommendedStake = this.dynamicStakeCalculated;
        this.lastQualification = this.xaiQualification;

        this.renderTerminalHud();
    }

    private updateXaiTranslation(prospectiveId: string | null): void {
        if (!prospectiveId) {
            this.xaiQualification = 'NÃO';
            this.xaiMoment = 'AGORA NÃO';
            this.xaiReason = 'Aguardando dados estruturais da mesa.';
            return;
        }
        
        if (this.liveExecutionPressure === 'AGGRESSIVE_ENTRY') {
            this.xaiQualification = 'SIM';
            this.xaiMoment = 'ENTRAR';
            this.xaiReason = 'Regime confirmado. Janela limpa. Alavancagem ativada.';
        } else if (this.liveExecutionPressure === 'STANDARD_ENTRY') {
            this.xaiQualification = 'SIM';
            this.xaiMoment = 'ENTRAR';
            this.xaiReason = 'Janela estável e qualificação consistente confirmada.';
        } else {
            this.xaiQualification = 'SIM';
            this.xaiMoment = 'REDUZIDA';
            this.xaiReason = 'Sinal validado, mas janela em decaimento. Risco cortado.';
        }
    }

    private getPlacementInstruction(strategy: string | null, totalStake: number): string {
        if (!strategy || totalStake <= 0 || this.xaiQualification === 'NÃO') return 'Nenhuma ficha na mesa.';
        
        const fmt = (v: number) => `R$ ${v.toFixed(2)}`;
        
        if (strategy === 'TRIPLICACAO_RED') return `${fmt(totalStake)} no \x1b[31mVERMELHO\x1b[0m`;
        if (strategy === 'TRIPLICACAO_BLACK') return `${fmt(totalStake)} no \x1b[90mPRETO\x1b[0m`;
        if (strategy === 'TRIPLICACAO_EVEN') return `${fmt(totalStake)} no PAR`;
        if (strategy === 'TRIPLICACAO_ODD') return `${fmt(totalStake)} no ÍMPAR`;
        
        if (strategy === 'CROSS_GRID_HEDGE') {
            const half = totalStake / 2;
            return `${fmt(half)} na [\x1b[36mCOLUNA 1\x1b[0m] e ${fmt(half)} na [\x1b[36mCOLUNA 3\x1b[0m]`;
        }
        if (strategy === 'FUSION_REDUZIDA') {
            const half = totalStake / 2;
            return `${fmt(half)} na [\x1b[36mDÚZIA 1\x1b[0m] e ${fmt(half)} na [\x1b[36mDÚZIA 2\x1b[0m]`;
        }
        
        return `${fmt(totalStake)} seguindo padrão`;
    }

    private renderTerminalHud(): void {
        console.clear();
        console.log('======================================================');
        console.log(' 🛡️  RL.SYS CORE - ENTERPRISE ORCHESTRATOR [V4.5]');
        console.log('======================================================');
        console.log(` BANCA ATUAL ..... R$ ${this.cooldownGuard.currentBankroll.toFixed(2)}`);
        console.log(` STOP LOSS (15%).. R$ ${this.hardStopLoss.toFixed(2)}`);
        console.log(` TAKE PROFIT (M3). R$ ${this.takeProfitM3.toFixed(2)}`);
        console.log(` ENTROPIA (VIX) .. ${this.currentVixPercent.toFixed(1)}%`);
        console.log('------------------------------------------------------');
        console.log(` Estratégia ... \x1b[36m${this.activeStrategyId || 'Nenhuma'}\x1b[0m`);
        console.log(` Qualificação . ${this.xaiQualification === 'SIM' ? '\x1b[32mSIM\x1b[0m' : '\x1b[31mNÃO\x1b[0m'}`);
        console.log(` Momento ...... ${this.xaiMoment === 'AGORA NÃO' ? '\x1b[33mAGORA NÃO\x1b[0m' : `\x1b[32m${this.xaiMoment}\x1b[0m`}`);
        console.log(` STAKE GLOBAL . \x1b[32mR$ ${this.dynamicStakeCalculated.toFixed(2)}\x1b[0m`);
        console.log(` APLICAÇÃO .... ${this.getPlacementInstruction(this.activeStrategyId, this.dynamicStakeCalculated)}`);
        console.log(` Motivo ....... ${this.xaiReason}`);
        console.log('------------------------------------------------------');
        console.log(` Registro ..... ${this.lastActionTakenText}`);
        console.log('======================================================');
        this.rl.setPrompt('Insira o Número do Giro > ');
        this.rl.prompt(true);
    }
}
EOF

echo "[2/2] Compilando e aplicando strict type validation..."
npx tsc

echo "======================================"
echo -e "\033[1;32m SPRINT 454-C COMPILADA COM SUCESSO \033[0m"
echo " STATUS: TIPAGEM SEGURA ATIVADA"
echo "======================================"
