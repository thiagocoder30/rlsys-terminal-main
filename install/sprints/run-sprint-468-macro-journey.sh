#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 468"
echo " MACRO JOURNEY & HUD PROGRESS (V5.10)"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

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
    private macroBaseline: number = 50.00; // [NOVO] O Ponto Zero da sua jornada
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
    private pnlCurve: number[] = [];
    
    private shadowWeights: Record<string, number> = {};
    private shadowPnL: Record<string, number> = {};
    private takeProfitM3: number = 0;
    private hardStopLoss: number = 0;
    
    private sessionStartTime: number = Date.now();
    private sessionWins: number = 0;
    private sessionLosses: number = 0;
    private sessionPeak: number = 0;
    private sessionTrough: number = 0;

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
    private readonly SECTOR_FUSION = new Set([17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31]);

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
                const diffMs = lockData.unlockTime - Date.now();
                if (diffMs > 0) {
                    const unlockDate = new Date(lockData.unlockTime).toLocaleString('pt-BR');
                    const diffHrs = Math.floor(diffMs / 3600000);
                    const diffMins = Math.floor((diffMs % 3600000) / 60000);
                    const diffSecs = Math.floor((diffMs % 60000) / 1000);
                    
                    console.clear();
                    console.log('\x1b[31m======================================================');
                    console.log(' [ACESSO NEGADO] COOLDOWN INSTITUCIONAL ATIVO');
                    console.log('======================================================\x1b[0m');
                    console.log(` Motivo        : ${lockData.reason === 'STOP_LOSS' ? 'Limite de Perda Diário Atingido.' : 'Meta de Lucro Atingida.'}`);
                    console.log(` Liberação em  : \x1b[33m${unlockDate}\x1b[0m`);
                    console.log(` Tempo Restante: \x1b[36m${diffHrs}h ${diffMins}m ${diffSecs}s\x1b[0m`);
                    console.log('======================================================');
                    process.exit(0);
                } else { fs.unlinkSync(lockPath); }
            } catch (e) {}
        }

        this.savedState = this.bankrollRepo.load();
        if (this.savedState) {
            if (this.savedState.initialBankroll) this.initialBankroll = this.savedState.initialBankroll;
            if (this.savedState.macroBaseline) this.macroBaseline = this.savedState.macroBaseline;
        }
        
        this.sessionPeak = this.initialBankroll;
        this.sessionTrough = this.initialBankroll;
        this.sessionStartTime = Date.now();

        this.cooldownGuard = new DynamicEmotionalCooldownGuard(this.initialBankroll, this.savedState);
        this.pnlCurve = [this.initialBankroll];
        
        const totalTargetGain = this.cooldownGuard.nextMilestone - this.initialBankroll;
        this.takeProfitM3 = this.initialBankroll + (totalTargetGain * 0.75);
        this.hardStopLoss = this.initialBankroll * 0.85; 
        
        const baseStrats = Object.keys(AutoSettlementEngine.getStrategies());
        baseStrats.push('SECTOR_VOISINS', 'SECTOR_TIERS', 'SECTOR_ORPHELINS', 'FUSION_REDUZIDA');
        
        baseStrats.forEach(id => {
            this.shadowWeights[id] = 1.0;
            this.shadowPnL[id] = 0.0;
        });
        
        this.generateNextTrade();
        this.attachEventListeners();
    }

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

            // [NOVO] COMANDO JOURNEY (O SEU RAIO-X MACRO)
            if (cmd === 'journey') {
                console.clear();
                const current = this.cooldownGuard.currentBankroll;
                const pnlMacro = current - this.macroBaseline;
                const pnlMacroPct = (pnlMacro / this.macroBaseline) * 100;
                const pnlColor = pnlMacro >= 0 ? '\x1b[32m+' : '\x1b[31m';
                
                const m1 = this.macroBaseline * 2;
                const m2 = this.macroBaseline * 5;
                const m3 = this.macroBaseline * 10;
                
                const check = (target: number) => current >= target ? '\x1b[32m[✓]\x1b[0m' : '\x1b[90m[ ]\x1b[0m';
                const status = (target: number) => current >= target ? '\x1b[32mALCANÇADO!\x1b[0m' : `Faltam R$ ${(target - current).toFixed(2)}`;

                console.log('======================================================');
                console.log(' 🗺️  RL.SYS CORE - MACRO JOURNEY & MILESTONES');
                console.log('======================================================');
                console.log(` Capital Inicial (Macro) : R$ ${this.macroBaseline.toFixed(2)}`);
                console.log(` Capital Atual (Cofre)   : R$ ${current.toFixed(2)}`);
                console.log(` PnL Global Acumulado    : ${pnlColor}R$ ${pnlMacro.toFixed(2)} (${pnlMacroPct.toFixed(1)}%)\x1b[0m\n`);
                console.log(' [ DEGRAUS DE BLINDAGEM INSTITUCIONAL ]');
                console.log(` ${check(m1)} Milestone 1: Sobrevivência  (R$ ${m1.toFixed(2)}) - ${status(m1)}`);
                console.log(` ${check(m2)} Milestone 2: Consolidação   (R$ ${m2.toFixed(2)}) - ${status(m2)}`);
                console.log(` ${check(m3)} Milestone 3: Independência  (R$ ${m3.toFixed(2)}) - ${status(m3)}`);
                console.log('======================================================');
                console.log('Pressione ENTER para retornar ao HUD...');
                this.inputMode = 'VIEW_ONLY';
                return;
            }

            // [NOVO] DEFINE O PONTO ZERO DO MACRO
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
                    this.sessionPeak = newVal;
                    this.sessionTrough = newVal;
                    this.cooldownGuard = new DynamicEmotionalCooldownGuard(this.initialBankroll, this.savedState);
                    this.cooldownGuard.currentBankroll = newVal;
                    this.pnlCurve = [newVal]; 
                    const totalTargetGain = this.cooldownGuard.nextMilestone - this.initialBankroll;
                    this.takeProfitM3 = this.initialBankroll + (totalTargetGain * 0.75);
                    this.hardStopLoss = this.initialBankroll * 0.85; 
                    this.bankrollRepo.save({ initialBankroll: newVal, macroBaseline: this.macroBaseline });
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
            
            if (cmd === 'stats' || cmd.startsWith('calibrate ') || cmd.startsWith('clean ') || cmd.startsWith('backtest ') || cmd === 'weights') {
                this.lastActionTakenText = `\x1b[33mComando restrito. Digite help.\x1b[0m`;
                if (cmd === 'weights') {
                    console.clear();
                    console.log('======================================================');
                    console.log(' ⚖️  RL.SYS CORE - SHADOW TRADING & RL WEIGHTS');
                    console.log('======================================================');
                    Object.entries(this.shadowWeights).forEach(([id, w]) => {
                        const pnl = this.shadowPnL[id]; const pnlColor = pnl >= 0 ? '\x1b[32m' : '\x1b[31m';
                        console.log(` Estratégia: ${id.padEnd(20)} | PnL Monetário: ${pnlColor}${pnl > 0 ? '+' : ''}${pnl.toFixed(2)}\x1b[0m | Peso RL: ${Number(w).toFixed(2)}`);
                    });
                    console.log('======================================================');
                    console.log('Pressione ENTER para retornar ao HUD...');
                    this.inputMode = 'VIEW_ONLY'; return;
                }
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
                console.log(' provider <nome>      : Define mesa (pragmatic | evolution)');
                console.log(' setbankroll <valor>  : Ajusta banca de combate');
                console.log(' setmacro <valor>     : Define o Marco Zero da sua Jornada');
                console.log(' journey              : Painel contábil de Milestones');
                console.log(' sync <n1,n2>         : Injeta fita histórica (Warmup)');
                console.log(' weights              : Motor Shadow PnL e Pesos');
                console.log(' undo                 : Remove último número digitado');
                console.log(' exit / quit          : Encerra e salva');
                console.log('======================================================');
                console.log('Pressione ENTER para retornar...'); this.inputMode = 'VIEW_ONLY'; return;
            }

            if (cmd === 'exit' || cmd === 'quit') { this.exportTelemetry('USER_EXIT_COMMAND'); this.rl.close(); process.exit(0); }

            let isSkipped = false; let numStr = cmd;
            const skipMatch = cmd.match(/^[psnx]\s*(\d+)$/i);
            if (skipMatch) { isSkipped = true; numStr = skipMatch[1]; }
            const num = parseInt(numStr, 10);
            
            if (!isNaN(num) && num >= 0 && num <= 36) {
                this.mesaTracker.addNumber(num); this.localHistoryCache.push(num);
                if (this.lastQualification === 'SIM' && this.lastRecommendedStrategy && this.lastRecommendedStake > 0) {
                    if (isSkipped) {
                        this.processRealSettlement(num, true); this.processShadowTrading(num); this.generateNextTrade();
                    } else {
                        this.pendingNum = num; this.inputMode = 'CONFIRM_BET';
                        this.rl.setPrompt(`\x1b[33mVocê apostou e o resultado foi ${num}? (S/n) > \x1b[0m`); this.rl.prompt(true);
                    }
                } else {
                    this.processRealSettlement(num, false); this.processShadowTrading(num); this.generateNextTrade();
                }
            } else { this.renderTerminalHud(); }
        });
    }

    private processRealSettlement(num: number, isSkipped: boolean): void {
        const timeLog = new Date().toISOString();
        if (this.lastQualification === 'SIM' && this.lastRecommendedStrategy && this.lastRecommendedStake > 0) {
            if (isSkipped) {
                this.lastActionTakenText = `\x1b[33m[PULOU] Giro ${num} computado. Banca intacta.\x1b[0m`;
                this.pnlCurve.push(this.cooldownGuard.currentBankroll);
                return;
            }

            const REDS = new Set(AutoSettlementEngine.RED_NUMS);
            let isWin = false; let profitMultiplier = 1.0;
            const id = this.lastRecommendedStrategy;
            const hotCols = this.getHotColumns();

            if (num === 0 && id !== 'SECTOR_VOISINS') { isWin = false; } 
            else if (id === 'TRIPLICACAO_RED') isWin = REDS.has(num);
            else if (id === 'TRIPLICACAO_BLACK') isWin = (!REDS.has(num) && num !== 0);
            else if (id === 'TRIPLICACAO_EVEN') isWin = (num % 2 === 0 && num !== 0);
            else if (id === 'TRIPLICACAO_ODD') isWin = (num % 2 !== 0);
            else if (id === 'CROSS_GRID_HEDGE') { const colNum = (num % 3 === 0) ? 3 : (num % 3); isWin = hotCols.includes(colNum); profitMultiplier = 0.5; }
            else if (id === 'FUSION_REDUZIDA') { isWin = this.SECTOR_FUSION.has(num); profitMultiplier = 0.89; }
            else if (id === 'SECTOR_VOISINS') { isWin = this.SECTOR_VOISINS.has(num); profitMultiplier = 0.8; } 
            else if (id === 'SECTOR_TIERS') { isWin = this.SECTOR_TIERS.has(num); profitMultiplier = 2.0; } 
            else if (id === 'SECTOR_ORPHELINS') { isWin = this.SECTOR_ORPHELINS.has(num); profitMultiplier = 3.5; } 

            let profitOrLoss = 0; let hedgeResult = 0;
            if (this.lastRecommendedHedge > 0) {
                if (num === 0) hedgeResult = this.lastRecommendedHedge * 35; else hedgeResult = -this.lastRecommendedHedge; 
            }

            if (isWin) {
                this.sessionWins++; profitOrLoss = (this.lastRecommendedStake * profitMultiplier) + hedgeResult;
                this.cooldownGuard.currentBankroll += profitOrLoss;
                this.lastActionTakenText = `\x1b[32m[WIN] Acertou a Estratégia no ${num}. Lucro Líquido: +R$ ${profitOrLoss.toFixed(2)}\x1b[0m`;
            } else {
                this.sessionLosses++; profitOrLoss = -this.lastRecommendedStake + hedgeResult;
                this.cooldownGuard.currentBankroll += profitOrLoss;
                this.lastActionTakenText = `\x1b[31m[LOSS] Errou o ${num}. Risco Total: -R$ ${Math.abs(profitOrLoss).toFixed(2)}\x1b[0m`;
            }
            
            if (this.cooldownGuard.currentBankroll > this.sessionPeak) this.sessionPeak = this.cooldownGuard.currentBankroll;
            if (this.cooldownGuard.currentBankroll < this.sessionTrough) this.sessionTrough = this.cooldownGuard.currentBankroll;

            this.pnlCurve.push(this.cooldownGuard.currentBankroll);
            this.bankrollRepo.save({ initialBankroll: this.cooldownGuard.currentBankroll, macroBaseline: this.macroBaseline });
            this.checkCircuitBreakers();
        } else { this.lastActionTakenText = `\x1b[90m[TRACKING] Giro ${num} contabilizado.\x1b[0m`; }
    }

    private processShadowTrading(num: number): void {
        const REDS = new Set(AutoSettlementEngine.RED_NUMS); const hotCols = this.getHotColumns();
        for (const id of Object.keys(this.shadowWeights)) {
            if (this.disabledStrategies.has(id)) continue;
            let isWin = false; let profitMulti = 1.0;
            
            if (num === 0 && id !== 'SECTOR_VOISINS') isWin = false;
            else if (id === 'TRIPLICACAO_RED') { isWin = REDS.has(num); profitMulti = 1.0; }
            else if (id === 'TRIPLICACAO_BLACK') { isWin = (!REDS.has(num) && num !== 0); profitMulti = 1.0; }
            else if (id === 'TRIPLICACAO_EVEN') { isWin = (num % 2 === 0 && num !== 0); profitMulti = 1.0; }
            else if (id === 'TRIPLICACAO_ODD') { isWin = (num % 2 !== 0); profitMulti = 1.0; }
            else if (id === 'CROSS_GRID_HEDGE') { const colNum = (num % 3 === 0) ? 3 : (num % 3); isWin = hotCols.includes(colNum); profitMulti = 0.5; }
            else if (id === 'FUSION_REDUZIDA') { isWin = this.SECTOR_FUSION.has(num); profitMulti = 0.89; }
            else if (id === 'SECTOR_VOISINS') { isWin = this.SECTOR_VOISINS.has(num); profitMulti = 0.8; }
            else if (id === 'SECTOR_TIERS') { isWin = this.SECTOR_TIERS.has(num); profitMulti = 2.0; }
            else if (id === 'SECTOR_ORPHELINS') { isWin = this.SECTOR_ORPHELINS.has(num); profitMulti = 3.5; }

            if (isWin) {
                this.shadowPnL[id] += (1.0 * profitMulti); this.shadowWeights[id] = Math.min(2.5, this.shadowWeights[id] * 1.15);
            } else {
                this.shadowPnL[id] -= 1.0; this.shadowWeights[id] = Math.max(0.1, this.shadowWeights[id] * 0.85);
            }
        }
    }

    private generateInstitutionalReport(reason: string): void {
        const durationMs = Date.now() - this.sessionStartTime;
        const minutes = Math.floor(durationMs / 60000); const seconds = Math.floor((durationMs % 60000) / 1000);
        const pnl = this.cooldownGuard.currentBankroll - this.initialBankroll;
        const pnlColor = pnl >= 0 ? '\x1b[32m+' : '\x1b[31m';
        const winRate = (this.sessionWins + this.sessionLosses) > 0 ? (this.sessionWins / (this.sessionWins + this.sessionLosses)) * 100 : 0;
        const maxDrawdown = this.sessionPeak - this.sessionTrough;
        let bestStrat = 'N/A'; let bestW = -1;
        Object.entries(this.shadowWeights).forEach(([id, w]) => { if (w > bestW) { bestW = w; bestStrat = id; } });

        console.clear();
        const headerColor = reason === 'TAKE_PROFIT' ? '\x1b[32m' : '\x1b[31m';
        const reasonStr = reason === 'TAKE_PROFIT' ? 'META DE LUCRO (TAKE PROFIT) ATINGIDA' : 'LIMITE DE PERDA (STOP LOSS) ACIONADO';
        
        console.log(`${headerColor}======================================================`);
        console.log(` [CIRCUIT BREAKER] ${reasonStr}`);
        console.log(`======================================================\x1b[0m`);
        console.log(` \x1b[90mRelatório Institucional de Encerramento (Post-Mortem)\x1b[0m\n`);
        console.log(` ⏱️  Duração da Sessão   : ${minutes}m ${seconds}s`);
        console.log(` 💰 Capital Inicial     : R$ ${this.initialBankroll.toFixed(2)}`);
        console.log(` 🏦 Capital Final       : R$ ${this.cooldownGuard.currentBankroll.toFixed(2)}`);
        console.log(` 📈 PnL da Sessão       : ${pnlColor}R$ ${pnl.toFixed(2)}\x1b[0m\n`);
        console.log(` 📊 Win Rate Real       : ${winRate.toFixed(1)}% (${this.sessionWins}W / ${this.sessionLosses}L)`);
        console.log(` 📉 Max Drawdown Diário : -R$ ${maxDrawdown.toFixed(2)}`);
        console.log(` 🏆 Estratégia Dominante: \x1b[36m${bestStrat}\x1b[0m`);
        console.log(`\n${headerColor}======================================================`);
        console.log(` SESSÃO SELADA. TELA BLOQUEADA PELO RISCO.\x1b[0m`);
        console.log(`======================================================\n`);
    }

    private checkCircuitBreakers(): void {
        const lockPath = path.join(process.cwd(), 'data', '.rlsys-lock');
        if (this.cooldownGuard.currentBankroll >= this.takeProfitM3) {
            fs.writeFileSync(lockPath, JSON.stringify({ unlockTime: Date.now() + (4 * 3600000), reason: 'TAKE_PROFIT' }));
            this.broadcastLiveTelemetry(); this.generateInstitutionalReport('TAKE_PROFIT'); process.exit(0);
        }
        if (this.cooldownGuard.currentBankroll <= this.hardStopLoss) {
            fs.writeFileSync(lockPath, JSON.stringify({ unlockTime: Date.now() + (12 * 3600000), reason: 'STOP_LOSS' }));
            this.broadcastLiveTelemetry(); this.generateInstitutionalReport('STOP_LOSS'); process.exit(0);
        }
    }

    private generateNextTrade(): void {
        const fullHistory = this.mesaTracker.getHistory(); const REDS = new Set(AutoSettlementEngine.RED_NUMS);
        const operationalHistory = fullHistory.slice(-this.OPERATIONAL_WINDOW_SIZE);
        if (operationalHistory.length < 10) { this.updateXaiTranslation(null); this.renderTerminalHud(); this.broadcastLiveTelemetry(); return; }

        let tc = 0; let ntc = 0;
        for (let i = operationalHistory.length - 1; i >= 1; i--) {
            if (REDS.has(operationalHistory[i]) === REDS.has(operationalHistory[i-1])) tc++; else ntc++;
        }
        this.currentVixPercent = (ntc / (tc + ntc)) * 100;
        this.vixHistory.push(this.currentVixPercent); if (this.vixHistory.length > 50) this.vixHistory.shift();
        
        let highestWeight = -1; let bestStrat: string | null = null;
        for (const id of Object.keys(this.shadowWeights)) {
            if (this.shadowWeights[id] > highestWeight) { highestWeight = this.shadowWeights[id]; bestStrat = id; }
        }
        
        this.activeStrategyId = bestStrat; this.liveConvergence = Math.round(100 - this.currentVixPercent);
        this.liveConfidence = highestWeight > 1.5 ? 80 : 50; 

        if (this.liveConvergence > 40 && this.liveConfidence > 75) this.liveExecutionPressure = 'AGGRESSIVE_ENTRY';
        else if (this.liveConvergence > 20 && this.liveConfidence > 60) this.liveExecutionPressure = 'STANDARD_ENTRY';
        else this.liveExecutionPressure = 'REDUCE_EXPOSURE';

        this.updateXaiTranslation(bestStrat); this.dynamicZeroHedge = 0.00; 

        if (bestStrat && this.xaiQualification === 'SIM') {
            const isComplex = bestStrat.includes('CROSS_GRID_HEDGE') || bestStrat.includes('FUSION_REDUZIDA');
            const minFichas = isComplex ? 2 : 1; const tokenSize = this.provider === 'EVOLUTION' ? 0.50 : 0.10;
            const absoluteMin = minFichas * tokenSize;

            let kellyFraction = 0.05; let calculatedStake = this.cooldownGuard.currentBankroll * kellyFraction;
            if (this.liveExecutionPressure === 'AGGRESSIVE_ENTRY') calculatedStake *= 1.5;
            if (this.liveExecutionPressure === 'REDUCE_EXPOSURE') calculatedStake *= 0.5;

            let steps = Math.round(calculatedStake / tokenSize);
            if (steps % minFichas !== 0) steps += (minFichas - (steps % minFichas));
            this.dynamicStakeCalculated = steps * tokenSize;
            if (this.dynamicStakeCalculated < absoluteMin) this.dynamicStakeCalculated = absoluteMin;
            if (this.dynamicStakeCalculated >= 2.50 && this.currentVixPercent > 55 && bestStrat !== 'SECTOR_VOISINS') this.dynamicZeroHedge = tokenSize; 
        } else { this.dynamicStakeCalculated = 0.00; this.dynamicZeroHedge = 0.00; }

        this.lastRecommendedStrategy = bestStrat; this.lastRecommendedStake = this.dynamicStakeCalculated;
        this.lastRecommendedHedge = this.dynamicZeroHedge; this.lastQualification = this.xaiQualification;

        this.renderTerminalHud(); this.broadcastLiveTelemetry(); 
    }

    private updateXaiTranslation(prospectiveId: string | null): void {
        if (!prospectiveId) { this.xaiQualification = 'NÃO'; this.xaiMoment = 'AGORA NÃO'; this.xaiReason = 'Aguardando dados.'; return; }
        if (this.liveExecutionPressure === 'AGGRESSIVE_ENTRY') { this.xaiQualification = 'SIM'; this.xaiMoment = 'ENTRAR'; this.xaiReason = 'Janela limpa. Alavancagem ativada.'; }
        else if (this.liveExecutionPressure === 'STANDARD_ENTRY') { this.xaiQualification = 'SIM'; this.xaiMoment = 'ENTRAR'; this.xaiReason = 'Janela estável confirmada.'; }
        else { this.xaiQualification = 'SIM'; this.xaiMoment = 'REDUZIDA'; this.xaiReason = 'Risco cortado. Mercado lateral.'; }
    }

    private getPlacementInstruction(strategy: string | null, totalStake: number, hedge: number): string {
        if (!strategy || totalStake <= 0 || this.xaiQualification === 'NÃO') return 'Nenhuma ficha na mesa.';
        const fmt = (v: number) => `R$ ${v.toFixed(2)}`; let baseInst = '';
        
        if (strategy === 'TRIPLICACAO_RED') baseInst = `${fmt(totalStake)} no \x1b[31mVERMELHO\x1b[0m`;
        else if (strategy === 'TRIPLICACAO_BLACK') baseInst = `${fmt(totalStake)} no \x1b[90mPRETO\x1b[0m`;
        else if (strategy === 'TRIPLICACAO_EVEN') baseInst = `${fmt(totalStake)} no PAR`;
        else if (strategy === 'TRIPLICACAO_ODD') baseInst = `${fmt(totalStake)} no ÍMPAR`;
        else if (strategy === 'CROSS_GRID_HEDGE') {
            const hotCols = this.getHotColumns();
            baseInst = `${fmt(totalStake / 2)} na [\x1b[36mCOLUNA ${hotCols[0]}\x1b[0m] e ${fmt(totalStake / 2)} na [\x1b[36mCOLUNA ${hotCols[1]}\x1b[0m]`;
        }
        else if (strategy === 'FUSION_REDUZIDA') baseInst = `${fmt(totalStake)} na Pista: \x1b[36mFUSION (Setor 23 / 19 nums)\x1b[0m`;
        else if (strategy === 'SECTOR_VOISINS') baseInst = `${fmt(totalStake)} na Pista: \x1b[36mVIZINHOS DO ZERO\x1b[0m`;
        else if (strategy === 'SECTOR_TIERS') baseInst = `${fmt(totalStake)} na Pista: \x1b[36mTERÇO DO CILINDRO\x1b[0m`;
        else if (strategy === 'SECTOR_ORPHELINS') baseInst = `${fmt(totalStake)} na Pista: \x1b[36mÓRFÃOS\x1b[0m`;
        else baseInst = `${fmt(totalStake)} seguindo padrão`;

        if (hedge > 0) return `${baseInst} \x1b[33m[+ ${fmt(hedge)} NO ZERO (SEGURO)]\x1b[0m`;
        return baseInst;
    }

    private renderTerminalHud(): void {
        const current = this.cooldownGuard.currentBankroll;
        const mstones = [this.macroBaseline * 2, this.macroBaseline * 5, this.macroBaseline * 10];
        let nextTarget = mstones[mstones.length - 1];
        let prevTarget = this.macroBaseline;
        for (let i = 0; i < mstones.length; i++) {
            if (current < mstones[i]) {
                nextTarget = mstones[i];
                if (i > 0) prevTarget = mstones[i-1];
                break;
            }
        }
        let progressPct = 0;
        if (current >= mstones[mstones.length-1]) progressPct = 100;
        else if (current <= this.macroBaseline) progressPct = 0;
        else progressPct = ((current - prevTarget) / (nextTarget - prevTarget)) * 100;
        
        const filled = Math.min(10, Math.max(0, Math.floor(progressPct / 10)));
        const bar = '[' + '\x1b[32m█\x1b[0m'.repeat(filled) + '\x1b[90m░\x1b[0m'.repeat(10 - filled) + ']';

        console.clear();
        console.log('======================================================');
        console.log(' 🛡️  RL.SYS CORE - TACTICAL ORCHESTRATOR [V5.10]');
        console.log('======================================================');
        console.log(` MESA / PROVEDOR . \x1b[36m${this.provider}\x1b[0m (Ficha Mín: R$ ${this.provider === 'EVOLUTION' ? '0.50' : '0.10'})`);
        console.log(` BANCA ATUAL ..... R$ ${current.toFixed(2)}`);
        console.log(` JORNADA MACRO ... ${bar} ${progressPct.toFixed(1)}% (Alvo: R$ ${nextTarget.toFixed(2)})`);
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

echo "[2/2] Compilando Orquestrador com Macro Tracker..."
npx tsc

echo "======================================"
echo -e "\033[1;32m COMPILAÇÃO V5.10 CONCLUÍDA \033[0m"
echo " STATUS: MILESTONE TRACKER ATIVADO"
echo "======================================"
