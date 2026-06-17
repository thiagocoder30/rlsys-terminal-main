#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 375"
echo " XAI STATISTICAL DASHBOARDS (HEATMAP & STATS)"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/3] Expandindo Contrato de Analytics (SOLID: OCP)..."
cat > src/domain/interfaces/IAnalyticsEngine.ts <<'EOF'
export interface IAnalyticsEngine {
    addNumber(num: number): void;
    getHistory(): number[];
    getTimeline(length: number): string;
    getFrequencies(): Map<number, number>;
    getDistributionStats(): {
        total: number;
        red: number; black: number; zero: number;
        even: number; odd: number;
        high: number; low: number;
    };
}
EOF

echo "[2/3] Implementando Motores de Estatística Topográfica..."
cat > src/domain/analytics/LiveMesaTracker.ts <<'EOF'
import { IAnalyticsEngine } from '../interfaces/IAnalyticsEngine';

export class LiveMesaTracker implements IAnalyticsEngine {
    private _history: number[] = [];
    private readonly MAX_CAPACITY = 500;
    
    // Topografia universal da Roleta Europeia
    private readonly RED_NUMS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

    public addNumber(num: number): void {
        this._history.push(num);
        if (this._history.length > this.MAX_CAPACITY) {
            this._history.shift();
        }
    }

    public getHistory(): number[] {
        return [...this._history];
    }

    public getTimeline(length: number): string {
        const slice = this._history.slice(-length);
        return slice.join(' - ');
    }

    public getFrequencies(): Map<number, number> {
        const freq = new Map<number, number>();
        // Inicializa todos de 0 a 36 com zero ocorrências
        for (let i = 0; i <= 36; i++) freq.set(i, 0);
        
        this._history.forEach(num => {
            freq.set(num, (freq.get(num) || 0) + 1);
        });
        return freq;
    }

    public getDistributionStats() {
        const stats = { total: this._history.length, red: 0, black: 0, zero: 0, even: 0, odd: 0, high: 0, low: 0 };
        
        this._history.forEach(num => {
            if (num === 0) { stats.zero++; return; }
            
            if (this.RED_NUMS.has(num)) stats.red++; else stats.black++;
            if (num % 2 === 0) stats.even++; else stats.odd++;
            if (num >= 1 && num <= 18) stats.low++; else stats.high++;
        });
        
        return stats;
    }
}
EOF

echo "[3/3] Injetando Dashboards de Heatmap e Stats na Camada de Apresentação..."
cat > src/presentation/cli/LivePaperOrchestrator.ts <<'EOF'
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { IBankrollRepository } from '../../domain/interfaces/IBankrollRepository';
import { IAnalyticsEngine } from '../../domain/interfaces/IAnalyticsEngine';
import { PositionSizingEngine, CasinoProvider } from '../../domain/risk/PositionSizingEngine';
import { TrailingStopGuard } from '../../domain/risk/TrailingStopGuard';

const { DynamicEmotionalCooldownGuard } = require('../../domain/risk/DynamicEmotionalCooldownGuard.js');
const { TermuxTtsVoiceCopilot } = require('../../infrastructure/audio/TermuxTtsVoiceCopilot.js');
const { AutoSettlementEngine } = require('../../domain/financial/AutoSettlementEngine.js');

export class LivePaperOrchestrator {
    private rl: readline.Interface;
    private bankrollRepo: IBankrollRepository;
    private mesaTracker: IAnalyticsEngine;
    private sizingEngine: PositionSizingEngine;
    private trailingStopGuard!: TrailingStopGuard;
    
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
    
    private isDailyHardLocked: boolean = false;
    private hardLockDateEpoch: number | null = null;
    
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
        }

        this.attachEventListeners();
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
        this.bankrollRepo.save(currentSnapshot);
    }

    private logDataForLaboratory(number: number, action: string, outcome: string, netAmount: number): void {
        try {
            const logEntry = {
                timestamp: Date.now(),
                number: number,
                vix: parseFloat(this.currentVixPercent.toFixed(1)),
                strategy: this.activeStrategyId || 'NONE',
                action: action,
                outcome: outcome || 'OBSERVE',
                netAmount: netAmount || 0,
                bankroll: parseFloat(this.cooldownGuard.currentBankroll.toFixed(2)),
                provider: this.sizingEngine.getProvider()
            };
            fs.appendFileSync(this.historicalLogPath, JSON.stringify(logEntry) + '\n', 'utf8');
        } catch (err) {}
    }

    private registerStatOutcome(isWin: boolean, strategyId: string): void {
        if (isWin) {
            this.sessionStats.wins++;
            this.sessionStats.strategyWins[strategyId] = (this.sessionStats.strategyWins[strategyId] || 0) + 1;
        } else {
            this.sessionStats.losses++;
        }
    }

    private getMvpStrategy(): string {
        let mvp = 'N/A'; let max = 0;
        for (const [strat, wins] of Object.entries(this.sessionStats.strategyWins)) {
            if (wins > max) { max = wins; mvp = AutoSettlementEngine.getStrategies()[strat].name; }
        }
        return mvp;
    }

    private getAverageVix(): string {
        if (this.sessionStats.vixReadings.length === 0) return "0.0";
        const sum = this.sessionStats.vixReadings.reduce((a, b) => a + b, 0);
        return (sum / this.sessionStats.vixReadings.length).toFixed(1);
    }

    private renderTacticalReport(): void {
        console.clear();
        const profit = this.cooldownGuard.currentBankroll - this.sessionStats.startBankroll;
        console.log('======================================================');
        console.log(' ⏸️  RELATÓRIO TÁTICO - DEGRAU ALCANÇADO');
        console.log('======================================================');
        console.log(` 📈 Lucro do Ciclo .... R$ ${profit > 0 ? '+' : ''}${profit.toFixed(2)}`);
        console.log(` 🏆 Estratégia MVP ... ${this.getMvpStrategy()}`);
        console.log(` 🌪️  VIX Médio ........ ${this.getAverageVix()}%`);
        console.log('------------------------------------------------------');
        console.log(` 🛑 STATUS: COOLDOWN DE 15 MINUTOS ATIVADO.`);
        console.log(` MENSAGEM: O seu cérebro precisa resetar a dopamina.`);
        console.log(` AÇÃO: Hidrate-se e afaste-se da tela.`);
        console.log('======================================================');
    }

    private renderExecutiveReport(reason: string): void {
        console.clear();
        const profit = this.cooldownGuard.currentBankroll - this.sessionStats.startBankroll;
        const percentRaw = this.sessionStats.startBankroll > 0 ? (profit / this.sessionStats.startBankroll) * 100 : 0;
        const percentStr = percentRaw.toFixed(2);
        const totalTrades = this.sessionStats.wins + this.sessionStats.losses;
        const hitRateStr = totalTrades > 0 ? ((this.sessionStats.wins / totalTrades) * 100).toFixed(1) : "0.0";
        
        console.log('======================================================');
        console.log(' 📑 DOSSIÊ EXECUTIVO - SESSÃO ENCERRADA');
        console.log('======================================================');
        console.log(` GATILHO ......... ${reason}`);
        console.log(` 💰 RESULTADO LÍQ. R$ ${profit > 0 ? '+' : ''}${profit.toFixed(2)} (${percentRaw > 0 ? '+' : ''}${percentStr}%)`);
        console.log(` 🎯 HIT RATE ..... ${hitRateStr}% (${this.sessionStats.wins}W / ${this.sessionStats.losses}L)`);
        console.log(` 🛡️  DEFESAS VIX .. ${this.sessionStats.entropyBlocks} bloqueios contra o caos`);
        console.log(` 🏆 MVP SESSÃO ... ${this.getMvpStrategy()}`);
        console.log('------------------------------------------------------');
        console.log(` 🛑 HARD LOCK ATIVADO. RETORNE APENAS ÀS 00:00 DO PRÓXIMO DIA.`);
        console.log('======================================================');
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
        if (this.toxicTableLockUntil && Date.now() >= this.toxicTableLockUntil) this.toxicTableLockUntil = null; 
        return false;
    }

    private generateNextTrade(): void {
        this.activeStrategyId = null; this.triplicacaoPatternFound = null; this.triplicacaoTypeFound = null;

        if (this.isDailyHardLocked) return;
        if (this.cooldownGuard.isSessionEnded || this.cooldownGuard.isLocked() || this.checkToxicTableLock()) return;
        if (this.forceObserveRound) { this.forceObserveRound = false; return; }
        
        const history = this.mesaTracker.getHistory();
        if (history.length < 10) return;

        const reversedHistory = [...history].reverse();
        const REDS = new Set(AutoSettlementEngine.RED_NUMS);
        
        const colorStats = this.computeTriplicacao(reversedHistory, v => REDS.has(v) ? 'A' : 'B');
        const parityStats = this.computeTriplicacao(reversedHistory, v => v % 2 === 0 ? 'A' : 'B');

        this.currentVixPercent = (colorStats.vix + parityStats.vix) / 2;
        if (this.currentVixPercent > 0) this.sessionStats.vixReadings.push(this.currentVixPercent);

        if (this.currentVixPercent > 95.0) { this.sessionStats.entropyBlocks++; return; }

        if (reversedHistory.length % 3 === 2) {
            const inicio = reversedHistory[1]; const confirmacao = reversedHistory[0];
            if (inicio !== 0 && confirmacao !== 0) {
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
                if (colorTarget) { this.triplicacaoTypeFound = 'COR'; this.triplicacaoPatternFound = colorStats.dominantPattern; this.activeStrategyId = colorTarget === 'A' ? 'TRIPLICACAO_RED' : 'TRIPLICACAO_BLACK'; }
                else if (parityTarget) { this.triplicacaoTypeFound = 'PARIDADE'; this.triplicacaoPatternFound = parityStats.dominantPattern; this.activeStrategyId = parityTarget === 'A' ? 'TRIPLICACAO_EVEN' : 'TRIPLICACAO_ODD'; }
            }
        }

        if (!this.activeStrategyId) {
            const timeline = history.slice(-15); 
            let scores: Record<string, number> = { 'HEDGE_BLACK_COL3': 0, 'HEDGE_RED_COL2': 0, 'SECTOR_OMEGA': 0, 'SECTOR_ALPHA': 0, 'FUSION_SECTOR': 0 };
            const engineStrategies = AutoSettlementEngine.getStrategies();
            timeline.forEach(num => { Object.keys(scores).forEach(stratId => { const result = engineStrategies[stratId].evaluate(num); if (result.status === 'WIN_MAX' || result.status === 'WIN_MIN') scores[stratId]++; }); });
            
            let bestStrat = null; let maxScore = 0;
            Object.entries(scores).forEach(([strat, score]) => { if (score > maxScore) { maxScore = score; bestStrat = strat; } });
            if (bestStrat && maxScore >= (timeline.length * 0.40)) { this.activeStrategyId = bestStrat; }
        }

        if (this.activeStrategyId) {
            this.dynamicStakeCalculated = this.sizingEngine.calculateStake(this.cooldownGuard.currentBankroll, this.currentVixPercent);
        }
    }

    private renderHeatmap(): void {
        console.clear();
        const freqMap = this.mesaTracker.getFrequencies();
        const historyLength = this.mesaTracker.getHistory().length;
        
        // Converte o Map para um array ordenado por frequência (decrescente)
        const sortedFreq = Array.from(freqMap.entries()).sort((a, b) => b[1] - a[1]);
        
        console.log('======================================================');
        console.log(` 🌡️  XAI: HEATMAP TOPOGRÁFICO (Amostra: ${historyLength} giros)`);
        console.log('======================================================');
        
        if (historyLength === 0) {
            console.log(' \x1b[33mAguardando dados da mesa...\x1b[0m');
        } else {
            console.log(' \x1b[31m🔥 HOT NUMBERS (Mais frequentes):\x1b[0m');
            for (let i = 0; i < 5; i++) {
                if (sortedFreq[i][1] > 0) {
                    console.log(`    Número \x1b[1m${sortedFreq[i][0].toString().padStart(2, ' ')}\x1b[0m : ${sortedFreq[i][1]} aparições`);
                }
            }
            
            console.log('\n \x1b[36m❄️  COLD NUMBERS (Menos frequentes/Ausentes):\x1b[0m');
            // Pega os 5 últimos do array ordenado
            for (let i = sortedFreq.length - 1; i >= sortedFreq.length - 5; i--) {
                console.log(`    Número \x1b[1m${sortedFreq[i][0].toString().padStart(2, ' ')}\x1b[0m : ${sortedFreq[i][1]} aparições`);
            }
        }
        
        console.log('------------------------------------------------------');
        console.log(' [!] Aviso: Cassinos usam isso para induzir a Falácia');
        console.log('     do Apostador. O sistema RL.SYS usa para atestar a');
        console.log('     Variância. Não utilize como sinal preditivo.');
        console.log('------------------------------------------------------');
        console.log(' Pressione ENTER para retornar à operação...');
    }

    private renderStats(): void {
        console.clear();
        const stats = this.mesaTracker.getDistributionStats();
        
        console.log('======================================================');
        console.log(` 📊 XAI: DISTRIBUIÇÃO DA MESA (Amostra: ${stats.total} giros)`);
        console.log('======================================================');
        
        if (stats.total === 0) {
            console.log(' \x1b[33mAguardando dados da mesa...\x1b[0m');
        } else {
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
            
            if (cmd === 'exit' || cmd === 'quit') { this.saveSystemState(); console.log('\n[!] Estado criptografado salvo. Encerrando...'); this.rl.close(); return; }
            
            if (cmd === 'help' || cmd === 'ajuda') {
                console.clear();
                console.log('======================================================');
                console.log(' ⚙️ RL.SYS CORE - MANUAL DE COMANDOS (HELP)');
                console.log('======================================================');
                console.log(' [ INSERÇÃO DE DADOS ]');
                console.log(' <0-36>             : Registra o número do giro na roleta.');
                console.log(' sync <n,n,...>     : Insere múltiplos números (Warmup).');
                console.log('\n [ AUDITORIA E ANÁLISE (XAI) ]');
                console.log(' timeline           : Exibe a fita dos últimos 15 giros.');
                console.log(' trios              : Abre o Scanner de Padrões (Triplicação).');
                console.log(' heatmap            : Mapeia números Quentes e Frios.');
                console.log(' stats              : Exibe a estatística geral da mesa.');
                console.log('\n [ GESTÃO DE RISCO ]');
                console.log(' provider pragmatic : Ajusta Floor do Provedor p/ R$ 0.10.');
                console.log(' provider evolution : Ajusta Floor do Provedor p/ R$ 0.50.');
                console.log(' setbankroll <v>    : Calibra banca inicial (Ex: setbankroll 50).');
                console.log('\n [ SISTEMA ]');
                console.log(' help / ajuda       : Exibe este painel de consulta.');
                console.log(' exit / quit        : Salva o estado criptografado e encerra.');
                console.log('------------------------------------------------------');
                console.log(' Pressione ENTER para retornar à operação...');
                this.inputMode = 'VIEW_ONLY';
                this.rl.prompt();
                return;
            }

            if (cmd === 'heatmap') { this.renderHeatmap(); this.inputMode = 'VIEW_ONLY'; this.rl.prompt(); return; }
            if (cmd === 'stats') { this.renderStats(); this.inputMode = 'VIEW_ONLY'; this.rl.prompt(); return; }
            if (cmd === 'timeline') { console.clear(); console.log(`\n Histórico: \x1b[36m${this.mesaTracker.getTimeline(15)}\x1b[0m\n [ENTER] para voltar...`); this.inputMode = 'VIEW_ONLY'; this.rl.prompt(); return; }
            
            if (cmd === 'trios') { 
                console.clear(); console.log('======================================================'); console.log(' 🧩 XAI: AUDITORIA DE TRIPLICAÇÃO (Últimos Eventos)'); console.log('======================================================'); 
                const h = this.mesaTracker.getHistory(); 
                if (h.length < 3) { console.log(' \x1b[33mDados insuficientes para formar trios estruturais.\x1b[0m'); } else { 
                    const reversed = [...h].reverse(); const remainder = reversed.length % 3; const REDS = new Set(AutoSettlementEngine.RED_NUMS); 
                    if (remainder === 2) { console.log(` \x1b[33m[PENDENTE]\x1b[0m Início: \x1b[1m${reversed[1]}\x1b[0m | Confirmação: \x1b[1m${reversed[0]}\x1b[0m | Finalização: ?`); } 
                    else if (remainder === 1) { console.log(` \x1b[33m[PENDENTE]\x1b[0m Início: \x1b[1m${reversed[0]}\x1b[0m | Confirmação: ? | Finalização: ?`); } 
                    let printed = 0; 
                    for (let i = remainder; i < reversed.length && printed < 8; i += 3) { 
                        const f = reversed[i]; const c = reversed[i+1]; const inc = reversed[i+2]; 
                        if ([inc, c, f].includes(0)) { console.log(` \x1b[31m[ANULADO]\x1b[0m  Trio com Zero: (${inc}, ${c}, ${f})`); } else { 
                            const cor = [inc, c, f].map(v => REDS.has(v) ? 'R' : 'B'); let pCor = 'N/A'; 
                            if (cor[0]===cor[1] && cor[1]===cor[2]) pCor = 'TC '; else if (cor[0]===cor[1] && cor[1]!==cor[2]) pCor = 'NTC'; else if (cor[0]!==cor[1] && cor[1]!==cor[2] && cor[0]===cor[2]) pCor = 'TA '; else if (cor[0]!==cor[1] && cor[1]===cor[2]) pCor = 'NTA'; 
                            const par = [inc, c, f].map(v => v%2===0 ? 'P' : 'I'); let pPar = 'N/A'; 
                            if (par[0]===par[1] && par[1]===par[2]) pPar = 'TC '; else if (par[0]===par[1] && par[1]!==par[2]) pPar = 'NTC'; else if (par[0]!==par[1] && par[1]!==par[2] && par[0]===par[2]) pPar = 'TA '; else if (par[0]!==par[1] && par[1]===par[2]) pPar = 'NTA'; 
                            console.log(` \x1b[32m[FECHADO]\x1b[0m  (${inc}, ${c}, ${f}) => Cor: \x1b[36m${pCor}\x1b[0m | Paridade: \x1b[36m${pPar}\x1b[0m`); 
                        } printed++; 
                    } 
                } 
                console.log('------------------------------------------------------'); console.log(' Pressione ENTER para voltar...'); this.inputMode = 'VIEW_ONLY'; this.rl.prompt(); return; 
            }

            if (cmd === 'provider pragmatic') { this.sizingEngine.setProvider('PRAGMATIC'); this.saveSystemState(); this.generateNextTrade(); this.renderTerminalHud(); return; }
            if (cmd === 'provider evolution') { this.sizingEngine.setProvider('EVOLUTION'); this.saveSystemState(); this.generateNextTrade(); this.renderTerminalHud(); return; }

            if (cmd.startsWith('setbankroll ')) {
                const newVal = parseFloat(cmd.replace('setbankroll ', '').trim());
                if (isNaN(newVal) || newVal <= 0) { console.log('Inválido.'); this.rl.prompt(); return; }
                this.cooldownGuard = new DynamicEmotionalCooldownGuard(newVal, null);
                this.activeStrategyId = null; this.inputMode = 'NUMBER'; this.pendingResult = null; this.toxicTableLockUntil = null;
                this.isDailyHardLocked = false; this.hardLockDateEpoch = null;
                this.sessionStats = { startBankroll: newVal, wins: 0, losses: 0, entropyBlocks: 0, strategyWins: {}, vixReadings: [] };
                this.trailingStopGuard = new TrailingStopGuard(newVal);
                this.saveSystemState(); this.generateNextTrade(); this.renderTerminalHud(); return;
            }
            
            if (this.isDailyHardLocked) { this.rl.prompt(); return; }
            if (this.inputMode === 'VIEW_ONLY') { this.inputMode = 'NUMBER'; this.renderTerminalHud(); return; }

            if (this.inputMode === 'CONFIRM_TRADE') {
                const executedStratId = this.activeStrategyId!;
                const history = this.mesaTracker.getHistory();
                const lastNumberAdded = history[history.length - 1];
                
                if (cmd === 's' || cmd === 'sim' || cmd === 'y') {
                    if (this.pendingResult.status === 'WIN_MAX' || this.pendingResult.status === 'WIN_MIN') {
                        this.cooldownGuard.registerOutcome(true, this.cooldownGuard.currentBankroll + this.pendingResult.netAmount);
                        this.registerStatOutcome(true, executedStratId);
                        this.logDataForLaboratory(lastNumberAdded, 'ENTER', this.pendingResult.status, this.pendingResult.netAmount);
                        this.voiceCopilot.speak('Green liquidado.');
                    } else if (this.pendingResult.status === 'PUSH') {
                        this.cooldownGuard.registerOutcome(true, this.cooldownGuard.currentBankroll);
                        this.logDataForLaboratory(lastNumberAdded, 'ENTER', 'PUSH', 0);
                    } else {
                        this.cooldownGuard.registerOutcome(false, this.cooldownGuard.currentBankroll - Math.abs(this.pendingResult.netAmount));
                        this.registerStatOutcome(false, executedStratId);
                        this.logDataForLaboratory(lastNumberAdded, 'ENTER', 'LOSS', this.pendingResult.netAmount);
                        this.voiceCopilot.speak('Red absorvido.');
                    }
                    this.saveSystemState();
                } else if (cmd === 'n' || cmd === 'nao' || cmd === 'não') {
                    this.logDataForLaboratory(lastNumberAdded, 'SKIP', 'USER_DECLINED', 0);
                    this.voiceCopilot.speak('Entrada descartada. Forçando rodada de observação.');
                    this.forceObserveRound = true;
                } else { console.log('Inválido.'); this.rl.prompt(); return; }
                
                this.inputMode = 'NUMBER'; this.pendingResult = null; this.activeStrategyId = null;
                
                this.trailingStopGuard.updatePeak(this.cooldownGuard.currentBankroll);
                const stopStatus = this.trailingStopGuard.checkStop(this.cooldownGuard.currentBankroll);
                
                if (stopStatus.isStopped) {
                    this.isDailyHardLocked = true; this.hardLockDateEpoch = Date.now(); this.saveSystemState();
                    this.renderExecutiveReport(stopStatus.reason);
                    this.rl.prompt(); return;
                }

                if (this.cooldownGuard.isSessionEnded) {
                    this.isDailyHardLocked = true; this.hardLockDateEpoch = Date.now(); this.saveSystemState();
                    this.renderExecutiveReport('META GLOBAL OU STOP LOSS ATINGIDO');
                    this.rl.prompt(); return;
                } else if (this.cooldownGuard.isLocked()) {
                    this.renderTacticalReport();
                    this.rl.prompt(); return;
                }

                this.generateNextTrade(); this.renderTerminalHud(); return;
            }

            if (this.cooldownGuard.isLocked() || this.checkToxicTableLock()) {
                if (!cmd.startsWith('sync ') && cmd !== 'timeline' && cmd !== 'trios') {
                    if (!this.checkToxicTableLock()) this.cooldownGuard.registerOutcome(false, this.cooldownGuard.currentBankroll); 
                    this.saveSystemState(); this.renderTerminalHud(); return;
                }
            }

            if (cmd.startsWith('sync ')) {
                const numbers = cmd.replace('sync ', '').split(',').map(n => parseInt(n.trim(), 10));
                numbers.forEach(n => { 
                    if (!isNaN(n) && n >= 0 && n <= 36) {
                        this.mesaTracker.addNumber(n);
                        this.logDataForLaboratory(n, 'OBSERVE', 'SYNC_FEED', 0);
                    }
                });
                this.generateNextTrade();
                if (numbers.length > 20 && this.currentVixPercent > 95.0) { this.toxicTableLockUntil = Date.now() + (15 * 60 * 1000); this.voiceCopilot.speak('Atenção. Entropia máxima detectada.'); }
                this.renderTerminalHud(); return;
            }

            const num = parseInt(cmd, 10);
            if (isNaN(num) || num < 0 || num > 36) { console.log('Entrada inválida.'); this.rl.prompt(); return; }

            this.mesaTracker.addNumber(num); 
            if (this.activeStrategyId) { 
                const strat = AutoSettlementEngine.getStrategies()[this.activeStrategyId];
                this.pendingResult = this.settlementEngine.evaluate(num, this.activeStrategyId); 
                
                const stakeMultiplier = this.dynamicStakeCalculated / strat.stake;
                this.pendingResult.netAmount = this.pendingResult.netAmount * stakeMultiplier;

                this.inputMode = 'CONFIRM_TRADE'; this.renderTerminalHud(); return; 
            }
            
            this.logDataForLaboratory(num, 'OBSERVE', 'NO_PATTERN', 0);
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
        if (this.currentVixPercent > 95) vixColor = '\x1b[31m'; 
        
        const historyLength = this.mesaTracker.getHistory().length;
        if (historyLength >= 10) { console.log(` ENTROPIA DA MESA. ${vixColor}${this.currentVixPercent.toFixed(1)}% (VIX)\x1b[0m`); } 
        else { console.log(` ENTROPIA DA MESA. \x1b[36mAguardando Warmup...\x1b[0m`); }
        
        console.log(` PROVEDOR ATIVO .. \x1b[36m${this.sizingEngine.getProvider()}\x1b[0m (Floor: R$ ${this.sizingEngine.getProvider() === 'EVOLUTION' ? '0.50' : '0.10'})`);
        console.log('------------------------------------------------------');
        
        if (toxicLockActive) {
            const remaining = Math.ceil((this.toxicTableLockUntil! - Date.now()) / 60000);
            console.log(`\x1b[31m ☣️ MESA TÓXICA REJEITADA PELO SISTEMA (VIX > 95%)\x1b[0m`);
            console.log(` AÇÃO: Feche a corretora. Retorne em ${remaining} minutos.`);
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
            if (this.pendingResult.status === 'WIN_MAX') { color = '\x1b[32m'; label = 'GREEN MÁXIMO'; }
            if (this.pendingResult.status === 'WIN_MIN') { color = '\x1b[32m'; label = 'GREEN MÍNIMO'; }
            if (this.pendingResult.status === 'PUSH') { color = '\x1b[33m'; label = 'PUSH (Empate)'; }
            console.log(` ${color}RESULTADO: ${label} | R$ ${this.pendingResult.netAmount.toFixed(2)}\x1b[0m`);
            console.log('------------------------------------------------------');
            console.log(` [?] Você executou a estratégia [${stratName}] com Stake R$ ${this.dynamicStakeCalculated.toFixed(2)}?`);
            this.rl.setPrompt('Confirme (s/n) > ');
        } 
        else if (this.activeStrategyId) {
            const strat = AutoSettlementEngine.getStrategies()[this.activeStrategyId];
            console.log(` ESTRATÉGIA .. \x1b[36m${strat.name}\x1b[0m`);
            if (this.triplicacaoPatternFound) console.log(` ALGORITMO ... [${this.triplicacaoTypeFound}] - Padrão: ${this.triplicacaoPatternFound}`);
            console.log(` AÇÃO ........ \x1b[32mENTRAR\x1b[0m`);
            console.log(` STAKE ....... R$ ${this.dynamicStakeCalculated.toFixed(2)} (Kelly Sizing via VIX)`);
            this.rl.setPrompt('roleta/comando > ');
        } 
        else {
            console.log(` AÇÃO ........ \x1b[33mOBSERVAR\x1b[0m`);
            this.rl.setPrompt('roleta/comando > ');
        }
        console.log('======================================================');
        this.rl.prompt();
    }
}
EOF

echo "[4/4] Commitando alterações na árvore de desenvolvimento..."
git add src/domain/interfaces/IAnalyticsEngine.ts src/domain/analytics/LiveMesaTracker.ts src/presentation/cli/LivePaperOrchestrator.ts
git commit -m "feat(analytics): introduce XAI dashboards for Heatmap and Table Statistics to visualize entropy distribution (Sprint 375)" > /dev/null

echo "======================================"
echo -e "\033[1;32m SPRINT 375 INSTALADA COM SUCESSO \033[0m"
echo " STATUS: DASHBOARDS XAI OPERACIONAIS"
echo "======================================"
