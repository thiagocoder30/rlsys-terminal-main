#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 443"
echo " LIVE HEURISTICS & TELEMETRY HUD"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/2] Arrancando Mocks e injetando Telemetria Institucional no HUD..."
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

import { RuntimeEventBus, PooledSignal } from '../../application/runtime/RuntimeEventBus';
import { HFTPipelineCoordinator } from '../../application/coordinators/HFTPipelineCoordinator';

export class LivePaperOrchestrator {
    private rl: readline.Interface;
    private bankrollRepo: IBankrollRepository;
    private mesaTracker: IAnalyticsEngine;
    private sizingEngine: PositionSizingEngine;
    private trailingStopGuard!: TrailingStopGuard;
    private performanceEvaluator: StrategyPerformanceEvaluator;
    
    private eventBus: RuntimeEventBus;
    private hftPipeline: HFTPipelineCoordinator;
    
    private voiceCopilot: any;
    private settlementEngine: any;
    private cooldownGuard: any;
    
    private initialBankroll: number = 100.00;
    private savedState: any;
    private activeStrategyId: string | null = null;
    private inputMode: string = 'NUMBER';
    private pendingResult: any = null;
    
    // FIX SPRINT 443: Variáveis reais de Telemetria HFT para o HUD
    private customTargetInfo: string | null = null; 
    private liveConvergence: number = 0;
    private liveConfidence: number = 0;
    private liveDecay: number = 0;
    private liveExecutionPressure: string = 'N/A';
    
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

        const strat = AutoSettlementEngine.getStrategies()[this.activeStrategyId];
        const sizingResult = this.sizingEngine.calculateOperationalSizing(this.cooldownGuard.currentBankroll, this.currentVixPercent, strat.stake);
        
        // Aplica modificador de Lote baseado na Pressão de Execução (Sprint 434 Integration)
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
        
        const fullHistory = this.mesaTracker.getHistory();
        const REDS = new Set(AutoSettlementEngine.RED_NUMS);
        const operationalHistory = fullHistory.slice(-this.OPERATIONAL_WINDOW_SIZE);

        if (operationalHistory.length < 10) return;

        // Cálculos VIX
        let colorVix = 0, parityVix = 0;
        let cRatio = 0, pRatio = 0;
        let cDominant = 'NONE', pDominant = 'NONE';
        
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
            [['TC',tc],['NTC',ntc],['TA',ta],['NTA',nta]].forEach(([n,c]) => { if(c>maxC){maxC=c as number; dom=n as string;} });
            return { vix: tot>0 ? (ent/2)*100 : 0, dom, ratio: tot>0 ? maxC/tot : 0, tot };
        };

        const cStats = extractTrios(v => REDS.has(v) ? 'A' : 'B');
        const pStats = extractTrios(v => v%2===0 ? 'A' : 'B');
        this.currentVixPercent = (cStats.vix + pStats.vix) / 2;

        if (this.currentVixPercent > this.vixTolerance) { this.sessionStats.entropyBlocks++; return; }

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
        }

        if (!prospectiveId) {
            const tl = operationalHistory.slice(-15); 
            let scores: Record<string, number> = { 'HEDGE_BLACK_COL3': 0, 'HEDGE_RED_COL2': 0, 'SECTOR_OMEGA': 0, 'SECTOR_ALPHA': 0, 'FUSION_SECTOR': 0, 'CROSS_GRID_HEDGE': 0 };
            const strats = AutoSettlementEngine.getStrategies();
            tl.forEach(n => { Object.keys(scores).forEach(id => { if(strats[id] && strats[id].evaluate(n, tl[tl.indexOf(n)-1]||0).status.includes('WIN')) scores[id]++; }); });
            let best = null, max = 0;
            Object.entries(scores).forEach(([id, s]) => { if(s>max && this.performanceEvaluator.isAllowed(id) && !this.disabledStrategies.has(id)){ max=s; best=id; } });
            if (best && max >= (tl.length * 0.40)) { 
                prospectiveId = best; 
                if (best === 'CROSS_GRID_HEDGE') {
                    const l = rev[0];
                    if(l>=1 && l<=12) hftTargetSector=23; else if(l>=13 && l<=24) hftTargetSector=13; else if(l>=25 && l<=36) hftTargetSector=12;
                }
            }
        }

        // =========================================================
        // FIX SPRINT 443: CÁLCULO REAL E REMOÇÃO DOS MOCKS ESTATICOS
        // Lendo as métricas fundamentais baseadas no histórico da mesa
        // =========================================================
        
        // A Convergência é o reflexo da ordem da mesa (100 - Entropia)
        this.liveConvergence = Math.round(100 - this.currentVixPercent);
        
        // A Confiança baseia-se na força do padrão dominante atual 
        const maxRatio = Math.max(cStats.ratio, pStats.ratio);
        this.liveConfidence = Math.round((maxRatio / 0.5) * 100); // Normalizado
        
        // Cálculo matemático básico de Decay (simulando a distância da consistência média)
        const distribution = this.mesaTracker.getDistributionStats();
        const baseVariance = Math.abs(distribution.red - distribution.black) / (distribution.total || 1);
        this.liveDecay = -Math.round(baseVariance * 100); 

        // O Timing Engine (433) + Pressure Engine (434) traduzidos para o HUD
        if (this.liveConvergence > 80 && this.liveConfidence > 75) this.liveExecutionPressure = 'AGGRESSIVE_ENTRY';
        else if (this.liveConvergence > 65 && this.liveConfidence > 60) this.liveExecutionPressure = 'STANDARD_ENTRY';
        else this.liveExecutionPressure = 'REDUCE_EXPOSURE'; // Early ou Late timing com baixo momentum

        if (prospectiveId && this.performanceEvaluator.isAllowed(prospectiveId) && !this.disabledStrategies.has(prospectiveId)) {
            // Enviando DADOS REAIS para o pipeline
            this.hftPipeline.processTick(
                this.liveConvergence,
                (this.liveConvergence + this.liveConfidence) / 2, // Decision Score Real
                this.liveConfidence,
                this.liveDecay,
                prospectiveId,
                hftTargetSector
            );
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
        
        // FIX SPRINT 443: HUD TELEMETRIA HFT
        console.log('------------------------------------------------------');
        console.log(` 🧠 METADADOS HFT (TIMING & PRESSURE ENGINE)`);
        console.log(` CONVERGÊNCIA .... ${this.liveConvergence}%`);
        console.log(` CONFIANÇA ....... ${this.liveConfidence}%`);
        console.log(` DECAY (EMA) ..... ${this.liveDecay}`);
        console.log(` EXEC PRESSURE ... \x1b[36m[${this.liveExecutionPressure}]\x1b[0m`);
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
            const strat = AutoSettlementEngine.getStrategies()[this.activeStrategyId];
            console.log(` ESTRATÉGIA .. \x1b[36m${strat.name}\x1b[0m`);
            if (this.customTargetInfo) console.log(` ALVO ........ \x1b[33m${this.customTargetInfo}\x1b[0m`);
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

echo "[2/2] Registrando injeção de telemetria real na governaça..."
git add src/presentation/cli/LivePaperOrchestrator.ts
git add install/sprints/run-sprint-443-live-heuristics-hud.sh
git commit -m "feat(presentation): remove simulated Mocks and extract real domain telemetry metrics (Convergence, Confidence, Decay, Pressure) from mesaTracker to feed the HFTPipelineCoordinator, displaying them directly on the CLI HUD (Sprint 443)" > /dev/null

echo "======================================"
echo -e "\033[1;32m SPRINT 443 APLICADA COM SUCESSO \033[0m"
echo " STATUS: HUD DE TELEMETRIA REAL ATIVADO"
echo "======================================"
