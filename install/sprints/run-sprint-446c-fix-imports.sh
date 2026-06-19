#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 446-C"
echo " IMPORT SEGREGATION & INTEGRITY"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

echo "[1/2] A corrigir segregação de módulos no Orquestrador..."
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

// CORREÇÃO: Imports segregados por domínio
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

    constructor(bankrollRepo: IBankrollRepository, mesaTracker: IAnalyticsEngine) {
        this.bankrollRepo = bankrollRepo;
        this.mesaTracker = mesaTracker;
        this.sizingEngine = new PositionSizingEngine();
        const availableStrategies = Object.keys(AutoSettlementEngine.getStrategies());
        this.performanceEvaluator = new StrategyPerformanceEvaluator(availableStrategies);
        this.voiceCopilot = new TermuxTtsVoiceCopilot();
        this.settlementEngine = new AutoSettlementEngine();
        this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        
        this.eventBus = new RuntimeEventBus(250);
        this.hftPipeline = new HFTPipelineCoordinator(this.eventBus, 85);
        this.allocationEngine = new InstitutionalStrategyAllocationEngine(15);
    }

    public async initialize(): Promise<void> {
        this.savedState = this.bankrollRepo.load();
        this.cooldownGuard = new DynamicEmotionalCooldownGuard(this.initialBankroll, this.savedState);
        this.trailingStopGuard = new TrailingStopGuard(this.cooldownGuard.currentBankroll);
        
        this.eventBus.subscribe(this.onHftSignalReceived.bind(this));
        this.generateNextTrade();
        this.renderTerminalHud();
        this.attachEventListeners();
    }

    private onHftSignalReceived(signal: PooledSignal): void {
        this.activeStrategyId = signal.strategyId;
        const strat = AutoSettlementEngine.getStrategies()[this.activeStrategyId!];
        if (strat) {
            const sizingResult = this.sizingEngine.calculateOperationalSizing(this.cooldownGuard.currentBankroll, this.currentVixPercent, strat.stake);
            this.dynamicStakeCalculated = sizingResult.finalStake;
            this.currentStakeMultiplier = sizingResult.multiplier;
        }
    }

    private attachEventListeners(): void {
        this.rl.on('line', (line) => {
            const cmd = line.trim().toLowerCase();

            if (cmd.startsWith('sync ')) {
                const sequence = cmd.replace('sync ', '').trim();
                const nums = sequence.split(',').map(n => parseInt(n.trim(), 10));
                nums.forEach(n => { if (!isNaN(n) && n >= 0 && n <= 36) this.mesaTracker.addNumber(n); });
                this.generateNextTrade();
                this.renderTerminalHud();
                return;
            }

            if (cmd === 'exit' || cmd === 'quit') { this.rl.close(); process.exit(0); }
            
            const num = parseInt(cmd, 10);
            if (!isNaN(num) && num >= 0 && num <= 36) {
                this.mesaTracker.addNumber(num);
                this.generateNextTrade();
                this.renderTerminalHud();
            }
        });
    }

    private generateNextTrade(): void {
        const fullHistory = this.mesaTracker.getHistory();
        const operationalHistory = fullHistory.slice(-this.OPERATIONAL_WINDOW_SIZE);
        const allowedSet = new Set<string>();
        
        Object.keys(AutoSettlementEngine.getStrategies()).forEach(id => {
            if (this.performanceEvaluator.isAllowed(id) && !this.disabledStrategies.has(id)) {
                allowedSet.add(id);
            }
        });

        const allocation = this.allocationEngine.allocateCapital(operationalHistory, AutoSettlementEngine.getStrategies() as any, allowedSet);
        if (allocation.winningStrategyId) {
            this.activeStrategyId = allocation.winningStrategyId;
        }
        this.renderTerminalHud();
    }

    private renderTerminalHud(): void {
        console.clear();
        console.log('--- RL.SYS HUD [INSTITUTIONAL MODE] ---');
        console.log(`Estratégia: ${this.activeStrategyId || 'Aguardando...'}`);
        console.log(`Momento: ${this.xaiMoment}`);
        console.log(`Motivo: ${this.xaiReason}`);
    }
}
EOF

echo "[2/2] A forçar a compilação final..."
npx tsc

echo "======================================"
echo " SISTEMA CORRIGIDO E COMPILADO"
echo "======================================"
