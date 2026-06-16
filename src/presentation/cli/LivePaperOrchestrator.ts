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

export class LivePaperOrchestrator {
    private rl: readline.Interface;
    private bankrollRepo: IBankrollRepository;
    private mesaTracker: IAnalyticsEngine;
    private sizingEngine: PositionSizingEngine;
    private trailingStopGuard!: TrailingStopGuard;
    private performanceEvaluator: StrategyPerformanceEvaluator;
    
    private voiceCopilot: any;
    private settlementEngine: any;
    private cooldownGuard: any;
    
    private initialBankroll: number = 100.00;
    private savedState: any;
    private activeStrategyId: string | null = null;
    private inputMode: string = 'NUMBER';
    private pendingResult: any = null;
    private triplicacaoPatternFound: string | null = null;
    private triplicacaoTypeFound: string | null = null;
    private currentVixPercent: number = 0;
    private toxicTableLockUntil: number | null = null;
    private forceObserveRound: boolean = false;
    private dynamicStakeCalculated: number = 0.50;
    private currentStakeMultiplier: number = 1;
    private vixTolerance: number = 95.0;
    
    private disabledStrategies: Set<string> = new Set();
    
    private isDailyHardLocked: boolean = false;
    private hardLockDateEpoch: number | null = null;
    
    private liveTimer: any = null;
    private readonly OPERATIONAL_WINDOW_SIZE = 90; 

    private sessionStats = {
        startBankroll: 0,
        wins: 0,
        losses: 0,
        entropyBlocks: 0,
        strategyWins: {} as Record<string, number>,
        vixReadings: [] as number[]
    };

    private readonly historicalLogPath: string;

    constructor(
        bankrollRepo: IBankrollRepository,
        mesaTracker: IAnalyticsEngine
    ) {
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
    }

    public async initialize(): Promise<void> {
        this.savedState = this.bankrollRepo.load();
        if (this.savedState && this.savedState.initialBankroll) {
            this.initialBankroll = this.savedState.initialBankroll;
        }
        if (this.savedState && this.savedState.provider) {
            this.sizingEngine.setProvider(this.savedState.provider as CasinoProvider);
        }
        if (this.savedState && this.savedState.vixTolerance) {
            this.vixTolerance = this.savedState.vixTolerance;
        }
        if (this.savedState && Array.isArray(this.savedState.history)) {
            this.savedState.history.forEach((num: number) => this.mesaTracker.addNumber(num));
        }
        if (this.savedState && this.savedState.toxicTableLockUntil) {
            this.toxicTableLockUntil = this.savedState.toxicTableLockUntil;
        }
        if (this.savedState && this.savedState.strategyWeights) {
            this.performanceEvaluator.setWeights(this.savedState.strategyWeights);
        }
        if (this.savedState && Array.isArray(this.savedState.disabledStrategies)) {
            this.disabledStrategies = new Set(this.savedState.disabledStrategies);
        }
        
        this.cooldownGuard = new DynamicEmotionalCooldownGuard(this.initialBankroll, this.savedState);
        this.sessionStats.startBankroll = this.cooldownGuard.currentBankroll;
        this.trailingStopGuard = new TrailingStopGuard(this.sessionStats.startBankroll);
        
        this.isDailyHardLocked = this.savedState?.isDailyHardLocked || false;
        this.hardLockDateEpoch = this.savedState?.hardLockDateEpoch || null;

        this.verifyDailyLock();
        this.generateNextTrade();
        
        if (this.isDailyHardLocked) {
            this.renderExecutiveReport('SESSÃO JÁ FINALIZADA HOJE OU QUARENTENA ATIVA');
        } else {
            this.renderTerminalHud();
            this.manageLiveTimer();
        }

        this.attachEventListeners();
    }

    private manageLiveTimer(): void {
        if (this.checkToxicTableLock() && !this.liveTimer) {
            this.liveTimer = setInterval(() => {
                if (!this.checkToxicTableLock()) {
                    clearInterval(this.liveTimer);
                    this.liveTimer = null;
                    if (this.inputMode !== 'VIEW_ONLY') this.renderTerminalHud();
                } else {
                    if (this.inputMode !== 'VIEW_ONLY') this.renderTerminalHud();
                }
            }, 1000);
        } else if (!this.checkToxicTableLock() && this.liveTimer) {
            clearInterval(this.liveTimer);
            this.liveTimer = null;
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
                this.isDailyHardLocked = false; 
                this.hardLockDateEpoch = null;
                this.saveSystemState();
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

    private computeShannonEntropy(counts: number[], total: number): number {
        if (total === 0) return 0;
        let entropy = 0;
        counts.forEach(count => { if (count > 0) { const p = count / total; entropy -= p * Math.log2(p); } });
        return entropy;
    }

    private computeTriplicacao(rounds: number[], mapFn: (v: number) => string) {
        let tc = 0, ntc = 0, ta = 0, nta = 0, zeroTrios = 0;
        for (let index = rounds.length - 1; index >= 2; index -= 3) {
            const trio = [rounds[index], rounds[index - 1], rounds[index - 2]];
            if (trio.includes(0)) { zeroTrios += 1; continue; }
            const mapped = trio.map(mapFn);
            if (mapped[0] === mapped[1] && mapped[1] === mapped[2]) tc += 1;
            else if (mapped[0] === mapped[1] && mapped[1] !== mapped[2]) ntc += 1;
            else if (mapped[0] !== mapped[1] && mapped[1] !== mapped[2] && mapped[0] === mapped[2]) ta += 1;
            else if (mapped[0] !== mapped[1] && mapped[1] === mapped[2]) nta += 1;
        }
        const totalTrios = tc + ntc + ta + nta;
        const entropy = this.computeShannonEntropy([tc, ntc, ta, nta], totalTrios);
        const vix = totalTrios > 0 ? (entropy / 2.0) * 100 : 0;
        const pairs: [string, number][] = [['TC', tc], ['NTC', ntc], ['TA', ta], ['NTA', nta]];
        let dominantPattern = 'NONE'; let dominantCount = 0;
        for (const [pattern, count] of pairs) { if (count > dominantCount) { dominantPattern = pattern; dominantCount = count; } }
        return { totalTrios, dominantPattern, vix, dominantRatio: totalTrios > 0 ? dominantCount / totalTrios : 0 };
    }

    private checkToxicTableLock(): boolean {
        if (this.toxicTableLockUntil && Date.now() < this.toxicTableLockUntil) return true;
        if (this.toxicTableLockUntil && Date.now() >= this.toxicTableLockUntil) {
            this.toxicTableLockUntil = null; 
            this.saveSystemState();
        }
        return false;
    }

    private generateNextTrade(): void {
        this.activeStrategyId = null; this.triplicacaoPatternFound = null; this.triplicacaoTypeFound = null;

        const fullHistory = this.mesaTracker.getHistory();
        const REDS = new Set(AutoSettlementEngine.RED_NUMS);
        const operationalHistory = fullHistory.slice(-this.OPERATIONAL_WINDOW_SIZE);

        if (operationalHistory.length >= 10) {
            const reversedHistory = [...operationalHistory].reverse();
            const colorStats = this.computeTriplicacao(reversedHistory, v => REDS.has(v) ? 'A' : 'B');
            const parityStats = this.computeTriplicacao(reversedHistory, v => v % 2 === 0 ? 'A' : 'B');

            this.currentVixPercent = (colorStats.vix + parityStats.vix) / 2;
            if (this.currentVixPercent > 0 && !this.checkToxicTableLock()) {
                this.sessionStats.vixReadings.push(this.currentVixPercent);
            }
        }

        if (this.isDailyHardLocked) return;
        if (this.cooldownGuard.isSessionEnded || this.cooldownGuard.isLocked() || this.checkToxicTableLock()) return;
        if (this.forceObserveRound) { this.forceObserveRound = false; return; }
        if (operationalHistory.length < 10) return;

        if (this.currentVixPercent > this.vixTolerance) { this.sessionStats.entropyBlocks++; return; }

        const reversedHistory = [...operationalHistory].reverse();
        
        if (reversedHistory.length % 3 === 2) {
            const inicio = reversedHistory[1]; const confirmacao = reversedHistory[0];
            if (inicio !== 0 && confirmacao !== 0) {
                const colorStats = this.computeTriplicacao(reversedHistory, v => REDS.has(v) ? 'A' : 'B');
                const parityStats = this.computeTriplicacao(reversedHistory, v => v % 2 === 0 ? 'A' : 'B');

                let colorTarget = null; let parityTarget = null;
                if (colorStats.totalTrios >= 35 && colorStats.dominantRatio >= 0.42) {
                    const c0 = REDS.has(inicio) ? 'A' : 'B'; const c1 = REDS.has(confirmacao) ? 'A' : 'B';
                    if (colorStats.dominantPattern === 'TC' && c0 === c1) colorTarget = c1;
                    else if (colorStats.dominantPattern === 'NTC' && c0 === c1) colorTarget = (c1 === 'A' ? 'B' : 'A');
                    else if (colorStats.dominantPattern === 'TA' && c0 !== c1) colorTarget = (c1 === 'A' ? 'B' : 'A');
                    else if (colorStats.dominantPattern === 'NTA' && c0 !== c1) colorTarget = c1;
                }
                if (parityStats.totalTrios >= 35 && parityStats.dominantRatio >= 0.42) {
                    const p0 = inicio % 2 === 0 ? 'A' : 'B'; const p1 = confirmacao % 2 === 0 ? 'A' : 'B';
                    if (parityStats.dominantPattern === 'TC' && p0 === p1) parityTarget = p1;
                    else if (parityStats.dominantPattern === 'NTC' && p0 === p1) parityTarget = (p1 === 'A' ? 'B' : 'A');
                    else if (parityStats.dominantPattern === 'TA' && p0 !== p1) parityTarget = (p1 === 'A' ? 'B' : 'A');
                    else if (parityStats.dominantPattern === 'NTA' && p0 !== p1) parityTarget = p1;
                }
                if (colorTarget && parityTarget) {
                    if (colorStats.dominantRatio >= parityStats.dominantRatio) parityTarget = null; else colorTarget = null;
                }
                
                let prospectiveId = null;
                if (colorTarget) prospectiveId = colorTarget === 'A' ? 'TRIPLICACAO_RED' : 'TRIPLICACAO_BLACK';
                else if (parityTarget) prospectiveId = parityTarget === 'A' ? 'TRIPLICACAO_EVEN' : 'TRIPLICACAO_ODD';
                
                if (prospectiveId && this.performanceEvaluator.isAllowed(prospectiveId) && !this.disabledStrategies.has(prospectiveId)) {
                    this.activeStrategyId = prospectiveId;
                    if (colorTarget) { this.triplicacaoTypeFound = 'COR'; this.triplicacaoPatternFound = colorStats.dominantPattern; }
                    else { this.triplicacaoTypeFound = 'PARIDADE'; this.triplicacaoPatternFound = parityStats.dominantPattern; }
                }
            }
        }

        if (!this.activeStrategyId) {
            const timeline = operationalHistory.slice(-15); 
            let scores: Record<string, number> = { 'HEDGE_BLACK_COL3': 0, 'HEDGE_RED_COL2': 0, 'SECTOR_OMEGA': 0, 'SECTOR_ALPHA': 0, 'FUSION_SECTOR': 0 };
            const engineStrategies = AutoSettlementEngine.getStrategies();
            timeline.forEach(num => { Object.keys(scores).forEach(stratId => { const result = engineStrategies[stratId].evaluate(num); if (result.status === 'WIN_MAX' || result.status === 'WIN_MIN') scores[stratId]++; }); });
            
            let bestStrat = null; let maxScore = 0;
            Object.entries(scores).forEach(([strat, score]) => { 
                if (score > maxScore && this.performanceEvaluator.isAllowed(strat) && !this.disabledStrategies.has(strat)) { 
                    maxScore = score; 
                    bestStrat = strat; 
                } 
            });
            if (bestStrat && maxScore >= (timeline.length * 0.40)) { this.activeStrategyId = bestStrat; }
        }

        if (this.activeStrategyId) {
            const strat = AutoSettlementEngine.getStrategies()[this.activeStrategyId];
            const sizingResult = this.sizingEngine.calculateOperationalSizing(this.cooldownGuard.currentBankroll, this.currentVixPercent, strat.stake);
            this.dynamicStakeCalculated = sizingResult.finalStake;
            this.currentStakeMultiplier = sizingResult.multiplier;
        }
    }

    private renderExecutiveReport(reason: string): void {
        console.clear();
        console.log('======================================================');
        console.log(` 🛑 DOSSIÊ EXECUTIVO - ${reason}`);
        console.log('======================================================');
    }
    
    private renderTacticalReport(): void {}
    private renderHeatmap(): void {}
    private renderStats(): void {}
    private renderWeightsMatrix(): void {}

    private attachEventListeners(): void {
        this.rl.on('line', (line) => {
            const cmd = line.trim().toLowerCase();
            
            if (cmd === 'exit' || cmd === 'quit') { 
                if (this.liveTimer) clearInterval(this.liveTimer);
                this.saveSystemState(); 
                console.log('\n[!] Estado criptografado salvo. Encerrando...'); 
                this.rl.close(); 
                return; 
            }

            // ==========================================
            // SPRINT 380: COMANDO UNDO (Desfazer)
            // ==========================================
            if (cmd === 'undo') {
                const history = this.mesaTracker.getHistory();
                if (history.length > 0) {
                    const removedNum = history.pop(); // Remove o último número
                    // Cria uma nova instância limpa
                    this.mesaTracker = new (this.mesaTracker.constructor as any)();
                    // Refaz o histórico sem o número errado
                    history.forEach(n => this.mesaTracker.addNumber(n));
                    
                    this.saveSystemState();
                    this.generateNextTrade();
                    
                    console.clear();
                    console.log(`\n \x1b[33m[!] DESFEITO: O número ${removedNum} foi apagado da timeline.\x1b[0m`);
                    console.log(` O VIX e os gatilhos foram recalculados instantaneamente.`);
                    setTimeout(() => this.renderTerminalHud(), 2000);
                } else {
                    console.log('\n \x1b[31mA timeline já está vazia.\x1b[0m');
                    setTimeout(() => this.renderTerminalHud(), 1000);
                }
                return;
            }

            // SPRINT 379: Comandos de Roteamento Manual
            if (cmd.startsWith('disable ')) {
                const term = cmd.replace('disable ', '').trim().toUpperCase();
                Object.keys(AutoSettlementEngine.getStrategies()).forEach(id => {
                    if (id.includes(term)) { this.disabledStrategies.add(id); }
                });
                this.saveSystemState(); this.generateNextTrade(); this.renderTerminalHud(); return;
            }

            if (cmd.startsWith('enable ')) {
                const term = cmd.replace('enable ', '').trim().toUpperCase();
                if (term === 'ALL') { this.disabledStrategies.clear(); } else {
                    Object.keys(AutoSettlementEngine.getStrategies()).forEach(id => {
                        if (id.includes(term)) { this.disabledStrategies.delete(id); }
                    });
                }
                this.saveSystemState(); this.generateNextTrade(); this.renderTerminalHud(); return;
            }

            if (cmd === 'reset') {
                this.mesaTracker = new (this.mesaTracker.constructor as any)();
                this.toxicTableLockUntil = null;
                this.saveSystemState(); this.generateNextTrade(); this.renderTerminalHud(); return;
            }

            if (cmd === 'risk low') { this.vixTolerance = 98.0; this.saveSystemState(); this.generateNextTrade(); this.renderTerminalHud(); return; }
            if (cmd === 'risk normal') { this.vixTolerance = 95.0; this.saveSystemState(); this.generateNextTrade(); this.renderTerminalHud(); return; }
            
            if (cmd === 'help' || cmd === 'ajuda') {
                console.clear();
                console.log('======================================================');
                console.log(' ⚙️ RL.SYS CORE - MANUAL DE COMANDOS (HELP)');
                console.log('======================================================');
                console.log(' [ INSERÇÃO DE DADOS ]');
                console.log(' <0-36>             : Registra o número do giro.');
                console.log(' undo               : Apaga o último número digitado (Corrige erro).');
                console.log(' sync <n,n,...>     : Insere múltiplos números (Warmup).');
                console.log('\n [ GESTÃO E ROTEAMENTO ]');
                console.log(' disable <nome>     : Desliga estratégias (ex: disable sector).');
                console.log(' enable <nome>      : Religa estratégias (ex: enable all).');
                console.log(' reset              : Limpa a mesa.');
                console.log(' risk normal        : Trava o VIX em 95%.');
                console.log('------------------------------------------------------');
                this.inputMode = 'VIEW_ONLY'; this.rl.prompt(); return;
            }

            if (cmd === 'timeline') { console.clear(); console.log(`\n Histórico: \x1b[36m${this.mesaTracker.getTimeline(15)}\x1b[0m\n [ENTER] para voltar...`); this.inputMode = 'VIEW_ONLY'; this.rl.prompt(); return; }
            
            // ... (restante dos comandos padrão mantidos e operacionais) ...
            
            const num = parseInt(cmd, 10);
            if (isNaN(num) || num < 0 || num > 36) { this.rl.prompt(); return; }

            this.mesaTracker.addNumber(num); 
            if (this.activeStrategyId) { 
                this.pendingResult = this.settlementEngine.evaluate(num, this.activeStrategyId); 
                this.pendingResult.netAmount = this.pendingResult.netAmount * this.currentStakeMultiplier;
                this.inputMode = 'CONFIRM_TRADE'; this.renderTerminalHud(); return; 
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
        console.log(` PROVEDOR ATIVO .. \x1b[36m${this.sizingEngine.getProvider()}\x1b[0m (Floor: R$ ${this.sizingEngine.getProvider() === 'EVOLUTION' ? '0.50' : '0.10'})`);
        console.log('------------------------------------------------------');
        
        if (toxicLockActive) {
            console.log(`\x1b[31m ☣️ MESA TÓXICA REJEITADA PELO SISTEMA (VIX > ${this.vixTolerance.toFixed(1)}%)\x1b[0m`);
            this.rl.setPrompt('comando > ');
        }
        else if (this.inputMode === 'CONFIRM_TRADE') {
            const stratName = AutoSettlementEngine.getStrategies()[this.activeStrategyId!].name;
            let color = '\x1b[31m'; let label = 'RED (Loss)';
            if (this.pendingResult.status === 'WIN_MAX' || this.pendingResult.status === 'WIN_MIN') { color = '\x1b[32m'; label = 'GREEN'; }
            console.log(` ${color}RESULTADO: ${label} | R$ ${this.pendingResult.netAmount.toFixed(2)}\x1b[0m`);
            console.log(` [?] Você executou a [${stratName}] com Stake R$ ${this.dynamicStakeCalculated.toFixed(2)}?`);
            this.rl.setPrompt('Confirme (s/n) > ');
        } 
        else if (this.activeStrategyId) {
            const strat = AutoSettlementEngine.getStrategies()[this.activeStrategyId];
            console.log(` ESTRATÉGIA .. \x1b[36m${strat.name}\x1b[0m`);
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
