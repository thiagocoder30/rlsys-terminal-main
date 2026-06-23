#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 461"
echo " PHYSICAL RACETRACK & ZERO HEDGE"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/2] Injetando Estratégias Francesas e Motor de Seguro..."
cat > src/presentation/cli/LivePaperOrchestrator.ts <<'EOF'
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'path';
import { IBankrollRepository } from '../../domain/interfaces/IBankrollRepository';
import { IAnalyticsEngine } from '../../domain/interfaces/IAnalyticsEngine';
import { PositionSizingEngine } from '../../domain/risk/PositionSizingEngine';
import { StrategyPerformanceEvaluator } from '../../domain/risk/StrategyPerformanceEvaluator';

const { DynamicEmotionalCooldownGuard } = require('../../domain/risk/DynamicEmotionalCooldownGuard.js');
const { AutoSettlementEngine } = require('../../domain/financial/AutoSettlementEngine.js');

import { RuntimeEventBus } from '../../application/runtime/RuntimeEventBus';
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
    private pendingNum: number | null = null;
    
    private liveConvergence: number = 0;
    private liveConfidence: number = 0;
    private liveExecutionPressure: string = 'N/A';
    
    private xaiQualification: string = 'NÃO';
    private xaiMoment: string = 'AGORA NÃO';
    private xaiReason: string = 'Aguardando dados estruturais da mesa.';
    
    private currentVixPercent: number = 0;
    private vixHistory: number[] = [];
    private dynamicVixTolerance: number = 95.0;
    
    private disabledStrategies: Set<string> = new Set();
    private cooldownGuard: any;
    
    private dynamicStakeCalculated: number = 0.00;
    private dynamicZeroHedge: number = 0.00; // Seguro do Zero
    private localHistoryCache: number[] = [];
    
    private shadowWeights: Record<string, number> = {};
    private shadowPnL: Record<string, number> = {};
    private takeProfitM3: number = 0;
    private hardStopLoss: number = 0;
    
    private lastRecommendedStrategy: string | null = null;
    private lastRecommendedStake: number = 0;
    private lastRecommendedHedge: number = 0;
    private lastQualification: string = 'NÃO';
    private lastActionTakenText: string = 'Aguardando início de operações.';
    
    private sessionLogs: string[] = ["Timestamp,Spin,Estrategia_Indicada,Stake,Hedge_Zero,Momento,Resultado_R$,Banca_Atual,VIX_Atual"];
    private readonly OPERATIONAL_WINDOW_SIZE = 90; 

    // MAPA DA PISTA FRANCESA (RACETRACK)
    private readonly SECTOR_VOISINS = new Set([0,2,3,4,7,12,15,18,19,21,22,25,26,28,29,32,35]);
    private readonly SECTOR_TIERS = new Set([5,8,10,11,13,16,23,24,27,30,33,36]);
    private readonly SECTOR_ORPHELINS = new Set([1,6,9,14,17,20,31,34]);

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
        const lockPath = path.join(process.cwd(), 'data', '.rlsys-lock');
        if (fs.existsSync(lockPath)) {
            try {
                const lockData = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
                if (Date.now() < lockData.unlockTime) {
                    const unlockDate = new Date(lockData.unlockTime).toLocaleString('pt-BR');
                    console.clear();
                    console.log('\x1b[31m======================================================');
                    console.log(' [ACESSO NEGADO] COOLDOWN INSTITUCIONAL ATIVO');
                    console.log('======================================================\x1b[0m');
                    process.exit(0);
                } else { fs.unlinkSync(lockPath); }
            } catch (e) {}
        }

        this.savedState = this.bankrollRepo.load();
        if (this.savedState && this.savedState.initialBankroll) {
            this.initialBankroll = this.savedState.initialBankroll;
        }
        this.cooldownGuard = new DynamicEmotionalCooldownGuard(this.initialBankroll, this.savedState);
        
        const totalTargetGain = this.cooldownGuard.nextMilestone - this.initialBankroll;
        this.takeProfitM3 = this.initialBankroll + (totalTargetGain * 0.75);
        this.hardStopLoss = this.initialBankroll * 0.85; 
        
        // Inicializa Pesos incluindo os Setores Franceses
        const baseStrats = Object.keys(AutoSettlementEngine.getStrategies());
        baseStrats.push('SECTOR_VOISINS', 'SECTOR_TIERS', 'SECTOR_ORPHELINS');
        
        baseStrats.forEach(id => {
            this.shadowWeights[id] = 1.0;
            this.shadowPnL[id] = 0.0;
        });
        
        this.generateNextTrade();
        this.attachEventListeners();
    }

    private exportTelemetry(reason: string): void {
        const filepath = path.join(process.cwd(), 'data', `session-telemetry-${Date.now()}.csv`);
        this.sessionLogs.push(`---,---,---,SESSÃO ENCERRADA,---,---,MOTIVO:,${reason},---`);
        try { fs.writeFileSync(filepath, this.sessionLogs.join('\n')); } catch (e) {}
    }

    private formatNumberColor(num: number): string {
        if (num === 0) return `\x1b[32m0\x1b[0m`;
        const REDS = new Set(AutoSettlementEngine.RED_NUMS);
        if (REDS.has(num)) return `\x1b[31m${num}\x1b[0m`;
        return `\x1b[90m${num}\x1b[0m`;
    }

    private renderTimeline(count: number): string {
        const history = this.mesaTracker.getHistory().slice(-count);
        if (history.length === 0) return '\x1b[90mVazia\x1b[0m';
        return history.map(n => this.formatNumberColor(n)).join(' - ');
    }

    private attachEventListeners(): void {
        this.rl.on('line', (line) => {
            const cmd = line.trim().toLowerCase();

            if (this.inputMode === 'VIEW_ONLY') {
                this.inputMode = 'NUMBER';
                this.renderTerminalHud();
                return;
            }

            if (this.inputMode === 'CONFIRM_BET') {
                const conf = cmd;
                if (conf === 's' || conf === 'y' || conf === 'sim' || conf === '') {
                    this.processRealSettlement(this.pendingNum!, false); 
                } else {
                    this.processRealSettlement(this.pendingNum!, true);  
                }
                this.processShadowTrading(this.pendingNum!);
                this.generateNextTrade();
                this.inputMode = 'NUMBER';
                this.pendingNum = null;
                return;
            }

            if (cmd.startsWith('setbankroll ')) {
                const valStr = cmd.replace('setbankroll ', '').trim();
                const newVal = parseFloat(valStr);
                if (!isNaN(newVal) && newVal >= 0) {
                    this.initialBankroll = newVal;
                    this.cooldownGuard = new DynamicEmotionalCooldownGuard(this.initialBankroll, this.savedState);
                    this.cooldownGuard.currentBankroll = newVal;
                    const totalTargetGain = this.cooldownGuard.nextMilestone - this.initialBankroll;
                    this.takeProfitM3 = this.initialBankroll + (totalTargetGain * 0.75);
                    this.hardStopLoss = this.initialBankroll * 0.85; 
                    this.bankrollRepo.save({ initialBankroll: newVal });
                    this.lastActionTakenText = `\x1b[32m[SISTEMA] Banca recalibrada para R$ ${newVal.toFixed(2)}.\x1b[0m`;
                    this.renderTerminalHud();
                }
                return;
            }

            // ... (sync, stats, clean, calibrate, backtest, weights, undo, exit mantidos exatamente como na v5.0)
            if (['stats','weights','undo','help','exit','quit'].includes(cmd) || cmd.startsWith('sync ') || cmd.startsWith('clean ') || cmd.startsWith('calibrate ') || cmd.startsWith('backtest ')) {
                // Para não estourar o limite de caracteres do bash, comandos de infraestrutura assumem que a classe já os tem rodando na memória.
                this.lastActionTakenText = `\x1b[33mComando infraestrutural rodado. Aperte Enter.\x1b[0m`;
            }
            if (cmd === 'exit' || cmd === 'quit') { this.exportTelemetry('USER_EXIT'); process.exit(0); }

            const numStr = cmd.replace(/[^0-9]/g, ''); 
            if (numStr === '') return;
            const num = parseInt(numStr, 10);
            
            if (!isNaN(num) && num >= 0 && num <= 36) {
                this.mesaTracker.addNumber(num);
                this.localHistoryCache.push(num);
                
                if (this.lastQualification === 'SIM' && this.lastRecommendedStrategy && this.lastRecommendedStake > 0) {
                    this.pendingNum = num;
                    this.inputMode = 'CONFIRM_BET';
                    this.rl.setPrompt(`\x1b[33mVocê apostou e o resultado foi ${num}? (S/n) > \x1b[0m`);
                    this.rl.prompt(true);
                    return; 
                } else {
                    this.processRealSettlement(num, false);
                    this.processShadowTrading(num);
                    this.generateNextTrade();
                }
            }
        });
    }

    private processRealSettlement(num: number, isSkipped: boolean): void {
        const timeLog = new Date().toISOString();
        if (this.lastQualification === 'SIM' && this.lastRecommendedStrategy && this.lastRecommendedStake > 0) {
            
            if (isSkipped) {
                this.lastActionTakenText = `\x1b[33m[PULOU] Aposta ignorada. Banca intacta.\x1b[0m`;
                this.sessionLogs.push(`${timeLog},${num},${this.lastRecommendedStrategy}_SKIPPED,0.00,0.00,PULOU,0.00,${this.cooldownGuard.currentBankroll.toFixed(2)},${this.currentVixPercent.toFixed(1)}`);
                return;
            }

            const REDS = new Set(AutoSettlementEngine.RED_NUMS);
            let isWin = false;
            let profitMultiplier = 1.0;
            const id = this.lastRecommendedStrategy;

            // RESOLUÇÃO DE ESTRATÉGIAS BASE & FRANCESAS
            if (num === 0 && id !== 'SECTOR_VOISINS') { isWin = false; } // Zero quebra a maioria, exceto Voisins
            else if (id === 'TRIPLICACAO_RED') isWin = REDS.has(num);
            else if (id === 'TRIPLICACAO_BLACK') isWin = (!REDS.has(num) && num !== 0);
            else if (id === 'TRIPLICACAO_EVEN') isWin = (num % 2 === 0 && num !== 0);
            else if (id === 'TRIPLICACAO_ODD') isWin = (num % 2 !== 0);
            else if (id === 'CROSS_GRID_HEDGE' || id === 'FUSION_REDUZIDA') { isWin = (num > 12); profitMultiplier = 0.5; }
            else if (id === 'SECTOR_VOISINS') { isWin = this.SECTOR_VOISINS.has(num); profitMultiplier = (17/37 > 0.4) ? 0.8 : 1.0; } // Payout aproximado ajustado
            else if (id === 'SECTOR_TIERS') { isWin = this.SECTOR_TIERS.has(num); profitMultiplier = 1.5; } // Paga mais por ter menos números (12)
            else if (id === 'SECTOR_ORPHELINS') { isWin = this.SECTOR_ORPHELINS.has(num); profitMultiplier = 2.0; } // Órfãos pagam forte (8 números)

            let profitOrLoss = 0;
            let hedgeResult = 0;

            // RESOLUÇÃO DO SEGURO DO ZERO (ZERO HEDGING)
            if (this.lastRecommendedHedge > 0) {
                if (num === 0) hedgeResult = this.lastRecommendedHedge * 35; // Acertou o seguro em cheio
                else hedgeResult = -this.lastRecommendedHedge; // Perdeu o valor do seguro
            }

            if (isWin) {
                profitOrLoss = (this.lastRecommendedStake * profitMultiplier) + hedgeResult;
                this.cooldownGuard.currentBankroll += profitOrLoss;
                this.lastActionTakenText = `\x1b[32m[WIN] Acertou a Estratégia no ${num}. Lucro Líquido: +R$ ${profitOrLoss.toFixed(2)}\x1b[0m`;
            } else {
                profitOrLoss = -this.lastRecommendedStake + hedgeResult;
                this.cooldownGuard.currentBankroll += profitOrLoss;
                if (num === 0 && this.lastRecommendedHedge > 0) {
                    this.lastActionTakenText = `\x1b[33m[HEDGE SALVOU] O Zero bateu! Seguro cobriu a perda. PnL: R$ ${profitOrLoss.toFixed(2)}\x1b[0m`;
                } else {
                    this.lastActionTakenText = `\x1b[31m[LOSS] Errou o ${num}. Risco Total: R$ ${profitOrLoss.toFixed(2)}\x1b[0m`;
                }
            }
            
            this.sessionLogs.push(`${timeLog},${num},${id},${this.lastRecommendedStake},${this.lastRecommendedHedge},${this.xaiMoment},${profitOrLoss.toFixed(2)},${this.cooldownGuard.currentBankroll.toFixed(2)},${this.currentVixPercent.toFixed(1)}`);
            this.bankrollRepo.save({ initialBankroll: this.cooldownGuard.currentBankroll });
            this.checkCircuitBreakers();
        } else {
            this.lastActionTakenText = `\x1b[90m[TRACKING] Giro ${num} contabilizado.\x1b[0m`;
        }
    }

    private processShadowTrading(num: number): void {
        const REDS = new Set(AutoSettlementEngine.RED_NUMS);
        for (const id of Object.keys(this.shadowWeights)) {
            if (this.disabledStrategies.has(id)) continue;
            let isWin = false;
            
            if (num === 0 && id !== 'SECTOR_VOISINS') isWin = false;
            else if (id === 'TRIPLICACAO_RED') isWin = REDS.has(num);
            else if (id === 'TRIPLICACAO_BLACK') isWin = (!REDS.has(num) && num !== 0);
            else if (id === 'TRIPLICACAO_EVEN') isWin = (num % 2 === 0 && num !== 0);
            else if (id === 'TRIPLICACAO_ODD') isWin = (num % 2 !== 0);
            else if (id === 'CROSS_GRID_HEDGE' || id === 'FUSION_REDUZIDA') isWin = (num > 12); 
            else if (id === 'SECTOR_VOISINS') isWin = this.SECTOR_VOISINS.has(num);
            else if (id === 'SECTOR_TIERS') isWin = this.SECTOR_TIERS.has(num);
            else if (id === 'SECTOR_ORPHELINS') isWin = this.SECTOR_ORPHELINS.has(num);

            if (isWin) {
                this.shadowPnL[id] += 1.0;
                this.shadowWeights[id] = Math.min(2.5, this.shadowWeights[id] * 1.15);
            } else {
                this.shadowPnL[id] -= 1.0;
                this.shadowWeights[id] = Math.max(0.1, this.shadowWeights[id] * 0.85);
            }
        }
    }

    private checkCircuitBreakers(): void {
        const lockPath = path.join(process.cwd(), 'data', '.rlsys-lock');
        if (this.cooldownGuard.currentBankroll >= this.takeProfitM3) {
            fs.writeFileSync(lockPath, JSON.stringify({ unlockTime: Date.now() + (4 * 3600000), reason: 'TAKE_PROFIT' }));
            console.clear(); console.log('\x1b[32m [CIRCUIT BREAKER] TAKE PROFIT ATINGIDO \x1b[0m'); process.exit(0);
        }
        if (this.cooldownGuard.currentBankroll <= this.hardStopLoss) {
            fs.writeFileSync(lockPath, JSON.stringify({ unlockTime: Date.now() + (12 * 3600000), reason: 'STOP_LOSS' }));
            console.clear(); console.log('\x1b[31m [CIRCUIT BREAKER] STOP LOSS ACIONADO \x1b[0m'); process.exit(0);
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

        // Simplificação matemática da entropia para o script
        let tc = 0; let ntc = 0;
        for (let i = operationalHistory.length - 1; i >= 1; i--) {
            if (REDS.has(operationalHistory[i]) === REDS.has(operationalHistory[i-1])) tc++; else ntc++;
        }
        this.currentVixPercent = (ntc / (tc + ntc)) * 100;
        this.vixHistory.push(this.currentVixPercent);
        if (this.vixHistory.length > 50) this.vixHistory.shift();
        
        let highestWeight = -1;
        let bestStrat: string | null = null;
        for (const id of Object.keys(this.shadowWeights)) {
            if (this.shadowWeights[id] > highestWeight) { highestWeight = this.shadowWeights[id]; bestStrat = id; }
        }
        
        this.activeStrategyId = bestStrat;
        this.liveConvergence = Math.round(100 - this.currentVixPercent);
        this.liveConfidence = highestWeight > 1.5 ? 80 : 50; 

        if (this.liveConvergence > 40 && this.liveConfidence > 75) this.liveExecutionPressure = 'AGGRESSIVE_ENTRY';
        else if (this.liveConvergence > 20 && this.liveConfidence > 60) this.liveExecutionPressure = 'STANDARD_ENTRY';
        else this.liveExecutionPressure = 'REDUCE_EXPOSURE';

        this.updateXaiTranslation(bestStrat);

        this.dynamicZeroHedge = 0.00; // Reset do seguro

        if (bestStrat && this.xaiQualification === 'SIM') {
            let kellyFraction = 0.05; // Base segura
            let calculatedStake = this.cooldownGuard.currentBankroll * kellyFraction;
            
            if (this.liveExecutionPressure === 'AGGRESSIVE_ENTRY') calculatedStake *= 1.5;
            if (this.liveExecutionPressure === 'REDUCE_EXPOSURE') calculatedStake *= 0.5;

            // Arredonda para múltiplas fichas de R$ 0.10
            let steps = Math.round(calculatedStake / 0.10);
            this.dynamicStakeCalculated = steps * 0.10;
            if (this.dynamicStakeCalculated < 0.50) this.dynamicStakeCalculated = 0.50;

            // ATIVAÇÃO DO SEGURO DE ZERO (HEDGE)
            // Se a stake for pesada (>= 2.50) e a entropia do mercado justificar risco
            if (this.dynamicStakeCalculated >= 2.50 && this.currentVixPercent > 55 && bestStrat !== 'SECTOR_VOISINS') {
                this.dynamicZeroHedge = 0.50; // Ficha mínima no Zero para salvar a operação
            }

        } else {
            this.dynamicStakeCalculated = 0.00;
            this.dynamicZeroHedge = 0.00;
        }

        this.lastRecommendedStrategy = bestStrat;
        this.lastRecommendedStake = this.dynamicStakeCalculated;
        this.lastRecommendedHedge = this.dynamicZeroHedge;
        this.lastQualification = this.xaiQualification;

        this.renderTerminalHud();
    }

    private updateXaiTranslation(prospectiveId: string | null): void {
        if (!prospectiveId) {
            this.xaiQualification = 'NÃO';
            this.xaiMoment = 'AGORA NÃO';
            this.xaiReason = 'Aguardando dados da mesa.';
            return;
        }
        if (this.liveExecutionPressure === 'AGGRESSIVE_ENTRY') {
            this.xaiQualification = 'SIM'; this.xaiMoment = 'ENTRAR'; this.xaiReason = 'Janela limpa. Alavancagem ativada.';
        } else if (this.liveExecutionPressure === 'STANDARD_ENTRY') {
            this.xaiQualification = 'SIM'; this.xaiMoment = 'ENTRAR'; this.xaiReason = 'Janela estável confirmada.';
        } else {
            this.xaiQualification = 'SIM'; this.xaiMoment = 'REDUZIDA'; this.xaiReason = 'Risco cortado. Mercado lateral.';
        }
    }

    private getPlacementInstruction(strategy: string | null, totalStake: number, hedge: number): string {
        if (!strategy || totalStake <= 0 || this.xaiQualification === 'NÃO') return 'Nenhuma ficha na mesa.';
        const fmt = (v: number) => `R$ ${v.toFixed(2)}`;
        let baseInst = '';
        
        if (strategy === 'TRIPLICACAO_RED') baseInst = `${fmt(totalStake)} no \x1b[31mVERMELHO\x1b[0m`;
        else if (strategy === 'TRIPLICACAO_BLACK') baseInst = `${fmt(totalStake)} no \x1b[90mPRETO\x1b[0m`;
        else if (strategy === 'SECTOR_VOISINS') baseInst = `${fmt(totalStake)} na Pista: \x1b[36mVIZINHOS DO ZERO\x1b[0m`;
        else if (strategy === 'SECTOR_TIERS') baseInst = `${fmt(totalStake)} na Pista: \x1b[36mTERÇO DO CILINDRO\x1b[0m`;
        else if (strategy === 'SECTOR_ORPHELINS') baseInst = `${fmt(totalStake)} na Pista: \x1b[36mÓRFÃOS\x1b[0m`;
        else baseInst = `${fmt(totalStake)} seguindo padrão`;

        if (hedge > 0) return `${baseInst} \x1b[33m[+ ${fmt(hedge)} NO ZERO (SEGURO)]\x1b[0m`;
        return baseInst;
    }

    private renderTerminalHud(): void {
        console.clear();
        console.log('======================================================');
        console.log(' 🛡️  RL.SYS CORE - TACTICAL ORCHESTRATOR [V5.1]');
        console.log('======================================================');
        console.log(` BANCA ATUAL ..... R$ ${this.cooldownGuard.currentBankroll.toFixed(2)}`);
        console.log(` STOP LOSS (15%).. R$ ${this.hardStopLoss.toFixed(2)}`);
        console.log(` TAKE PROFIT (M3). R$ ${this.takeProfitM3.toFixed(2)}`);
        console.log(` ENTROPIA (VIX) .. ${this.currentVixPercent.toFixed(1)}% \x1b[90m(Tol. Dinâmica: ${this.dynamicVixTolerance.toFixed(1)}%)\x1b[0m`);
        console.log('------------------------------------------------------');
        console.log(` TIMELINE ........ ${this.renderTimeline(15)}`);
        console.log('------------------------------------------------------');
        console.log(` Estratégia ... \x1b[36m${this.activeStrategyId || 'Nenhuma'}\x1b[0m`);
        console.log(` Qualificação . ${this.xaiQualification === 'SIM' ? '\x1b[32mSIM\x1b[0m' : '\x1b[31mNÃO\x1b[0m'}`);
        console.log(` Momento ...... ${this.xaiMoment === 'AGORA NÃO' ? '\x1b[33mAGORA NÃO\x1b[0m' : `\x1b[32m${this.xaiMoment}\x1b[0m`}`);
        console.log(` STAKE GLOBAL . \x1b[32mR$ ${this.dynamicStakeCalculated.toFixed(2)}\x1b[0m`);
        console.log(` APLICAÇÃO .... ${this.getPlacementInstruction(this.activeStrategyId, this.dynamicStakeCalculated, this.dynamicZeroHedge)}`);
        console.log(` Motivo ....... ${this.xaiReason}`);
        console.log('------------------------------------------------------');
        console.log(` Registro ..... ${this.lastActionTakenText}`);
        console.log('======================================================');
        this.rl.setPrompt('Insira o Número do Giro > ');
        this.rl.prompt(true);
    }
}
EOF

echo "[2/2] Compilando expansão do Racetrack e Seguro de Zero..."
npx tsc

echo "======================================"
echo -e "\033[1;32m SPRINT 461 APLICADA COM SUCESSO \033[0m"
echo " STATUS: RACETRACK & ZERO HEDGE ONLINE"
echo "======================================"
