import { MarkovAnalyzer } from '../../domain/decision/features/MarkovAnalyzer';
import { EntropyAnalyzer } from '../../domain/decision/features/EntropyAnalyzer';
import { ZScoreAnalyzer } from '../../domain/decision/features/ZScoreAnalyzer';
import { TacticalExecutionRequest } from './dto/TacticalExecutionRequest';
import { IntelligenceExecutionResult } from './dto/IntelligenceExecutionResult';
import { RuntimeSessionManager } from './RuntimeSessionManager';
import { SnapshotManager } from './SnapshotManager';
import { DecisionLedger } from './DecisionLedger';
import { RuntimeTelemetry } from './RuntimeTelemetry';

export const STRATEGY_ZONES: Record<string, number[]> = {
    "ZONE_VOISINS": [22,18,29,7,28,12,35,3,26,0,32,15,19,4,21,2,25],
    "ZONE_TIERS": [27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9],
    "ZONE_ORPHELINS": [1,20,14,31,9,17,34,6],
    "SECTOR_ZERO_GAME": [12,35,3,26,0,32,15],
    "SECTOR_POTINHO": [11,30,8,23,10,5],
    "CROSS_TERMINAL_7": [7,17,27],
    "CROSS_TERMINAL_9": [9,19,29],
    "FUSION_REDUZIDA": [0,32,15,19,4,21,2,25]
};

export class QuantitativeEnginePipeline {
    private readonly markov = new MarkovAnalyzer();
    private readonly entropy = new EntropyAnalyzer();
    private readonly zScore = new ZScoreAnalyzer();

    private timeline: number[] = [];
    private shadowWeights: Record<string, number> = {};
    private shadowPnL: Record<string, number> = {};
    private pnlHistory: Record<string, number[]> = {};
    private minChip = 2.50;
    private peakBankroll = 0;
    
    constructor(
        private sessionManager: RuntimeSessionManager,
        private snapshotManager: SnapshotManager,
        private ledger: DecisionLedger,
        private telemetry: RuntimeTelemetry
    ) {
        this.resetInternalState();
    }

    private resetInternalState() {
        this.shadowWeights = {};
        this.shadowPnL = {};
        this.pnlHistory = {};
        for (const k of Object.keys(STRATEGY_ZONES)) {
            this.shadowWeights[k] = 1.0;
            this.shadowPnL[k] = 0;
            this.pnlHistory[k] = [];
        }
    }

    public sync(sessionId: string, numbers: number[]): IntelligenceExecutionResult {
        let session = this.sessionManager.getSession(sessionId);
        if (!session) {
            session = this.sessionManager.createSession(sessionId, 0, 'PRAGMATIC');
        }

        this.resetInternalState();
        this.timeline = [];
        this.markov.sync([]);
        
        let bankroll = session.currentBankroll;
        for (const num of numbers) {
            this.processRoundInternal(sessionId, num, false, bankroll);
        }
        
        const sample = numbers.slice(-12);
        const vix = this.entropy.calculateVix(sample);
        
        let isRejected = false;
        let rejectReason = "";
        
        const sortedPnLs = Object.values(this.shadowPnL).sort((a, b) => b - a);
        const top3AvgPnL = (sortedPnLs[0] + sortedPnLs[1] + sortedPnLs[2]) / 3;

        if (vix > 85.0) {
            isRejected = true;
            rejectReason = `VIX CRÍTICO EM REPROVAÇÃO (${vix.toFixed(1)}%). Mesa em estado de Caos Absoluto. Padrões instáveis.`;
        } else if (top3AvgPnL <= 0) {
            isRejected = true;
            rejectReason = `ESTRESSE DE MATRIZ NEGATIVO (Média Top 3 PnL: ${top3AvgPnL.toFixed(2)}). A mesa está devorando o arsenal.`;
        }

        const status = isRejected ? 'REJECTED' : 'APPROVED';
        const msg = isRejected ? rejectReason : "Mesa homologada com sucesso. Parâmetros dentro da normalidade.";

        if (isRejected) {
            this.sessionManager.lockSession(sessionId);
        } else {
            this.sessionManager.updateSession(sessionId, { status: 'ACTIVE' });
        }

        this.ledger.append(sessionId, '5.0.0', 'Sync Tape Completed', isRejected ? rejectReason : 'Tape synchronized');
        this.telemetry.incrementDecisions();

        return {
            newTimeline: [...this.timeline],
            shadowWeights: { ...this.shadowWeights },
            shadowPnL: { ...this.shadowPnL },
            vix,
            preFlightStatus: status,
            preFlightReason: msg,
            isLocked: isRejected,
            lockReason: isRejected ? "MESA REPROVADA NO PRE-FLIGHT" : "",
            activeStrategy: null,
            activeStake: 0,
            auditReason: "",
            oracleMessage: "BURN-IN FINALIZADO. Sincronização de Tape concluída.",
            peakBankroll: this.peakBankroll
        };
    }

    public execute(request: TacticalExecutionRequest): IntelligenceExecutionResult {
        let session = this.sessionManager.getSession(request.sessionId);
        if (!session) {
            session = this.sessionManager.createSession(request.sessionId, request.bankroll, request.provider);
        }
        
        if (session.status === 'LOCKED' || session.status === 'FINISHED') {
            throw new Error(`Cannot execute on ${session.status} session`);
        }

        if (!request.isSkip && request.bankroll > this.peakBankroll) {
            this.peakBankroll = request.bankroll;
        }
        
        const result = this.processRoundInternal(request.sessionId, request.value, request.isSkip, request.bankroll);
        return result;
    }

    private processRoundInternal(sessionId: string, drawnNumber: number, isSkip: boolean, currentBankroll: number): IntelligenceExecutionResult {
        this.markov.update(drawnNumber);
        this.timeline.push(drawnNumber);
        if (this.timeline.length > 15) this.timeline.shift();

        for (const strat of Object.keys(STRATEGY_ZONES)) {
            const isWin = STRATEGY_ZONES[strat].includes(drawnNumber);
            let winReward = 0.15; let lossPenalty = 0.20;
            if (strat.startsWith('CROSS_')) { winReward = 0.10; lossPenalty = 0.35; } 
            else if (['ZONE_VOISINS', 'SECTOR_POTINHO', 'FUSION_REDUZIDA'].includes(strat)) { winReward = 0.15; lossPenalty = 0.20; } 
            else { winReward = 0.25; lossPenalty = 0.10; }
            
            if (isWin) this.shadowWeights[strat] = Math.min(3.0, this.shadowWeights[strat] + winReward);
            else this.shadowWeights[strat] = Math.max(0.1, this.shadowWeights[strat] - lossPenalty);
            
            const baseUnits = this.getBaseUnits(strat);
            const totalCost = baseUnits * this.minChip;
            const payout = this.calculatePayout(strat, drawnNumber, this.minChip, totalCost);
            const pnl = payout > 0 ? (payout - totalCost) : -totalCost;
            
            this.shadowPnL[strat] += pnl;
            this.pnlHistory[strat].push(this.shadowPnL[strat]);
            if (this.pnlHistory[strat].length > 20) this.pnlHistory[strat].shift();
        }

        const vix = this.entropy.calculateVix(this.timeline);
        
        let bestStrat = null; 
        let highestWeight = 0; 
        let bestZScore = 0;
        
        for (const strat of Object.keys(STRATEGY_ZONES)) {
            const zScore = this.zScore.calculateZScore(this.pnlHistory[strat]);
            const weight = this.shadowWeights[strat] + (zScore * 0.15);
            
            let reqWeight = 1.6;
            if (vix > 85) reqWeight = 2.0;
            else if (vix > 60) reqWeight = 1.8;

            if (weight >= reqWeight && weight > highestWeight) {
                highestWeight = weight; 
                bestStrat = strat; 
                bestZScore = zScore;
            }
        }

        let auditReason = "";
        if (bestStrat) {
            auditReason = `Gatilho Z-Score acionado (${bestZScore.toFixed(2)}σ). Peso ${highestWeight.toFixed(2)} superou exigência.`;
        }

        this.snapshotManager.createSnapshot({
            sessionId,
            timestampUtc: new Date().toISOString(),
            runtimeVersion: '5.0.0',
            bankroll: currentBankroll,
            peakBankroll: this.peakBankroll,
            drawdown: 0,
            operationalVix: vix,
            strategyWeights: { ...this.shadowWeights },
            shadowPnL: { ...this.shadowPnL },
            burnIn: 0,
            cooldown: 0,
            oracleState: `VIX: ${vix.toFixed(1)}%`,
            lockState: false
        });

        this.ledger.append(
            sessionId,
            '5.0.0',
            `Processed round ${drawnNumber}`,
            auditReason || 'No trigger'
        );

        this.telemetry.incrementDecisions();
        this.telemetry.updateSnapshotCount(this.snapshotManager.getSnapshotCount());
        this.telemetry.updateActiveSessions(this.sessionManager.getActiveSessionsCount());

        this.sessionManager.updateSession(sessionId, {
            currentBankroll,
            peakBankroll: this.peakBankroll,
            strategy: bestStrat,
            status: 'ACTIVE'
        });

        return {
            newTimeline: [...this.timeline],
            shadowWeights: { ...this.shadowWeights },
            shadowPnL: { ...this.shadowPnL },
            vix,
            preFlightStatus: 'APPROVED',
            preFlightReason: "",
            isLocked: false,
            lockReason: "",
            activeStrategy: bestStrat,
            activeStake: bestStrat ? this.getBaseUnits(bestStrat) * this.minChip : 0,
            auditReason,
            oracleMessage: `Análise Quantitativa Concluída. VIX Atual: ${vix.toFixed(1)}%.`,
            peakBankroll: this.peakBankroll
        };
    }

    private getBaseUnits(strategyName: string): number {
        const lengths: Record<string, number> = {
            "ZONE_VOISINS": 9,
            "ZONE_TIERS": 6,
            "ZONE_ORPHELINS": 5,
            "SECTOR_ZERO_GAME": 4,
            "SECTOR_POTINHO": 6,
            "CROSS_TERMINAL_7": 3,
            "CROSS_TERMINAL_9": 3,
            "FUSION_REDUZIDA": 8
        };
        return lengths[strategyName] || 1;
    }

    private calculatePayout(strat: string, drawnNumber: number, minChip: number, totalCost: number): number {
        if (!STRATEGY_ZONES[strat].includes(drawnNumber)) return 0;
        if (strat === 'ZONE_VOISINS') return 9 * minChip;
        if (strat === 'ZONE_TIERS') return 18 * minChip;
        if (strat === 'ZONE_ORPHELINS') return 18 * minChip;
        if (strat === 'SECTOR_ZERO_GAME') return 18 * minChip;
        if (strat === 'SECTOR_POTINHO') return 18 * minChip;
        if (strat.startsWith('CROSS_')) return 36 * minChip;
        if (strat === 'FUSION_REDUZIDA') return 9 * minChip;
        return 0;
    }
}
