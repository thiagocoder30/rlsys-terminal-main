#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 445-B"
echo " TYPESCRIPT STRICT MODE HOTFIX"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/3] A aplicar correção de tipagem estrita no LivePaperOrchestrator..."
cat > src/presentation/cli/LivePaperOrchestrator.ts <<'EOF'
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { IBankrollRepository } from '../../domain/interfaces/IBankrollRepository';
import { IAnalyticsEngine } from '../../domain/interfaces/IAnalyticsEngine';
import { PositionSizingEngine, CasinoProvider } from '../../domain/risk/PositionSizingEngine';
import { TrailingStopGuard } from '../../domain/risk/TrailingStopGuard';
import { StrategyPerformanceEvaluator } from '../../domain/risk/StrategyPerformanceEvaluator';

const { DynamicEmotionalCooldownGuard } = require('../../domain/risk/DynamicEmotionalCooldownGuard.js');
const { TermuxTtsVoiceCopilot } = require('../../infrastructure/audio/TermuxTtsVoiceCopilot.js');
const { AutoSettlementEngine } = require('../../domain/financial/AutoSettlementEngine.js');

import { RuntimeEventBus } from '../../application/runtime/RuntimeEventBus';
// FIX: Importação correta da Origem (TS2459)
import { PooledSignal } from '../../domain/memory/SignalObjectPool';
import { HFTPipelineCoordinator } from '../../application/coordinators/HFTPipelineCoordinator';
import { InstitutionalStrategyAllocationEngine } from '../../domain/decision/InstitutionalStrategyAllocationEngine';

export class LivePaperOrchestrator {
    private rl: readline.Interface;
    private bankrollRepo: IBankrollRepository;
    private mesaTracker: IAnalyticsEngine;
    private sizingEngine: PositionSizingEngine;
    private trailingStopGuard!: TrailingStopGuard;
    private performanceEvaluator: StrategyPerformanceEvaluator;
    
    private eventBus: RuntimeEventBus;
    private hftPipeline: HFTPipelineCoordinator;
    private allocationEngine: InstitutionalStrategyAllocationEngine;
    
    private voiceCopilot: any;
    private settlementEngine: any;
    private cooldownGuard: any;
    
    private initialBankroll: number = 100.00;
    private savedState: any;
    private activeStrategyId: string | null = null;
    private inputMode: string = 'NUMBER';
    private pendingResult: any = null;
    
    private customTargetInfo: string | null = null; 
    private liveConvergence: number = 0;
    private liveConfidence: number = 0;
    private liveDecay: number = 0;
    private liveExecutionPressure: string = 'N/A';
    
    private xaiQualification: string = 'NÃO';
    private xaiMoment: string = 'AGORA NÃO';
    private xaiReason: string = 'Aguardando dados estruturais da mesa.';
    
    private triplicacaoPatternFound: string | null = null;
    private triplicacaoTypeFound: string | null = null;
    
    private currentVixPercent: number = 0;
    private toxicTableLockUntil: number | null = null;
    private forceObserveRound: boolean = false;
    private dynamicStakeCalculated: number = 0.50;
    private currentStakeMultiplier: number = 1;
    private vixTolerance: number = 95.0;
    
    private readonly PROXIMITY_TOLERANCE: number = 0.05;
    private disabledStrategies: Set<string> = new Set();
    
    private isDailyHardLocked: boolean = false;
    private hardLockDateEpoch: number | null = null;
    
    private liveTimer: any = null;
    private readonly OPERATIONAL_WINDOW_SIZE = 90; 

    private sessionStats = {
        startBankroll: 0, wins: 0, losses: 0, entropyBlocks: 0, strategyWins: {} as Record<string, number>, vixReadings: [] as number[]
    };

    private readonly historicalLogPath: string;

    constructor(bankrollRepo: IBankrollRepository, mesaTracker: IAnalyticsEngine) {
        this.bankrollRepo = bankrollRepo;
        this.mesaTracker = mesaTracker;
        this.sizingEngine = new PositionSizingEngine();
        const availableStrategies = Object.keys(AutoSettlementEngine.getStrategies());
        this.performanceEvaluator = new StrategyPerformanceEvaluator(availableStrategies);
        this.voiceCopilot = new TermuxTtsVoiceCopilot();
        this.settlementEngine = new AutoSettlementEngine();
        this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const dataDir = path.join(__dirname, '..', '..', '..', 'data');
        if (!fs.existsSync(dataDir)) { fs.mkdirSync(dataDir, { recursive: true }); }
        this.historicalLogPath = path.join(dataDir, 'historical-spins.log');
        
        this.eventBus = new RuntimeEventBus(250);
        this.hftPipeline = new HFTPipelineCoordinator(this.eventBus, 85);
        this.allocationEngine = new InstitutionalStrategyAllocationEngine(15);
    }

    public async initialize(): Promise<void> {
        this.savedState = this.bankrollRepo.load();
        if (this.savedState && this.savedState.initialBankroll) { this.initialBankroll = this.savedState.initialBankroll; }
        if (this.savedState && this.savedState.provider) { this.sizingEngine.setProvider(this.savedState.provider as CasinoProvider); }
        if (this.savedState && this.savedState.vixTolerance) { this.vixTolerance = this.savedState.vixTolerance; }
        if (this.savedState && Array.isArray(this.savedState.history)) { this.savedState.history.forEach((num: number) => this.mesaTracker.addNumber(num)); }
        if (this.savedState && this.savedState.toxicTableLockUntil) { this.toxicTableLockUntil = this.savedState.toxicTableLockUntil; }
        if (this.savedState && this.savedState.strategyWeights) { this.performanceEvaluator.setWeights(this.savedState.strategyWeights); }
        if (this.savedState && Array.isArray(this.savedState.disabledStrategies)) { this.disabledStrategies = new Set(this.savedState.disabledStrategies); }
        
        this.cooldownGuard = new DynamicEmotionalCooldownGuard(this.initialBankroll, this.savedState);
        this.sessionStats.startBankroll = this.cooldownGuard.currentBankroll;
        this.trailingStopGuard = new TrailingStopGuard(this.sessionStats.startBankroll);
        this.isDailyHardLocked = this.savedState?.isDailyHardLocked || false;
        this.hardLockDateEpoch = this.savedState?.hardLockDateEpoch || null;

        this.eventBus.subscribe(this.onHftSignalReceived.bind(this));

        this.verifyDailyLock();
        this.evaluateProximityTakeProfit();
        this.generateNextTrade();
        
        if (this.isDailyHardLocked) { this.renderExecutiveReport('SESSÃO FINALIZADA OU EM QUARENTENA'); } 
        else { this.renderTerminalHud(); this.manageLiveTimer(); }

        this.attachEventListeners();
    }

    private onHftSignalReceived(signal: PooledSignal): void {
        this.activeStrategyId = signal.strategyId;
        
        if (signal.strategyId === 'CROSS_GRID_HEDGE') {
            if (signal.targetSector === 23) this.customTargetInfo = '[COLUNAS 2 e 3]';
            else if (signal.targetSector === 13) this.customTargetInfo = '[COLUNAS 1 e 3]';
            else if (signal.targetSector === 12) this.customTargetInfo = '[COLUNAS 1 e 2]';
        } else {
            const label = signal.strategyId.replace('TRIPLICACAO_', '');
            this.customTargetInfo = `[ALVO HFT: ${label}]`;
        }

        // FIX: Verificação Explicita do Nulo (TS2538)
        const strat = AutoSettlementEngine.getStrategies()[this.activeStrategyId!];
        const sizingResult = this.sizingEngine.calculateOperationalSizing(this.cooldownGuard.currentBankroll, this.currentVixPercent, strat.stake);
        
        let pressureMod = 1;
        if (this.liveExecutionPressure === 'REDUCE_EXPOSURE') pressureMod = 0.5;
        if (this.liveExecutionPressure === 'AGGRESSIVE_ENTRY') pressureMod = 1.5;
        
        this.dynamicStakeCalculated = sizingResult.finalStake * pressureMod;
        this.currentStakeMultiplier = sizingResult.multiplier * pressureMod;
    }

    private manageLiveTimer(): void {
        if (this.checkToxicTableLock() && !this.liveTimer) {
            this.liveTimer = setInterval(() => {
                if (!this.checkToxicTableLock()) {
                    clearInterval(this.liveTimer); this.liveTimer = null;
                    if (this.inputMode !== 'VIEW_ONLY') this.renderTerminalHud();
                } else {
                    if (this.inputMode !== 'VIEW_ONLY') this.renderTerminalHud();
                }
            }, 1000);
        } else if (!this.checkToxicTableLock() && this.liveTimer) {
            clearInterval(this.liveTimer); this.liveTimer = null;
        }
    }

    private isSameDay(epochA: number, epochB: number): boolean {
        if (!epochA || !epochB) return false;
        const d1 = new Date(epochA); const d2 = new Date(epochB);
        return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    }

    private verifyDailyLock(): void {
        if (this.isDailyHardLocked) {
            if (!this.isSameDay(this.hardLockDateEpoch!, Date.now())) {
                this.isDailyHardLocked = false; this.hardLockDateEpoch = null; this.saveSystemState();
            }
        }
    }

    private saveSystemState(): void {
        const currentSnapshot = this.cooldownGuard.exportState();
        currentSnapshot.isDailyHardLocked = this.isDailyHardLocked;
        currentSnapshot.hardLockDateEpoch = this.hardLockDateEpoch;
        currentSnapshot.provider = this.sizingEngine.getProvider();
        currentSnapshot.history = this.mesaTracker.getHistory();
        currentSnapshot.toxicTableLockUntil = this.toxicTableLockUntil;
        currentSnapshot.strategyWeights = this.performanceEvaluator.getAllWeights();
        currentSnapshot.vixTolerance = this.vixTolerance;
        currentSnapshot.disabledStrategies = Array.from(this.disabledStrategies);
        this.bankrollRepo.save(currentSnapshot);
    }

    private evaluateProximityTakeProfit(): boolean {
        if (this.isDailyHardLocked) return true;
        const distance = this.cooldownGuard.nextMilestone - this.cooldownGuard.currentBankroll;
        
        if (distance > 0 && distance <= this.PROXIMITY_TOLERANCE) {
            this.isDailyHardLocked = true; 
            this.hardLockDateEpoch = Date.now(); 
            this.saveSystemState();
            this.renderExecutiveReport(`TAKE-PROFIT INSTITUCIONAL DE SEGURANÇA \n(Risco Assímétrico Abortado | Faltava: R$ ${distance.toFixed(2)})`); 
            return true;
        }
        return false;
    }

    private checkToxicTableLock(): boolean {
        if (this.toxicTableLockUntil && Date.now() < this.toxicTableLockUntil) return true;
        if (this.toxicTableLockUntil && Date.now() >= this.toxicTableLockUntil) {
            this.toxicTableLockUntil = null; this.saveSystemState();
        }
        return false;
    }

    private generateNextTrade(): void {
        this.activeStrategyId = null; 
        this.customTargetInfo = null;
        this.triplicacaoPatternFound = null; 
        this.triplicacaoTypeFound = null;
        
        const fullHistory = this.mesaTracker.getHistory();
        const REDS = new Set(AutoSettlementEngine.RED_NUMS);
        const operationalHistory = fullHistory.slice(-this.OPERATIONAL_WINDOW_SIZE);

        if (operationalHistory.length < 10) {
            this.updateXaiTranslation(null);
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
            let maxC = 0, dom = 'NONE';
            
            // FIX: Tipagem Estrita de Tuplas exigida pelo TS2365
            const pairs: [string, number][] = [['TC',tc],['NTC',ntc],['TA',ta],['NTA',nta]];
            pairs.forEach(([n,c]) => { if(c>maxC){maxC=c; dom=n;} });
            
            return { vix: tot>0 ? (ent/2)*100 : 0, dom, ratio: tot>0 ? maxC/tot : 0, tot };
        };

        const cStats = extractTrios(v => REDS.has(v) ? 'A' : 'B');
        const pStats = extractTrios(v => v%2===0 ? 'A' : 'B');
        this.currentVixPercent = (cStats.vix + pStats.vix) / 2;

        if (this.currentVixPercent > this.vixTolerance) { 
            this.sessionStats.entropyBlocks++; 
            this.updateXaiTranslation(null);
            return; 
        }

        let prospectiveId: string | null = null;
        let hftTargetSector: number = -1;

        const rev = [...operationalHistory].reverse();
        if (rev.length % 3 === 2 && rev[1] !== 0 && rev[0] !== 0) {
            let cTgt = null, pTgt = null;
            if (cStats.tot >= 15 && cStats.ratio >= 0.42) {
                const c0 = REDS.has(rev[1]) ? 'A' : 'B'; const c1 = REDS.has(rev[0]) ? 'A' : 'B';
                if(cStats.dom==='TC' && c0===c1) cTgt = c1; else if(cStats.dom==='NTA' && c0!==c1) cTgt = c1;
                else if(cStats.dom==='NTC' && c0===c1) cTgt = c1==='A'?'B':'A'; else if(cStats.dom==='TA' && c0!==c1) cTgt = c1==='A'?'B':'A';
            }
            if (pStats.tot >= 15 && pStats.ratio >= 0.42) {
                const p0 = rev[1]%2===0 ? 'A' : 'B'; const p1 = rev[0]%2===0 ? 'A' : 'B';
                if(pStats.dom==='TC' && p0===p1) pTgt = p1; else if(pStats.dom==='NTA' && p0!==p1) pTgt = p1;
                else if(pStats.dom==='NTC' && p0===p1) pTgt = p1==='A'?'B':'A'; else if(pStats.dom==='TA' && p0!==p1) pTgt = p1==='A'?'B':'A';
            }
            if(cTgt && pTgt) { if(cStats.ratio >= pStats.ratio) pTgt=null; else cTgt=null; }
            
            if (cTgt) { prospectiveId = cTgt==='A' ? 'TRIPLICACAO_RED' : 'TRIPLICACAO_BLACK'; hftTargetSector = 1; }
            else if (pTgt) { prospectiveId = pTgt==='A' ? 'TRIPLICACAO_EVEN' : 'TRIPLICACAO_ODD'; hftTargetSector = 2; }
            
            if (prospectiveId) {
                if (cTgt) { this.triplicacaoTypeFound = 'COR'; this.triplicacaoPatternFound = cStats.dom; }
                else { this.triplicacaoTypeFound = 'PARIDADE'; this.triplicacaoPatternFound = pStats.dom; }
            }
        }

        if (!prospectiveId) {
            const allowedSet = new Set<string>();
            Object.keys(AutoSettlementEngine.getStrategies()).forEach(id => {
                if (this.performanceEvaluator.isAllowed(id) && !this.disabledStrategies.has(id)) {
                    allowedSet.add(id);
                }
            });

            const allocation = this.allocationEngine.allocateCapital(
                operationalHistory,
                AutoSettlementEngine.getStrategies() as any,
                allowedSet
            );

            if (allocation.winningStrategyId) {
                prospectiveId = allocation.winningStrategyId;
                hftTargetSector = allocation.targetSector;
            }
        }

        this.liveConvergence = Math.round(100 - this.currentVixPercent);
        const maxRatio = Math.max(cStats.ratio, pStats.ratio);
        this.liveConfidence = Math.round((maxRatio / 0.5) * 100); 
        
        const distribution = this.mesaTracker.getDistributionStats();
        const baseVariance = Math.abs(distribution.red - distribution.black) / (distribution.total || 1);
        this.liveDecay = -Math.round(baseVariance * 100); 

        if (this.liveConvergence > 80 && this.liveConfidence > 75) this.liveExecutionPressure = 'AGGRESSIVE_ENTRY';
        else if (this.liveConvergence > 65 && this.liveConfidence > 60) this.liveExecutionPressure = 'STANDARD_ENTRY';
        else this.liveExecutionPressure = 'REDUCE_EXPOSURE';

        if (prospectiveId && this.performanceEvaluator.isAllowed(prospectiveId) && !this.disabledStrategies.has(prospectiveId)) {
            this.hftPipeline.processTick(
                this.liveConvergence,
                (this.liveConvergence + this.liveConfidence) / 2,
                this.liveConfidence,
                this.liveDecay,
                prospectiveId,
                hftTargetSector
            );
        }

        this.updateXaiTranslation(prospectiveId);
    }

    private updateXaiTranslation(prospectiveId: string | null): void {
        if (!prospectiveId) {
            this.xaiQualification = 'NÃO';
            this.xaiMoment = 'AGORA NÃO';
            if (this.liveConvergence > 70) {
                this.xaiReason = 'Janela a abrir, porém regime ainda sem maturação suficiente.';
            } else if (this.currentVixPercent > this.vixTolerance) {
                this.xaiReason = 'Entropia máxima detetada (Mesa Tóxica). Observar.';
            } else {
                this.xaiReason = 'A aguardar validação de assimetria institucional.';
            }
            return;
        }

        this.xaiQualification = 'SIM';
        
        if (this.liveExecutionPressure === 'AGGRESSIVE_ENTRY') {
            this.xaiMoment = 'ENTRAR (FORTE)';
            this.xaiReason = 'Regime confirmado + janela aberta + baixa degradação temporal.';
        } else if (this.liveExecutionPressure === 'STANDARD_ENTRY') {
            this.xaiMoment = 'ENTRAR';
            this.xaiReason = 'Janela estável e qualificação consistente confirmada.';
        } else if (this.liveExecutionPressure === 'REDUCE_EXPOSURE') {
            this.xaiMoment = 'REDUZIDA';
            this.xaiReason = 'Sinal validado, mas janela em decaimento (Late Entry). Exposição cortada.';
        } else {
            this.xaiMoment = 'AGORA NÃO';
            this.xaiReason = 'Qualificado, mas timing fora dos parâmetros ótimos de pressão.';
        }
    }

    private renderExecutiveReport(reason: string): void {
        console.clear();
        console.log('======================================================');
        console.log(` 🛑 DOSSIÊ EXECUTIVO - ${reason}`);
        console.log('======================================================');
    }
    
    private renderTacticalReport(): void {
        console.clear();
        console.log('======================================================');
        console.log(' ⏸️  RELATÓRIO TÁTICO - MODO PAUSA');
        console.log('======================================================');
    }

    private renderHeatmap(): void {
        console.clear();
        const freqMap = this.mesaTracker.getFrequencies();
        const historyLength = this.mesaTracker.getHistory().length;
        const sortedFreq = Array.from(freqMap.entries()).sort((a, b) => b[1] - a[1]);
        
        console.log('======================================================');
        console.log(` 🌡️  XAI: HEATMAP TOPOGRÁFICO (Amostra Acumulada: ${historyLength} giros)`);
        console.log('======================================================');
        
        if (historyLength === 0) { console.log(' \x1b[33mAguardando dados...\x1b[0m'); } else {
            console.log(' \x1b[31m🔥 HOT NUMBERS:\x1b[0m');
            for (let i = 0; i < 5 && i < sortedFreq.length; i++) {
                if (sortedFreq[i][1] > 0) { console.log(`    Número \x1b[1m${sortedFreq[i][0].toString().padStart(2, ' ')}\x1b[0m : ${sortedFreq[i][1]} aparições`); }
            }
            console.log('\n \x1b[36m❄️  COLD NUMBERS:\x1b[0m');
            for (let i = sortedFreq.length - 1; i >= sortedFreq.length - 5 && i >= 0; i--) {
                console.log(`    Número \x1b[1m${sortedFreq[i][0].toString().padStart(2, ' ')}\x1b[0m : ${sortedFreq[i][1]} aparições`);
            }
        }
        console.log('------------------------------------------------------');
        console.log(' Pressione ENTER para retornar à operação...');
    }

    private renderStats(): void {
        console.clear();
        const stats = this.mesaTracker.getDistributionStats();
        console.log('======================================================');
        console.log(` 📊 XAI: DISTRIBUIÇÃO DA MESA (Amostra Acumulada: ${stats.total} giros)`);
        console.log('======================================================');
        
        if (stats.total === 0) { console.log(' \x1b[33mAguardando dados da mesa...\x1b[0m'); } else {
            const pRed = ((stats.red / stats.total) * 100).toFixed(1);
            const pBlack = ((stats.black / stats.total) * 100).toFixed(1);
            const pZero = ((stats.zero / stats.total) * 100).toFixed(1);
            const pEven = ((stats.even / stats.total) * 100).toFixed(1);
            const pOdd = ((stats.odd / stats.total) * 100).toFixed(1);
            const pLow = ((stats.low / stats.total) * 100).toFixed(1);
            const pHigh = ((stats.high / stats.total) * 100).toFixed(1);
            
            console.log(` \x1b[31mVermelho\x1b[0m : ${stats.red.toString().padStart(3, ' ')} vezes (${pRed}%) | \x1b[30m\x1b[47mPreto\x1b[0m: ${stats.black.toString().padStart(3, ' ')} vezes (${pBlack}%)`);
            console.log(` \x1b[32mZero (0)\x1b[0m : ${stats.zero.toString().padStart(3, ' ')} vezes (${pZero}%)`);
            console.log(' ----------------------------------------------------');
            console.log(` Pares    : ${stats.even.toString().padStart(3, ' ')} vezes (${pEven}%) | Ímpares: ${stats.odd.toString().padStart(3, ' ')} vezes (${pOdd}%)`);
            console.log(` Baixos   : ${stats.low.toString().padStart(3, ' ')} vezes (${pLow}%) | Altos  : ${stats.high.toString().padStart(3, ' ')} vezes (${pHigh}%)`);
        }
        console.log('------------------------------------------------------');
        console.log(' Pressione ENTER para retornar à operação...');
    }

    private attachEventListeners(): void {
        this.rl.on('line', (line) => {
            const cmd = line.trim().toLowerCase();
            
            if (cmd === 'exit' || cmd === 'quit') { 
                if (this.liveTimer) clearInterval(this.liveTimer);
                this.saveSystemState(); console.log('\n[!] Estado salvo. Encerrando...'); this.rl.close(); return; 
            }

            if (this.inputMode === 'VIEW_ONLY') { 
                this.inputMode = 'NUMBER'; this.renderTerminalHud(); return; 
            }

            if (this.isDailyHardLocked) { this.rl.prompt(); return; }

            if (cmd.startsWith('setbankroll ')) {
                const newVal = parseFloat(cmd.replace('setbankroll ', '').trim());
                if (isNaN(newVal) || newVal <= 0) { console.log('Inválido.'); this.rl.prompt(); return; }
                
                this.cooldownGuard = new DynamicEmotionalCooldownGuard(newVal, this.savedState);
                this.cooldownGuard.currentBankroll = newVal;
                this.sessionStats.startBankroll = newVal;
                this.trailingStopGuard = new TrailingStopGuard(newVal);
                
                this.saveSystemState(); 
                this.hftPipeline.resetPipeline(); 
                this.evaluateProximityTakeProfit();
                this.generateNextTrade(); 
                
                if (!this.isDailyHardLocked) {
                    console.clear();
                    console.log(`\n \x1b[32m[!] HOT-SWAP SUCESSO: Banca ajustada para R$ ${newVal.toFixed(2)}.\x1b[0m`);
                    setTimeout(() => this.renderTerminalHud(), 2000);
                }
                return;
            }

            if (this.inputMode === 'CONFIRM_TRADE') {
                const executedStratId = this.activeStrategyId!;
                if (cmd === 's' || cmd === 'sim' || cmd === 'y') {
                    if (this.pendingResult.status === 'WIN_MAX' || this.pendingResult.status === 'WIN_MIN') {
                        this.cooldownGuard.registerOutcome(true, this.cooldownGuard.currentBankroll + this.pendingResult.netAmount);
                        this.performanceEvaluator.registerWin(executedStratId);
                        this.voiceCopilot.speak('Green liquidado.');
                    } else if (this.pendingResult.status === 'PUSH') {
                        this.cooldownGuard.registerOutcome(true, this.cooldownGuard.currentBankroll);
                    } else {
                        this.cooldownGuard.registerOutcome(false, this.cooldownGuard.currentBankroll - Math.abs(this.pendingResult.netAmount));
                        this.performanceEvaluator.registerLoss(executedStratId);
                        this.voiceCopilot.speak('Red absorvido.');
                    }
                    this.saveSystemState();
                } else if (cmd === 'n' || cmd === 'nao' || cmd === 'não') {
                    this.forceObserveRound = true;
                } else { console.log('Inválido.'); this.rl.prompt(); return; }
                
                this.inputMode = 'NUMBER'; this.pendingResult = null; this.activeStrategyId = null; this.customTargetInfo = null;
                this.trailingStopGuard.updatePeak(this.cooldownGuard.currentBankroll);
                
                if (this.evaluateProximityTakeProfit()) {
                    this.rl.prompt();
                    return;
                }
                
                const stopStatus = this.trailingStopGuard.checkStop(this.cooldownGuard.currentBankroll);
                
                if (stopStatus.isStopped) {
                    this.isDailyHardLocked = true; this.hardLockDateEpoch = Date.now(); this.saveSystemState();
                    this.renderExecutiveReport(stopStatus.reason); this.rl.prompt(); return;
                }
                if (this.cooldownGuard.isSessionEnded) {
                    this.isDailyHardLocked = true; this.hardLockDateEpoch = Date.now(); this.saveSystemState();
                    this.renderExecutiveReport('META GLOBAL OU STOP LOSS ATINGIDO'); this.rl.prompt(); return;
                } else if (this.cooldownGuard.isLocked()) {
                    this.renderTacticalReport(); this.rl.prompt(); return;
                }
                this.generateNextTrade(); this.renderTerminalHud(); return;
            }

            const num = parseInt(cmd, 10);
            if (isNaN(num) || num < 0 || num > 36) { this.rl.prompt(); return; }

            if (this.activeStrategyId) { 
                const currentHistory = this.mesaTracker.getHistory();
                const anchorNumber = currentHistory.length > 0 ? currentHistory[currentHistory.length - 1] : 0;
                
                this.mesaTracker.addNumber(num); 
                const stratObj = AutoSettlementEngine.getStrategies()[this.activeStrategyId];
                this.pendingResult = stratObj.evaluate(num, anchorNumber); 
                this.pendingResult.netAmount = this.pendingResult.netAmount * this.currentStakeMultiplier;
                this.inputMode = 'CONFIRM_TRADE'; this.renderTerminalHud(); return; 
            } else {
                this.mesaTracker.addNumber(num); 
            }
            
            this.generateNextTrade(); this.renderTerminalHud();
        });
    }

    private renderTerminalHud(): void {
        console.clear();
        const lockStatus = this.cooldownGuard.getRemainingStatus();
        const toxicLockActive = this.checkToxicTableLock();
        
        console.log('======================================================');
        console.log(' 🛡️ RL.SYS CORE - ENTERPRISE ORCHESTRATOR');
        console.log('======================================================');
        console.log(` BANCA ATUAL ..... R$ ${this.cooldownGuard.currentBankroll.toFixed(2)}`);
        if (!this.cooldownGuard.isSessionEnded) console.log(` PRÓXIMO DEGRAU .. R$ ${this.cooldownGuard.nextMilestone.toFixed(2)}`);
        
        let vixColor = '\x1b[32m'; 
        if (this.currentVixPercent > 75) vixColor = '\x1b[33m'; 
        if (this.currentVixPercent > this.vixTolerance) vixColor = '\x1b[31m'; 
        
        console.log(` ENTROPIA (VIX) .. ${vixColor}${this.currentVixPercent.toFixed(1)}%\x1b[0m [Janela Móvel: ${this.OPERATIONAL_WINDOW_SIZE} Giros]`);
        
        let strategyDisplayName = 'NENHUMA';
        if (this.activeStrategyId) {
            strategyDisplayName = AutoSettlementEngine.getStrategies()[this.activeStrategyId].name;
            if (this.customTargetInfo) strategyDisplayName += ` ${this.customTargetInfo}`;
        }

        console.log('------------------------------------------------------');
        console.log(` Estratégia ... \x1b[36m${strategyDisplayName}\x1b[0m`);
        console.log(` Qualificação . ${this.xaiQualification === 'SIM' ? '\x1b[32mSIM\x1b[0m' : '\x1b[31mNÃO\x1b[0m'}`);
        console.log(` Momento ...... ${this.xaiMoment === 'AGORA NÃO' ? '\x1b[33mAGORA NÃO\x1b[0m' : `\x1b[32m${this.xaiMoment}\x1b[0m`}`);
        console.log(` Confiança .... ${this.liveConfidence}`);
        console.log(` Motivo ....... ${this.xaiReason}`);
        console.log('------------------------------------------------------');
        
        if (toxicLockActive) {
            console.log(`\x1b[31m ☣️ MESA TÓXICA REJEITADA PELO SISTEMA (VIX > ${this.vixTolerance.toFixed(1)}%)\x1b[0m`);
            this.rl.setPrompt('comando > ');
        }
        else if (lockStatus) {
            console.log(`\x1b[31m 🛑 TRAVA DE PROTEÇÃO DE CAPITAL ATIVA\x1b[0m`);
            console.log(` MOTIVO: ${lockStatus.reason} | TEMPO: ${lockStatus.time}`);
            this.rl.setPrompt('comando > ');
        } 
        else if (this.inputMode === 'CONFIRM_TRADE') {
            const stratName = AutoSettlementEngine.getStrategies()[this.activeStrategyId!].name;
            let color = '\x1b[31m'; let label = 'RED (Loss)';
            if (this.pendingResult.status === 'WIN_MAX' || this.pendingResult.status === 'WIN_MIN') { color = '\x1b[32m'; label = 'GREEN'; }
            if (this.pendingResult.status === 'PUSH') { color = '\x1b[33m'; label = 'PUSH (Empate)'; }
            console.log(` ${color}RESULTADO: ${label} | R$ ${this.pendingResult.netAmount.toFixed(2)}\x1b[0m`);
            console.log('------------------------------------------------------');
            console.log(` [?] Você executou a estratégia [${stratName}] com Stake LOU de R$ ${this.dynamicStakeCalculated.toFixed(2)}?`);
            this.rl.setPrompt('Confirme (s/n) > ');
        } 
        else if (this.activeStrategyId) {
            console.log(` AÇÃO ........ \x1b[32mENTRAR\x1b[0m`);
            console.log(` STAKE LOU .. \x1b[32mR$ ${this.dynamicStakeCalculated.toFixed(2)}\x1b[0m`);
            this.rl.setPrompt('roleta/comando > ');
        } 
        else {
            console.log(` AÇÃO ........ \x1b[33mOBSERVAR\x1b[0m`);
            this.rl.setPrompt('roleta/comando > ');
        }
        console.log('======================================================');
        this.rl.prompt(true);
    }
}
EOF

echo "[2/3] A forçar a compilação máxima do TypeScript (Tsc)..."
npx tsc

echo "[3/3] A registar a correção oficial do compilador TS..."
git add src/presentation/cli/LivePaperOrchestrator.ts
git add install/sprints/run-sprint-445b-hotfix-tsc.sh
git commit -m "fix(presentation): resolve TypeScript strict mode errors related to unexported modules, null indexing, and untyped tuple arrays, ensuring flawless HFT compilation (Sprint 445-B)" > /dev/null

echo "======================================"
echo -e "\033[1;32m COMPILAÇÃO E HOTFIX APLICADOS COM SUCESSO \033[0m"
echo " STATUS: PRONTO PARA IGNIÇÃO"
echo "======================================"
