#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 449"
echo " XAI BRAIN RESTORATION"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/2] A restaurar o motor matemático e o XAI no Orquestrador..."
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
        this.cooldownGuard = new DynamicEmotionalCooldownGuard(this.initialBankroll, this.savedState);
        this.trailingStopGuard = new TrailingStopGuard(this.cooldownGuard.currentBankroll);
        
        this.generateNextTrade();
        this.attachEventListeners();
    }

    private attachEventListeners(): void {
        this.rl.on('line', (line) => {
            const cmd = line.trim().toLowerCase();

            if (cmd.startsWith('sync ')) {
                const sequence = cmd.replace('sync ', '').trim();
                const nums = sequence.split(',').map(n => parseInt(n.trim(), 10));
                nums.forEach(n => { if (!isNaN(n) && n >= 0 && n <= 36) this.mesaTracker.addNumber(n); });
                this.generateNextTrade();
                return;
            }

            if (cmd === 'exit' || cmd === 'quit') { this.rl.close(); process.exit(0); }
            
            const num = parseInt(cmd, 10);
            if (!isNaN(num) && num >= 0 && num <= 36) {
                this.mesaTracker.addNumber(num);
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
            return { vix: tot>0 ? (ent/2)*100 : 0, dom, ratio: tot>0 ? maxC/tot : 0, tot };
        };

        const cStats = extractTrios(v => REDS.has(v) ? 'A' : 'B');
        const pStats = extractTrios(v => v%2===0 ? 'A' : 'B');
        this.currentVixPercent = (cStats.vix + pStats.vix) / 2;

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
        console.log('--- RL.SYS HUD [INSTITUTIONAL MODE] ---');
        console.log(`Estratégia: ${this.activeStrategyId || 'Nenhuma'}`);
        console.log(`Qualificação: ${this.xaiQualification}`);
        console.log(`Momento: ${this.xaiMoment}`);
        console.log(`Confiança: ${this.liveConfidence}`);
        console.log(`Motivo: ${this.xaiReason}`);
        console.log('=======================================');
        this.rl.prompt(true);
    }
}
EOF

echo "[2/2] A compilar o cérebro..."
npx tsc

echo "======================================"
echo -e "\033[1;32m CÉREBRO RESTAURADO COM SUCESSO \033[0m"
echo " STATUS: PRONTO PARA DADOS"
echo "======================================"
