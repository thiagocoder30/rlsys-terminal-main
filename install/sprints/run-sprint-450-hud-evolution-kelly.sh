#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 450"
echo " HUD EVOLUTION & DYNAMIC KELLY ENGINE"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/2] Injetando a lógica matemática de Kelly e comandos táticos no Orchestrator..."
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
const { TermuxTtsVoiceCopilot } = require('../../infrastructure/audio/TermuxTtsVoiceCopilot.js');
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
    private trailingStopGuard!: TrailingStopGuard;
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
    
    private dynamicStakeCalculated: number = 0.10;
    private localHistoryCache: number[] = [];
    private currentTrioStatsText: string = 'Nenhum trio processado.';
    
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
        this.trailingStopGuard = new TrailingStopGuard(this.cooldownGuard.currentBankroll);
        
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

            // COMANDO: SYNC
            if (cmd.startsWith('sync ')) {
                const sequence = cmd.replace('sync ', '').trim();
                const nums = sequence.split(',').map(n => parseInt(n.trim(), 10));
                nums.forEach(n => {
                    if (!isNaN(n) && n >= 0 && n <= 36) {
                        this.mesaTracker.addNumber(n);
                        this.localHistoryCache.push(n);
                    }
                });
                this.generateNextTrade();
                return;
            }

            // COMANDO: UNDO
            if (cmd === 'undo') {
                if (this.localHistoryCache.length > 0) {
                    this.localHistoryCache.pop();
                    const internalHistory = (this.mesaTracker as any).history;
                    if (internalHistory && Array.isArray(internalHistory)) {
                        internalHistory.pop();
                    }
                    this.generateNextTrade();
                }
                return;
            }

            // COMANDO: HELP
            if (cmd === 'help') {
                console.clear();
                console.log('--- COMANDOS DISPONÍVEIS ---');
                console.log(' sync <n1,n2...> : Injeta fita de dados histórica');
                console.log(' undo            : Remove o último número inserido');
                console.log(' stats           : Exibe distribuição de frequências');
                console.log(' trios           : Exibe análise de entropia por blocos');
                console.log(' exit / quit     : Encerra o sistema com segurança');
                console.log('----------------------------');
                console.log('Pressione ENTER para retornar...');
                this.inputMode = 'VIEW_ONLY';
                return;
            }

            // COMANDO: STATS
            if (cmd === 'stats') {
                console.clear();
                const stats = this.mesaTracker.getDistributionStats();
                console.log('--- ESTRUTURA DE DISTRIBUIÇÃO DA MESA ---');
                console.log(`Total Giros: ${stats.total}`);
                console.log(`Vermelho   : ${stats.red} | Preto: ${stats.black} | Zero: ${stats.zero}`);
                console.log(`Pares      : ${stats.even} | Ímpares: ${stats.odd}`);
                console.log(`Altos      : ${stats.high} | Baixos: ${stats.low}`);
                console.log('-----------------------------------------');
                console.log('Pressione ENTER para retornar...');
                this.inputMode = 'VIEW_ONLY';
                return;
            }

            // COMANDO: TRIOS
            if (cmd === 'trios') {
                console.clear();
                console.log('--- ANÁLISE TOPOGRÁFICA DE TRIOS ---');
                console.log(this.currentTrioStatsText);
                console.log('------------------------------------');
                console.log('Pressione ENTER para retornar...');
                this.inputMode = 'VIEW_ONLY';
                return;
            }

            if (cmd === 'exit' || cmd === 'quit') { this.rl.close(); process.exit(0); }
            
            const num = parseInt(cmd, 10);
            if (!isNaN(num) && num >= 0 && num <= 36) {
                this.mesaTracker.addNumber(num);
                this.localHistoryCache.push(num);
                this.generateNextTrade();
            }
        });
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
            let maxC = 0, dom = 'NONE';
            const pairs: [string, number][] = [['TC',tc],['NTC',ntc],['TA',ta],['NTA',nta]];
            pairs.forEach(([n,c]) => { if(c>maxC){maxC=c; dom=n;} });
            return { vix: tot>0 ? (ent/2)*100 : 0, dom, ratio: tot>0 ? maxC/tot : 0, tot, tc, ntc, ta, nta };
        };

        const cStats = extractTrios(v => REDS.has(v) ? 'A' : 'B');
        const pStats = extractTrios(v => v%2===0 ? 'A' : 'B');
        this.currentVixPercent = (cStats.vix + pStats.vix) / 2;

        this.currentTrioStatsText = `Blocos de Cor     -> TC:${cStats.tc} NTC:${cStats.ntc} TA:${cStats.ta} NTA:${cStats.nta} (Dominância: ${cStats.dom})\n` +
                                    `Blocos Paridade  -> TC:${pStats.tc} NTC:${pStats.ntc} TA:${pStats.ta} NTA:${pStats.nta} (Dominância: ${pStats.dom})`;

        const allowedSet = new Set<string>();
        Object.keys(AutoSettlementEngine.getStrategies()).forEach(id => {
            if (this.performanceEvaluator.isAllowed(id) && !this.disabledStrategies.has(id)) {
                allowedSet.add(id);
            }
        });

        const allocation = this.allocationEngine.allocateCapital(operationalHistory, AutoSettlementEngine.getStrategies() as any, allowedSet);
        
        let prospectiveId = null;
        if (allocation.winningStrategyId) {
            prospectiveId = allocation.winningStrategyId;
            this.activeStrategyId = allocation.winningStrategyId;
        } else {
            this.activeStrategyId = null;
        }

        this.liveConvergence = Math.round(100 - this.currentVixPercent);
        const maxRatio = Math.max(cStats.ratio, pStats.ratio);
        this.liveConfidence = Math.round((maxRatio / 0.5) * 100); 

        if (this.liveConvergence > 80 && this.liveConfidence > 75) this.liveExecutionPressure = 'AGGRESSIVE_ENTRY';
        else if (this.liveConvergence > 65 && this.liveConfidence > 60) this.liveExecutionPressure = 'STANDARD_ENTRY';
        else this.liveExecutionPressure = 'REDUCE_EXPOSURE';

        // INTEGRAÇÃO: EQUAÇÃO DE KELLY DINÂMICA (Mínimo Pragmatic R$ 0.10)
        if (prospectiveId) {
            // b = coeficiente de pagamento líquido (0.5 para colunas/duplas, 1.0 para chances simples)
            const b = prospectiveId.includes('CROSS_GRID_HEDGE') ? 0.5 : 1.0;
            const p = (this.liveConfidence > 0 ? this.liveConfidence : 50) / 100;
            const q = 1 - p;
            
            let kellyFraction = (b * p - q) / b;
            if (kellyFraction <= 0) kellyFraction = 0.02; // Fração mínima de segurança (2%)

            // Quarter-Kelly (Fração de 25% para suavizar variância de amostragem)
            const calculatedStake = this.cooldownGuard.currentBankroll * kellyFraction * 0.25;
            
            // Restrição de Piso Estrito da Pragmatic Play (R$ 0.10)
            if (calculatedStake < 0.10) {
                this.dynamicStakeCalculated = 0.10;
            } else {
                // Arredonda para o múltiplo de R$ 0.10 mais próximo para aceitação da ficha
                this.dynamicStakeCalculated = Math.round(calculatedStake * 10) / 10;
            }
        } else {
            this.dynamicStakeCalculated = 0.10;
        }

        this.updateXaiTranslation(prospectiveId);
        this.renderTerminalHud();
    }

    private updateXaiTranslation(prospectiveId: string | null): void {
        if (!prospectiveId) {
            this.xaiQualification = 'NÃO';
            this.xaiMoment = 'AGORA NÃO';
            if (this.liveConvergence > 70) {
                this.xaiReason = 'Janela abrindo, porém regime ainda sem maturação suficiente.';
            } else if (this.currentVixPercent > this.vixTolerance) {
                this.xaiReason = 'Entropia máxima detetada (Mesa Tóxica). Observar.';
            } else {
                this.xaiReason = 'Aguardando dados estruturais da mesa.';
            }
            return;
        }

        this.xaiQualification = 'SIM';
        
        if (this.liveExecutionPressure === 'AGGRESSIVE_ENTRY') {
            this.xaiMoment = 'ENTRAR';
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

    private renderTerminalHud(): void {
        console.clear();
        console.log('======================================================');
        console.log(' 🛡️  RL.SYS CORE - ENTERPRISE ORCHESTRATOR [V3]');
        console.log('======================================================');
        console.log(` BANCA ATUAL ..... R$ ${this.cooldownGuard.currentBankroll.toFixed(2)}`);
        console.log(` META GLOBAL ..... R$ ${this.cooldownGuard.nextMilestone.toFixed(2)}`);
        
        // Cálculo e exibição clara dos Degraus Intermediários (Middle Milestones)
        const totalTargetGain = this.cooldownGuard.nextMilestone - this.initialBankroll;
        const m1 = this.initialBankroll + (totalTargetGain * 0.25);
        const m2 = this.initialBankroll + (totalTargetGain * 0.50);
        const m3 = this.initialBankroll + (totalTargetGain * 0.75);
        console.log(` DEGRAUS TÁTICOS . [M1: R$ ${m1.toFixed(2)}] → [M2: R$ ${m2.toFixed(2)}] → [M3: R$ ${m3.toFixed(2)}]`);
        console.log(` ENTROPIA (VIX) .. ${this.currentVixPercent.toFixed(1)}%`);
        console.log('------------------------------------------------------');
        console.log(` Estratégia ... \x1b[36m${this.activeStrategyId || 'Nenhuma'}\x1b[0m`);
        console.log(` Qualificação . ${this.xaiQualification === 'SIM' ? '\x1b[32mSIM\x1b[0m' : '\x1b[31mNÃO\x1b[0m'}`);
        console.log(` Momento ...... ${this.xaiMoment === 'AGORA NÃO' ? '\x1b[33mAGORA NÃO\x1b[0m' : `\x1b[32m${this.xaiMoment}\x1b[0m`}`);
        console.log(` Confiança .... ${this.liveConfidence}`);
        console.log(` STAKE KELLY .. \x1b[32mR$ ${this.dynamicStakeCalculated.toFixed(2)}\x1b[0m`);
        console.log(` Motivo ....... ${this.xaiReason}`);
        console.log('======================================================');
        this.rl.setPrompt('roleta/comando > ');
        this.rl.prompt(true);
    }
}
EOF

echo "[2/2] Compilando e validando integridade com o compilador TypeScript..."
npx tsc

echo "======================================"
echo -e "\033[1;32m SPRINT 450 INSTALADA COM SUCESSO \033[0m"
echo " STATUS: HUD COMANDOS & DYNAMIC KELLY ATIVOS"
echo "======================================"
