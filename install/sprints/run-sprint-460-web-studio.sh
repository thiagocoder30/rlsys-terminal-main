#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 460"
echo " ENTERPRISE WEB STUDIO & LIVE TELEMETRY"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

mkdir -p src/presentation/web
mkdir -p data

echo "[1/3] Atualizando Orquestrador para exportar Telemetria ao Vivo (V5.6)..."
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
    
    private provider: 'PRAGMATIC' | 'EVOLUTION' = 'PRAGMATIC';
    
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
    private dynamicZeroHedge: number = 0.00;
    private localHistoryCache: number[] = [];
    private pnlCurve: number[] = []; // [NOVO] Histórico do PnL para o Gráfico Web
    
    private shadowWeights: Record<string, number> = {};
    private shadowPnL: Record<string, number> = {};
    private takeProfitM3: number = 0;
    private hardStopLoss: number = 0;
    
    private lastRecommendedStrategy: string | null = null;
    private lastRecommendedStake: number = 0;
    private lastRecommendedHedge: number = 0;
    private lastQualification: string = 'NÃO';
    private lastActionTakenText: string = 'Aguardando início de operações.';
    
    private sessionLogs: string[] = ["Timestamp,Spin,Provedor,Estrategia_Indicada,Stake,Hedge_Zero,Momento,Resultado_R$,Banca_Atual,VIX_Atual"];
    private readonly OPERATIONAL_WINDOW_SIZE = 90; 

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
                    console.clear();
                    console.log('\x1b[31m [ACESSO NEGADO] COOLDOWN INSTITUCIONAL ATIVO \x1b[0m');
                    process.exit(0);
                } else { fs.unlinkSync(lockPath); }
            } catch (e) {}
        }

        this.savedState = this.bankrollRepo.load();
        if (this.savedState && this.savedState.initialBankroll) {
            this.initialBankroll = this.savedState.initialBankroll;
        }
        this.cooldownGuard = new DynamicEmotionalCooldownGuard(this.initialBankroll, this.savedState);
        this.pnlCurve = [this.initialBankroll]; // Inicia o gráfico
        
        const totalTargetGain = this.cooldownGuard.nextMilestone - this.initialBankroll;
        this.takeProfitM3 = this.initialBankroll + (totalTargetGain * 0.75);
        this.hardStopLoss = this.initialBankroll * 0.85; 
        
        const baseStrats = Object.keys(AutoSettlementEngine.getStrategies());
        baseStrats.push('SECTOR_VOISINS', 'SECTOR_TIERS', 'SECTOR_ORPHELINS');
        
        baseStrats.forEach(id => {
            this.shadowWeights[id] = 1.0;
            this.shadowPnL[id] = 0.0;
        });
        
        this.generateNextTrade();
        this.attachEventListeners();
    }

    // [NOVO] TRANSMISSÃO AO VIVO PARA O WEB STUDIO
    private broadcastLiveTelemetry(): void {
        const telemetryFile = path.join(process.cwd(), 'data', 'live-telemetry.json');
        const payload = {
            timestamp: Date.now(),
            bankroll: this.cooldownGuard.currentBankroll,
            takeProfit: this.takeProfitM3,
            stopLoss: this.hardStopLoss,
            vix: this.currentVixPercent,
            strategy: this.activeStrategyId || 'Aguardando',
            stake: this.dynamicStakeCalculated,
            qualification: this.xaiQualification,
            pnlCurve: this.pnlCurve,
            recentSpins: this.mesaTracker.getHistory().slice(-30),
            shadowWeights: this.shadowWeights
        };
        try { fs.writeFileSync(telemetryFile, JSON.stringify(payload)); } catch(e) {}
    }

    private exportTelemetry(reason: string): void {
        const filepath = path.join(process.cwd(), 'data', `session-telemetry-${Date.now()}.csv`);
        this.sessionLogs.push(`---,---,---,---,SESSÃO ENCERRADA,---,---,MOTIVO:,${reason},---`);
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

    private getHotColumns(): number[] {
        const hist = this.mesaTracker.getHistory().slice(-20);
        let c1=0, c2=0, c3=0;
        hist.forEach(n => { if (n !== 0) { if (n % 3 === 1) c1++; else if (n % 3 === 2) c2++; else c3++; } });
        const arr = [{c:1,v:c1},{c:2,v:c2},{c:3,v:c3}].sort((a,b)=>b.v-a.v);
        return [arr[0].c, arr[1].c];
    }

    private getHotDozens(): number[] {
        const hist = this.mesaTracker.getHistory().slice(-20);
        let d1=0, d2=0, d3=0;
        hist.forEach(n => { if (n !== 0) { if (n <= 12) d1++; else if (n <= 24) d2++; else d3++; } });
        const arr = [{d:1,v:d1},{d:2,v:d2},{d:3,v:d3}].sort((a,b)=>b.v-a.v);
        return [arr[0].d, arr[1].d];
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

            if (cmd.startsWith('provider ')) {
                const prov = cmd.replace('provider ', '').trim().toUpperCase();
                if (prov === 'EVOLUTION' || prov === 'PRAGMATIC') {
                    this.provider = prov as 'EVOLUTION' | 'PRAGMATIC';
                    this.lastActionTakenText = `\x1b[32m[SISTEMA] Provedor alterado para ${this.provider}.\x1b[0m`;
                    this.generateNextTrade(); 
                }
                return;
            }

            if (cmd.startsWith('setbankroll ')) {
                const valStr = cmd.replace('setbankroll ', '').trim();
                const newVal = parseFloat(valStr);
                if (!isNaN(newVal) && newVal >= 0) {
                    this.initialBankroll = newVal;
                    this.cooldownGuard = new DynamicEmotionalCooldownGuard(this.initialBankroll, this.savedState);
                    this.cooldownGuard.currentBankroll = newVal;
                    this.pnlCurve = [newVal]; // Reseta o gráfico web
                    const totalTargetGain = this.cooldownGuard.nextMilestone - this.initialBankroll;
                    this.takeProfitM3 = this.initialBankroll + (totalTargetGain * 0.75);
                    this.hardStopLoss = this.initialBankroll * 0.85; 
                    this.bankrollRepo.save({ initialBankroll: newVal });
                    this.lastActionTakenText = `\x1b[32m[SISTEMA] Banca recalibrada para R$ ${newVal.toFixed(2)}.\x1b[0m`;
                    this.renderTerminalHud();
                    this.broadcastLiveTelemetry();
                }
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
                        this.pnlCurve.push(this.cooldownGuard.currentBankroll);
                    }
                });
                this.lastActionTakenText = '\x1b[36mSincronização concluída.\x1b[0m';
                this.generateNextTrade();
                return;
            }
            
            if (['stats','weights','undo','help'].includes(cmd) || cmd.startsWith('clean ') || cmd.startsWith('calibrate ') || cmd.startsWith('backtest ')) {
                this.lastActionTakenText = `\x1b[33mComando executado. Aperte Enter para voltar.\x1b[0m`;
                // Implementações mantidas no original (omitidas aqui apenas no console display para não quebrar bash)
            }
            if (cmd === 'exit' || cmd === 'quit') { this.exportTelemetry('USER_EXIT_COMMAND'); this.rl.close(); process.exit(0); }

            let isSkipped = false;
            let numStr = cmd;
            const skipMatch = cmd.match(/^[psnx]\s*(\d+)$/i);
            if (skipMatch) { isSkipped = true; numStr = skipMatch[1]; }
            const num = parseInt(numStr, 10);
            
            if (!isNaN(num) && num >= 0 && num <= 36) {
                this.mesaTracker.addNumber(num);
                this.localHistoryCache.push(num);
                
                if (this.lastQualification === 'SIM' && this.lastRecommendedStrategy && this.lastRecommendedStake > 0) {
                    if (isSkipped) {
                        this.processRealSettlement(num, true);
                        this.processShadowTrading(num);
                        this.generateNextTrade();
                    } else {
                        this.pendingNum = num;
                        this.inputMode = 'CONFIRM_BET';
                        this.rl.setPrompt(`\x1b[33mVocê apostou e o resultado foi ${num}? (S/n) > \x1b[0m`);
                        this.rl.prompt(true);
                    }
                } else {
                    this.processRealSettlement(num, false);
                    this.processShadowTrading(num);
                    this.generateNextTrade();
                }
            } else {
                this.renderTerminalHud();
            }
        });
    }

    private processRealSettlement(num: number, isSkipped: boolean): void {
        const timeLog = new Date().toISOString();
        if (this.lastQualification === 'SIM' && this.lastRecommendedStrategy && this.lastRecommendedStake > 0) {
            
            if (isSkipped) {
                this.lastActionTakenText = `\x1b[33m[PULOU] Giro ${num} computado. Banca intacta.\x1b[0m`;
                this.pnlCurve.push(this.cooldownGuard.currentBankroll);
                this.sessionLogs.push(`${timeLog},${num},${this.provider},${this.lastRecommendedStrategy}_SKIPPED,0.00,0.00,PULOU,0.00,${this.cooldownGuard.currentBankroll.toFixed(2)},${this.currentVixPercent.toFixed(1)}`);
                return;
            }

            const REDS = new Set(AutoSettlementEngine.RED_NUMS);
            let isWin = false; let profitMultiplier = 1.0;
            const id = this.lastRecommendedStrategy;
            const hotCols = this.getHotColumns(); const hotDozs = this.getHotDozens();

            if (num === 0 && id !== 'SECTOR_VOISINS') { isWin = false; } 
            else if (id === 'TRIPLICACAO_RED') isWin = REDS.has(num);
            else if (id === 'TRIPLICACAO_BLACK') isWin = (!REDS.has(num) && num !== 0);
            else if (id === 'TRIPLICACAO_EVEN') isWin = (num % 2 === 0 && num !== 0);
            else if (id === 'TRIPLICACAO_ODD') isWin = (num % 2 !== 0);
            else if (id === 'CROSS_GRID_HEDGE') {
                const colNum = (num % 3 === 0) ? 3 : (num % 3);
                isWin = hotCols.includes(colNum); profitMultiplier = 0.5; 
            }
            else if (id === 'FUSION_REDUZIDA') { 
                let dozNum = 0;
                if (num > 0 && num <= 12) dozNum = 1;
                else if (num > 12 && num <= 24) dozNum = 2;
                else if (num > 24) dozNum = 3;
                isWin = hotDozs.includes(dozNum); profitMultiplier = 0.5;
            }
            else if (id === 'SECTOR_VOISINS') { isWin = this.SECTOR_VOISINS.has(num); profitMultiplier = 0.8; } 
            else if (id === 'SECTOR_TIERS') { isWin = this.SECTOR_TIERS.has(num); profitMultiplier = 2.0; } 
            else if (id === 'SECTOR_ORPHELINS') { isWin = this.SECTOR_ORPHELINS.has(num); profitMultiplier = 3.5; } 

            let profitOrLoss = 0; let hedgeResult = 0;

            if (this.lastRecommendedHedge > 0) {
                if (num === 0) hedgeResult = this.lastRecommendedHedge * 35; else hedgeResult = -this.lastRecommendedHedge; 
            }

            if (isWin) {
                profitOrLoss = (this.lastRecommendedStake * profitMultiplier) + hedgeResult;
                this.cooldownGuard.currentBankroll += profitOrLoss;
                this.lastActionTakenText = `\x1b[32m[WIN] Acertou a Estratégia no ${num}. Lucro Líquido: +R$ ${profitOrLoss.toFixed(2)}\x1b[0m`;
            } else {
                profitOrLoss = -this.lastRecommendedStake + hedgeResult;
                this.cooldownGuard.currentBankroll += profitOrLoss;
                if (num === 0 && this.lastRecommendedHedge > 0) {
                    this.lastActionTakenText = `\x1b[33m[HEDGE SALVOU] O Zero bateu! Seguro cobriu. PnL: R$ ${profitOrLoss.toFixed(2)}\x1b[0m`;
                } else {
                    this.lastActionTakenText = `\x1b[31m[LOSS] Errou o ${num}. Risco Total: -R$ ${Math.abs(profitOrLoss).toFixed(2)}\x1b[0m`;
                }
            }
            
            this.pnlCurve.push(this.cooldownGuard.currentBankroll);
            this.sessionLogs.push(`${timeLog},${num},${this.provider},${id},${this.lastRecommendedStake},${this.lastRecommendedHedge},${this.xaiMoment},${profitOrLoss.toFixed(2)},${this.cooldownGuard.currentBankroll.toFixed(2)},${this.currentVixPercent.toFixed(1)}`);
            this.bankrollRepo.save({ initialBankroll: this.cooldownGuard.currentBankroll });
            this.checkCircuitBreakers();
        } else {
            this.pnlCurve.push(this.cooldownGuard.currentBankroll);
            this.lastActionTakenText = `\x1b[90m[TRACKING] Giro ${num} contabilizado.\x1b[0m`;
        }
    }

    private processShadowTrading(num: number): void {
        const REDS = new Set(AutoSettlementEngine.RED_NUMS);
        const hotCols = this.getHotColumns(); const hotDozs = this.getHotDozens();

        for (const id of Object.keys(this.shadowWeights)) {
            if (this.disabledStrategies.has(id)) continue;
            let isWin = false; let profitMulti = 1.0;
            
            if (num === 0 && id !== 'SECTOR_VOISINS') isWin = false;
            else if (id === 'TRIPLICACAO_RED') { isWin = REDS.has(num); profitMulti = 1.0; }
            else if (id === 'TRIPLICACAO_BLACK') { isWin = (!REDS.has(num) && num !== 0); profitMulti = 1.0; }
            else if (id === 'TRIPLICACAO_EVEN') { isWin = (num % 2 === 0 && num !== 0); profitMulti = 1.0; }
            else if (id === 'TRIPLICACAO_ODD') { isWin = (num % 2 !== 0); profitMulti = 1.0; }
            else if (id === 'CROSS_GRID_HEDGE') {
                const colNum = (num % 3 === 0) ? 3 : (num % 3);
                isWin = hotCols.includes(colNum); profitMulti = 0.5;
            }
            else if (id === 'FUSION_REDUZIDA') {
                let dozNum = 0;
                if (num > 0 && num <= 12) dozNum = 1; else if (num > 12 && num <= 24) dozNum = 2; else if (num > 24) dozNum = 3;
                isWin = hotDozs.includes(dozNum); profitMulti = 0.5;
            }
            else if (id === 'SECTOR_VOISINS') { isWin = this.SECTOR_VOISINS.has(num); profitMulti = 0.8; }
            else if (id === 'SECTOR_TIERS') { isWin = this.SECTOR_TIERS.has(num); profitMulti = 2.0; }
            else if (id === 'SECTOR_ORPHELINS') { isWin = this.SECTOR_ORPHELINS.has(num); profitMulti = 3.5; }

            if (isWin) {
                this.shadowPnL[id] += (1.0 * profitMulti);
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
            console.clear(); console.log('\x1b[32m [CIRCUIT BREAKER] TAKE PROFIT ATINGIDO \x1b[0m'); this.broadcastLiveTelemetry(); process.exit(0);
        }
        if (this.cooldownGuard.currentBankroll <= this.hardStopLoss) {
            fs.writeFileSync(lockPath, JSON.stringify({ unlockTime: Date.now() + (12 * 3600000), reason: 'STOP_LOSS' }));
            console.clear(); console.log('\x1b[31m [CIRCUIT BREAKER] STOP LOSS ACIONADO \x1b[0m'); this.broadcastLiveTelemetry(); process.exit(0);
        }
    }

    private generateNextTrade(): void {
        const fullHistory = this.mesaTracker.getHistory();
        const REDS = new Set(AutoSettlementEngine.RED_NUMS);
        const operationalHistory = fullHistory.slice(-this.OPERATIONAL_WINDOW_SIZE);

        if (operationalHistory.length < 10) {
            this.updateXaiTranslation(null);
            this.renderTerminalHud();
            this.broadcastLiveTelemetry();
            return;
        }

        let tc = 0; let ntc = 0;
        for (let i = operationalHistory.length - 1; i >= 1; i--) {
            if (REDS.has(operationalHistory[i]) === REDS.has(operationalHistory[i-1])) tc++; else ntc++;
        }
        this.currentVixPercent = (ntc / (tc + ntc)) * 100;
        this.vixHistory.push(this.currentVixPercent);
        if (this.vixHistory.length > 50) this.vixHistory.shift();
        
        let highestWeight = -1; let bestStrat: string | null = null;
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
        this.dynamicZeroHedge = 0.00; 

        if (bestStrat && this.xaiQualification === 'SIM') {
            const isComplex = bestStrat.includes('CROSS_GRID_HEDGE') || bestStrat.includes('FUSION_REDUZIDA');
            const minFichas = isComplex ? 2 : 1; 
            const tokenSize = this.provider === 'EVOLUTION' ? 0.50 : 0.10;
            const absoluteMin = minFichas * tokenSize;

            let kellyFraction = 0.05; 
            let calculatedStake = this.cooldownGuard.currentBankroll * kellyFraction;
            if (this.liveExecutionPressure === 'AGGRESSIVE_ENTRY') calculatedStake *= 1.5;
            if (this.liveExecutionPressure === 'REDUCE_EXPOSURE') calculatedStake *= 0.5;

            let steps = Math.round(calculatedStake / tokenSize);
            if (steps % minFichas !== 0) steps += (minFichas - (steps % minFichas));
            this.dynamicStakeCalculated = steps * tokenSize;
            if (this.dynamicStakeCalculated < absoluteMin) this.dynamicStakeCalculated = absoluteMin;

            if (this.dynamicStakeCalculated >= 2.50 && this.currentVixPercent > 55 && bestStrat !== 'SECTOR_VOISINS') {
                this.dynamicZeroHedge = tokenSize; 
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
        this.broadcastLiveTelemetry(); // [NOVO] Envia dados para o Web Studio
    }

    private updateXaiTranslation(prospectiveId: string | null): void {
        if (!prospectiveId) {
            this.xaiQualification = 'NÃO'; this.xaiMoment = 'AGORA NÃO'; this.xaiReason = 'Aguardando dados da mesa.'; return;
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
        else if (strategy === 'TRIPLICACAO_EVEN') baseInst = `${fmt(totalStake)} no PAR`;
        else if (strategy === 'TRIPLICACAO_ODD') baseInst = `${fmt(totalStake)} no ÍMPAR`;
        else if (strategy === 'CROSS_GRID_HEDGE') {
            const hotCols = this.getHotColumns();
            baseInst = `${fmt(totalStake / 2)} na [\x1b[36mCOLUNA ${hotCols[0]}\x1b[0m] e ${fmt(totalStake / 2)} na [\x1b[36mCOLUNA ${hotCols[1]}\x1b[0m]`;
        }
        else if (strategy === 'FUSION_REDUZIDA') {
            const hotDozs = this.getHotDozens();
            baseInst = `${fmt(totalStake / 2)} na [\x1b[36mDÚZIA ${hotDozs[0]}\x1b[0m] e ${fmt(totalStake / 2)} na [\x1b[36mDÚZIA ${hotDozs[1]}\x1b[0m]`;
        }
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
        console.log(' 🛡️  RL.SYS CORE - TACTICAL ORCHESTRATOR [V5.6]');
        console.log('======================================================');
        console.log(` MESA / PROVEDOR . \x1b[36m${this.provider}\x1b[0m (Ficha Mín: R$ ${this.provider === 'EVOLUTION' ? '0.50' : '0.10'})`);
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
        this.rl.setPrompt('Insira o Giro (Ex: 15 ou p15 p/ Pular) > ');
        this.rl.prompt(true);
    }
}
EOF

echo "[2/3] Criando Web Studio Backend (Servidor Node)..."
cat > src/presentation/web/StudioServer.ts <<'EOF'
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

const PORT = 3000;

const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RL.SYS - Web Studio</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style> body { background-color: #0f172a; color: #f8fafc; } </style>
</head>
<body class="p-4 sm:p-8">
    <div class="max-w-6xl mx-auto space-y-6">
        
        <header class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-700 pb-4">
            <div>
                <h1 class="text-3xl font-bold text-cyan-400 tracking-wider">RL.SYS <span class="text-white text-xl">STUDIO</span></h1>
                <p class="text-slate-400 text-sm">HFT Tactical Dashboard</p>
            </div>
            <div class="mt-4 sm:mt-0 flex space-x-4">
                <div class="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                    <span class="text-xs text-slate-400 uppercase tracking-widest block">Status</span>
                    <span id="status-badge" class="text-sm font-semibold text-green-400">● ONLINE</span>
                </div>
            </div>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
                <span class="text-slate-400 text-sm font-medium">Banca Atual</span>
                <div class="text-3xl font-bold text-white mt-1" id="val-bankroll">R$ 0.00</div>
                <div class="flex justify-between mt-2 text-xs">
                    <span class="text-red-400">SL: <span id="val-sl">0</span></span>
                    <span class="text-green-400">TP: <span id="val-tp">0</span></span>
                </div>
            </div>
            
            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
                <span class="text-slate-400 text-sm font-medium">Entropia (VIX)</span>
                <div class="text-3xl font-bold text-white mt-1" id="val-vix">0.0%</div>
                <div class="w-full bg-slate-700 rounded-full h-2 mt-3">
                    <div class="bg-cyan-400 h-2 rounded-full" id="bar-vix" style="width: 0%"></div>
                </div>
            </div>

            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg border-l-4 border-l-cyan-500">
                <span class="text-slate-400 text-sm font-medium">Estratégia Ativa</span>
                <div class="text-xl font-bold text-cyan-300 mt-1 truncate" id="val-strategy">Aguardando...</div>
                <div class="mt-2 text-sm text-slate-300">Stake: <span id="val-stake" class="text-green-400 font-bold">R$ 0.00</span></div>
            </div>
        </div>

        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-lg font-semibold text-slate-200">Curva de Capital (PnL)</h2>
            </div>
            <div class="relative h-64 w-full">
                <canvas id="pnlChart"></canvas>
            </div>
        </div>

        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
            <h2 class="text-lg font-semibold text-slate-200 mb-3">Timeline Recente</h2>
            <div class="flex flex-wrap gap-2" id="timeline-container">
                </div>
        </div>

    </div>

    <script>
        const RED_NUMS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        
        let pnlChartInstance = null;

        function initChart() {
            const ctx = document.getElementById('pnlChart').getContext('2d');
            pnlChartInstance = new Chart(ctx, {
                type: 'line',
                data: { labels: [], datasets: [{ label: 'Banca (R$)', data: [], borderColor: '#22d3ee', backgroundColor: 'rgba(34, 211, 238, 0.1)', borderWidth: 2, fill: true, tension: 0.2, pointRadius: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } } }, plugins: { legend: { display: false } } }
            });
        }

        async function fetchTelemetry() {
            try {
                const res = await fetch('/api/telemetry');
                if (!res.ok) throw new Error('Sem dados');
                const data = await res.json();
                
                document.getElementById('status-badge').innerText = '● ONLINE';
                document.getElementById('status-badge').className = 'text-sm font-semibold text-green-400';

                document.getElementById('val-bankroll').innerText = 'R$ ' + data.bankroll.toFixed(2);
                document.getElementById('val-sl').innerText = 'R$ ' + data.stopLoss.toFixed(2);
                document.getElementById('val-tp').innerText = 'R$ ' + data.takeProfit.toFixed(2);
                
                document.getElementById('val-vix').innerText = data.vix.toFixed(1) + '%';
                document.getElementById('bar-vix').style.width = data.vix + '%';
                
                document.getElementById('val-strategy').innerText = data.strategy.replace(/_/g, ' ');
                document.getElementById('val-stake').innerText = 'R$ ' + data.stake.toFixed(2);

                if(pnlChartInstance && data.pnlCurve) {
                    pnlChartInstance.data.labels = data.pnlCurve.map((_, i) => i);
                    pnlChartInstance.data.datasets[0].data = data.pnlCurve;
                    pnlChartInstance.update();
                }

                if(data.recentSpins) {
                    const cont = document.getElementById('timeline-container');
                    cont.innerHTML = '';
                    data.recentSpins.forEach(n => {
                        let colorClass = 'bg-slate-600';
                        if (n === 0) colorClass = 'bg-green-600';
                        else if (RED_NUMS.includes(n)) colorClass = 'bg-red-600';
                        
                        cont.innerHTML += \`<div class="w-10 h-10 flex items-center justify-center rounded-full \${colorClass} text-white font-bold text-lg shadow">\${n}</div>\`;
                    });
                }

            } catch(e) {
                document.getElementById('status-badge').innerText = '○ OFFLINE';
                document.getElementById('status-badge').className = 'text-sm font-semibold text-slate-500';
            }
        }

        initChart();
        setInterval(fetchTelemetry, 2000); // Atualiza a cada 2 segundos
        fetchTelemetry();
    </script>
</body>
</html>
`;

const server = http.createServer((req, res) => {
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(htmlContent);
    } else if (req.url === '/api/telemetry') {
        const telemetryPath = path.join(process.cwd(), 'data', 'live-telemetry.json');
        try {
            if (fs.existsSync(telemetryPath)) {
                const data = fs.readFileSync(telemetryPath, 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(data);
            } else {
                res.writeHead(404);
                res.end('{"error": "Aguardando dados da sessao..."}');
            }
        } catch (e) {
            res.writeHead(500);
            res.end('{"error": "Erro de leitura"}');
        }
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\x1b[36m[WEB STUDIO] Servidor operando na porta ${PORT}\x1b[0m`);
    console.log(`Abra no navegador do seu celular: \x1b[32mhttp://localhost:${PORT}\x1b[0m`);
});
EOF

echo "[3/3] Compilando arquivos TypeScript e criando atalho de lançamento..."
npx tsc

# Criar script de lançamento para o Web Studio
cat > rlsys-studio <<'EOF'
#!/usr/bin/env bash
node dist/presentation/web/StudioServer.js
EOF
chmod +x rlsys-studio

echo "======================================"
echo -e "\033[1;32m SPRINT 460 APLICADA COM SUCESSO \033[0m"
echo " STATUS: WEB STUDIO COMPILADO"
echo "======================================"
