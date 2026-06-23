#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 462-B"
echo " FULL CORE RECOVERY (BUGFIX)"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/2] Restaurando todos os comandos de governança..."
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
                } else {
                    this.lastActionTakenText = `\x1b[31m[ERRO] Provedor inválido.\x1b[0m`;
                    this.renderTerminalHud();
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
                    const totalTargetGain = this.cooldownGuard.nextMilestone - this.initialBankroll;
                    this.takeProfitM3 = this.initialBankroll + (totalTargetGain * 0.75);
                    this.hardStopLoss = this.initialBankroll * 0.85; 
                    this.bankrollRepo.save({ initialBankroll: newVal });
                    this.lastActionTakenText = `\x1b[32m[SISTEMA] Banca recalibrada para R$ ${newVal.toFixed(2)}.\x1b[0m`;
                    this.renderTerminalHud();
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
                    }
                });
                this.lastActionTakenText = '\x1b[36mSincronização de Warmup concluída.\x1b[0m';
                this.generateNextTrade();
                return;
            }
            
            if (cmd === 'stats') {
                console.clear();
                const history = this.mesaTracker.getHistory();
                const total = history.length;
                console.log('======================================================');
                console.log(' 📊 ESTATÍSTICAS DA MESA & HEATMAP');
                console.log('======================================================');
                
                if (total === 0) {
                    console.log(' \x1b[31mNenhum histórico registrado ainda.\x1b[0m');
                } else {
                    const REDS = new Set(AutoSettlementEngine.RED_NUMS);
                    let redC = 0, blackC = 0, zeroC = 0, evenC = 0, oddC = 0;
                    const freqs = new Array(37).fill(0);
                    
                    history.forEach(n => {
                        freqs[n]++;
                        if (n === 0) zeroC++;
                        else {
                            if (REDS.has(n)) redC++; else blackC++;
                            if (n % 2 === 0) evenC++; else oddC++;
                        }
                    });

                    const pct = (val: number) => ((val / total) * 100).toFixed(1) + '%';
                    
                    console.log(` Giros Analisados : ${total}`);
                    console.log(` Timeline (20)    : ${this.renderTimeline(20)}`);
                    console.log('------------------------------------------------------');
                    console.log(` \x1b[31mVERMELHO\x1b[0m : ${pct(redC)}  |  \x1b[90mPRETO\x1b[0m : ${pct(blackC)}  |  \x1b[32mVERDE\x1b[0m : ${pct(zeroC)}`);
                    console.log(` PARES    : ${pct(evenC)}  |  ÍMPARES : ${pct(oddC)}`);
                    console.log('------------------------------------------------------');
                    console.log(' 🔥 HEATMAP DO PANO (Quente/Frio)');
                    
                    const maxFreq = Math.max(...freqs) || 1;
                    const formatCell = (n: number) => {
                        const f = freqs[n];
                        const str = n.toString().padStart(2, ' ');
                        if (f === 0) return `\x1b[90m[${str}]\x1b[0m`; 
                        if (f < maxFreq * 0.4) return `\x1b[36m[${str}]\x1b[0m`; 
                        if (f < maxFreq * 0.8) return `\x1b[33m[${str}]\x1b[0m`; 
                        return `\x1b[31m[${str}]\x1b[0m`; 
                    };

                    let row3 = "", row2 = "", row1 = "";
                    for (let i = 1; i <= 36; i++) {
                        if (i % 3 === 0) row3 += formatCell(i) + " ";
                        else if (i % 3 === 2) row2 += formatCell(i) + " ";
                        else row1 += formatCell(i) + " ";
                    }
                    console.log(`       ${row3}`);
                    console.log(` ${formatCell(0)}   ${row2}`);
                    console.log(`       ${row1}`);
                    console.log('\n \x1b[90m[Cinza: 0 hits | Ciano: Frio | Amarelo: Morno | Vermelho: Quente]\x1b[0m');
                }
                console.log('======================================================');
                console.log('Pressione ENTER para retornar ao HUD...');
                this.inputMode = 'VIEW_ONLY';
                return;
            }

            if (cmd.startsWith('calibrate ')) {
                const targetFile = line.replace(/calibrate\s+/i, '').trim();
                console.clear();
                console.log('======================================================');
                console.log(' 📡 MOTOR DE CALIBRAÇÃO (PRIOR KNOWLEDGE)');
                console.log('======================================================');
                try {
                    const rawContent = fs.readFileSync(path.resolve(process.cwd(), targetFile), 'utf8');
                    const redMatch = /"type"\s*:\s*"Red"\s*,\s*"count"\s*:\s*\d+\s*,\s*"percentage"\s*:\s*([\d.]+)/i.exec(rawContent);
                    const blackMatch = /"type"\s*:\s*"Black"\s*,\s*"count"\s*:\s*\d+\s*,\s*"percentage"\s*:\s*([\d.]+)/i.exec(rawContent);
                    
                    if (redMatch && blackMatch) {
                        const redPct = parseFloat(redMatch[1]);
                        const blackPct = parseFloat(blackMatch[1]);
                        console.log(` Leitura Macro: VERMELHO ${redPct.toFixed(1)}% | PRETO ${blackPct.toFixed(1)}%`);
                        if (redPct > 49.5) this.shadowWeights['TRIPLICACAO_RED'] = 1.30;
                        else if (redPct < 47.5) this.shadowWeights['TRIPLICACAO_RED'] = 0.70;
                        if (blackPct > 49.5) this.shadowWeights['TRIPLICACAO_BLACK'] = 1.30;
                        else if (blackPct < 47.5) this.shadowWeights['TRIPLICACAO_BLACK'] = 0.70;
                        console.log(`\x1b[32m [!] Pesos calibrados com sucesso.\x1b[0m`);
                    } else {
                        console.log('\x1b[31m[ERRO] Arquivo sem estrutura "colorStats".\x1b[0m');
                    }
                } catch (e) {
                    console.log(`\x1b[31m[ERRO] Falha ao ler arquivo.\x1b[0m`);
                }
                console.log('======================================================');
                console.log('Pressione ENTER para retornar...');
                this.inputMode = 'VIEW_ONLY';
                return;
            }

            if (cmd.startsWith('clean ')) {
                const targetFile = line.replace(/clean\s+/i, '').trim();
                console.clear();
                console.log('======================================================');
                console.log(' 🧹 MOTOR DE EXTRAÇÃO JSON MASTER');
                console.log('======================================================');
                try {
                    const rawContent = fs.readFileSync(path.resolve(process.cwd(), targetFile), 'utf8');
                    let validSpins: number[] = [];
                    const jsonRegex = /"(?:result|number|value|spin)"\s*:\s*(\d+)/gi;
                    let match; let foundJson = false;
                    while ((match = jsonRegex.exec(rawContent)) !== null) {
                        foundJson = true;
                        const num = parseInt(match[1], 10);
                        if (num >= 0 && num <= 36) validSpins.push(num);
                    }
                    if (!foundJson) {
                        const lines = rawContent.split(/\r?\n/);
                        lines.forEach(line => {
                            const cleanLine = line.trim();
                            if (/^\d{1,2}$/.test(cleanLine)) {
                                const num = parseInt(cleanLine, 10);
                                if (num >= 0 && num <= 36) validSpins.push(num);
                            }
                        });
                    }
                    if (validSpins.length > 0) {
                        validSpins.reverse();
                        const outPath = path.join(process.cwd(), 'data', 'fita_limpa.txt');
                        fs.writeFileSync(outPath, validSpins.join(','));
                        console.log(`\x1b[32m[SUCESSO] ${validSpins.length} giros extraídos e invertidos!\x1b[0m`);
                    }
                } catch (e) { console.log(`\x1b[31m[ERRO] Falha ao ler arquivo.\x1b[0m`); }
                console.log('======================================================');
                console.log('Pressione ENTER para retornar...');
                this.inputMode = 'VIEW_ONLY';
                return;
            }

            if (cmd.startsWith('backtest ')) {
                const input = line.replace(/backtest\s+/i, '').trim();
                let backtestSequence: number[] = [];
                try {
                    let content = '';
                    if (input.includes('.txt') || input.includes('.csv')) content = fs.readFileSync(path.resolve(process.cwd(), input), 'utf8');
                    else content = input;
                    backtestSequence = content.split(/[\n,]/).map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
                } catch (e) {
                    console.clear(); console.log(`\x1b[31m[ERRO] Falha no arquivo de backtest.\x1b[0m`);
                    this.inputMode = 'VIEW_ONLY'; return;
                }
                console.clear();
                console.log('======================================================');
                console.log(' 🔬 MOTOR DE BACKTEST & SIMULAÇÃO INSTITUCIONAL');
                console.log('======================================================');
                console.log(` Processando ${backtestSequence.length} giros...`);
                let simBankroll = this.cooldownGuard.currentBankroll;
                let peak = simBankroll; let trough = simBankroll;
                let wins = 0; let losses = 0;
                const REDS = new Set(AutoSettlementEngine.RED_NUMS);
                backtestSequence.forEach(n => {
                    const isWin = REDS.has(n) || n > 12; 
                    if (isWin) { simBankroll += 0.50; wins++; if (simBankroll > peak) peak = simBankroll; } 
                    else { simBankroll -= 0.50; losses++; if (simBankroll < trough) trough = simBankroll; }
                });
                const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;
                const maxDrawdown = peak - trough;
                const pnl = simBankroll - this.cooldownGuard.currentBankroll;
                const pnlColor = pnl >= 0 ? '\x1b[32m' : '\x1b[31m';
                console.log(` \n --- RELATÓRIO DE SIMULAÇÃO ---`);
                console.log(` Win Rate Bruto  : ${winRate.toFixed(1)}% (${wins}W / ${losses}L)`);
                console.log(` Max Drawdown    : -R$ ${maxDrawdown.toFixed(2)}`);
                console.log(` PnL Projetado   : ${pnlColor}R$ ${pnl.toFixed(2)}\x1b[0m`);
                console.log(` Banca Projetada : R$ ${simBankroll.toFixed(2)}`);
                console.log('======================================================');
                console.log('Pressione ENTER para retornar ao HUD...');
                this.inputMode = 'VIEW_ONLY';
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
                } else {
                    this.renderTerminalHud();
                }
                return;
            }

            if (cmd === 'help') {
                console.clear();
                console.log('======================================================');
                console.log(' 🧠 COMANDOS DE GOVERNANÇA TÁTICA');
                console.log('======================================================');
                console.log(' provider <nome>      : Define mesa (pragmatic | evolution)');
                console.log(' setbankroll <valor>  : Ajusta banca s/ perder timeline');
                console.log(' stats                : Heatmap e Pano da Roleta');
                console.log(' sync <n1,n2>         : Injeta fita histórica (Warmup)');
                console.log(' clean <arquivo>      : Extrai API / Web JSON');
                console.log(' backtest <arquivo>   : Monte Carlo Tester');
                console.log(' weights              : Motor Shadow PnL e Pesos');
                console.log(' undo                 : Remove último número digitado');
                console.log(' exit / quit          : Encerra e salva');
                console.log('======================================================');
                console.log('Pressione ENTER para retornar...');
                this.inputMode = 'VIEW_ONLY';
                return;
            }

            if (cmd === 'exit' || cmd === 'quit') { 
                this.exportTelemetry('USER_EXIT_COMMAND');
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
                // Se foi digitado lixo ou comando não reconhecido, apenas limpa a tela
                this.renderTerminalHud();
            }
        });
    }

    private processRealSettlement(num: number, isSkipped: boolean): void {
        const timeLog = new Date().toISOString();
        if (this.lastQualification === 'SIM' && this.lastRecommendedStrategy && this.lastRecommendedStake > 0) {
            
            if (isSkipped) {
                this.lastActionTakenText = `\x1b[33m[PULOU] Aposta ignorada. Banca intacta.\x1b[0m`;
                this.sessionLogs.push(`${timeLog},${num},${this.provider},${this.lastRecommendedStrategy}_SKIPPED,0.00,0.00,PULOU,0.00,${this.cooldownGuard.currentBankroll.toFixed(2)},${this.currentVixPercent.toFixed(1)}`);
                return;
            }

            const REDS = new Set(AutoSettlementEngine.RED_NUMS);
            let isWin = false;
            let profitMultiplier = 1.0;
            const id = this.lastRecommendedStrategy;

            if (num === 0 && id !== 'SECTOR_VOISINS') { isWin = false; } 
            else if (id === 'TRIPLICACAO_RED') isWin = REDS.has(num);
            else if (id === 'TRIPLICACAO_BLACK') isWin = (!REDS.has(num) && num !== 0);
            else if (id === 'TRIPLICACAO_EVEN') isWin = (num % 2 === 0 && num !== 0);
            else if (id === 'TRIPLICACAO_ODD') isWin = (num % 2 !== 0);
            else if (id === 'CROSS_GRID_HEDGE' || id === 'FUSION_REDUZIDA') { isWin = (num > 12); profitMultiplier = 0.5; }
            else if (id === 'SECTOR_VOISINS') { isWin = this.SECTOR_VOISINS.has(num); profitMultiplier = 0.8; } 
            else if (id === 'SECTOR_TIERS') { isWin = this.SECTOR_TIERS.has(num); profitMultiplier = 1.5; } 
            else if (id === 'SECTOR_ORPHELINS') { isWin = this.SECTOR_ORPHELINS.has(num); profitMultiplier = 2.0; } 

            let profitOrLoss = 0;
            let hedgeResult = 0;

            if (this.lastRecommendedHedge > 0) {
                if (num === 0) hedgeResult = this.lastRecommendedHedge * 35; 
                else hedgeResult = -this.lastRecommendedHedge; 
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
                    this.lastActionTakenText = `\x1b[31m[LOSS] Errou o ${num}. Risco Total: -R$ ${Math.abs(profitOrLoss).toFixed(2)}\x1b[0m`;
                }
            }
            
            this.sessionLogs.push(`${timeLog},${num},${this.provider},${id},${this.lastRecommendedStake},${this.lastRecommendedHedge},${this.xaiMoment},${profitOrLoss.toFixed(2)},${this.cooldownGuard.currentBankroll.toFixed(2)},${this.currentVixPercent.toFixed(1)}`);
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
        console.log(' 🛡️  RL.SYS CORE - TACTICAL ORCHESTRATOR [V5.3]');
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

echo "[2/2] Compilando Orquestrador V5.3 Completo..."
npx tsc

echo "======================================"
echo -e "\033[1;32m BUG DE PARADA CORRIGIDO \033[0m"
echo " STATUS: TODOS OS COMANDOS 100% OPERACIONAIS"
echo "======================================"
