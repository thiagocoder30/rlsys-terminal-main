import { randomUUID, createHash } from 'crypto';
import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../runtime/DecisionLedger';
import { ShadowDecisionEngine, DecisionEvaluationInput, OutcomeEvaluationInput } from './ShadowDecisionEngine';
import { ShadowTradeSimulator } from './ShadowTradeSimulator';
import { ShadowPortfolio } from './ShadowPortfolio';
import { ShadowPosition } from './ShadowPosition';
import {
    ShadowPerformanceSnapshot,
    StrategyPerformanceMetrics,
    RegimePerformanceMetrics
} from './ShadowPerformanceSnapshot';

export class ShadowReportService {
    private readonly decisionEngine = new ShadowDecisionEngine();
    private readonly simulator = new ShadowTradeSimulator();
    private readonly portfolios = new Map<string, ShadowPortfolio>();
    private readonly strategyStats = new Map<string, Map<string, { total: number; wins: number; profitLoss: number }>>();
    private readonly regimeStats = new Map<string, Map<string, { total: number; wins: number; profitLoss: number }>>();
    private readonly history: ShadowPerformanceSnapshot[] = [];
    private readonly positionsMap = new Map<string, ShadowPosition[]>();
    private readonly MAX_HISTORY = 100;

    private currentRegimeMap = new Map<string, string>();

    constructor(
        private readonly eventBus?: ObservabilityEventBus,
        private readonly ledger?: DecisionLedger
    ) {
        if (this.eventBus) {
            this.setupSubscriptions();
        }
    }

    private setupSubscriptions(): void {
        if (!this.eventBus) return;

        this.eventBus.subscribe('ROUND_PROCESSED', (event) => {
            const payload = event.payload || {};
            const sessionId = event.sessionId || 'SESSION-000';
            
            const decisionInput: DecisionEvaluationInput = {
                isOpportunity: payload.isOpportunity !== false && payload.status !== 'HOLD',
                strategy: (payload.suggestedStrategy as string) || (payload.strategy as string) || 'MARKOV_TREND',
                preFlightStatus: (payload.preFlightStatus as string) || 'APPROVED',
                status: (payload.status as string) || 'RECOMMENDATION',
                confidence: (payload.confidence as number) || 0.7,
                consensus: (payload.consensus as number) || 0.7
            };

            const outcomeInput: OutcomeEvaluationInput = {
                pnlDelta: payload.pnlDelta as number,
                isWin: payload.isWin as boolean,
                winningNumber: payload.winningNumber as number
            };

            this.processDecisionEvent(sessionId, decisionInput, outcomeInput);
        });

        this.eventBus.subscribe('RECOMMENDATION_GENERATED', (event) => {
            const payload = event.payload || {};
            const sessionId = event.sessionId || 'SESSION-000';

            const decisionInput: DecisionEvaluationInput = {
                isOpportunity: payload.isOpportunity as boolean,
                strategy: payload.strategy as string,
                preFlightStatus: payload.preFlightStatus as string,
                lockReason: payload.lockReason as string,
                confidence: payload.confidence as number,
                consensus: payload.consensus as number
            };

            // If no outcome attached yet, evaluate opportunity readiness
            this.processDecisionEvent(sessionId, decisionInput, {});
        });

        this.eventBus.subscribe('MARKET_REGIME_UPDATED', (event) => {
            const payload = event.payload || {};
            const sessionId = event.sessionId || 'SESSION-000';
            const snapshot = payload.snapshot as any;
            if (snapshot && snapshot.currentRegime) {
                this.currentRegimeMap.set(sessionId, snapshot.currentRegime);
            }
        });
    }

    private getOrCreatePortfolio(sessionId: string): ShadowPortfolio {
        let portfolio = this.portfolios.get(sessionId);
        if (!portfolio) {
            portfolio = new ShadowPortfolio(10000);
            this.portfolios.set(sessionId, portfolio);
        }
        return portfolio;
    }

    public processDecisionEvent(
        sessionId: string,
        decisionInput: DecisionEvaluationInput,
        outcomeInput: OutcomeEvaluationInput
    ): ShadowPerformanceSnapshot {
        const portfolio = this.getOrCreatePortfolio(sessionId);
        const evalResult = this.decisionEngine.evaluateDecision(decisionInput, outcomeInput);

        const currentRegime = this.currentRegimeMap.get(sessionId) || 'LOW_INFORMATION';
        const strategyName = decisionInput.strategy || 'UNKNOWN_STRATEGY';

        const simResult = this.simulator.simulateTrade({
            currentBankroll: portfolio.getCurrentBankroll(),
            result: evalResult,
            suggestedStake: undefined,
            stakePercentage: 2.0
        });

        const isWin = evalResult === 'WIN' ? true : evalResult === 'LOSS' ? false : null;
        portfolio.recordTrade(simResult.profitLoss, isWin);

        // Record Position
        const positionId = randomUUID();
        const timestampUtc = new Date().toISOString();
        const position: ShadowPosition = Object.freeze({
            positionId,
            sessionId,
            strategy: strategyName,
            stakePercentage: 2.0,
            stakeValue: simResult.stakeValue,
            entryRound: portfolio.getTotalTrades(),
            result: evalResult,
            profitLoss: simResult.profitLoss,
            timestampUtc
        });

        let positions = this.positionsMap.get(sessionId);
        if (!positions) {
            positions = [];
            this.positionsMap.set(sessionId, positions);
        }
        positions.push(position);

        // Update Strategy & Regime Stats
        if (evalResult === 'WIN' || evalResult === 'LOSS') {
            this.updateStratMap(sessionId, strategyName, evalResult === 'WIN', simResult.profitLoss);
            this.updateRegimeMap(sessionId, currentRegime, evalResult === 'WIN', simResult.profitLoss);
        }

        // Ledger Audit Entries
        if (this.ledger) {
            const rawAuditContent = `${timestampUtc}:${sessionId}:${strategyName}:${evalResult}:${simResult.profitLoss}`;
            const auditHash = createHash('sha256').update(rawAuditContent).digest('hex');

            this.ledger.append(sessionId, '5.0.0', 'SHADOW_DECISION_CREATED', JSON.stringify({
                strategy: strategyName,
                evaluation: evalResult,
                hash: auditHash
            }));

            this.ledger.append(sessionId, '5.0.0', 'SHADOW_TRADE_SIMULATED', JSON.stringify({
                positionId,
                stakeValue: simResult.stakeValue,
                profitLoss: simResult.profitLoss,
                newBankroll: portfolio.getCurrentBankroll(),
                hash: auditHash
            }));

            this.ledger.append(sessionId, '5.0.0', 'SHADOW_PERFORMANCE_UPDATED', JSON.stringify({
                roi: portfolio.getRoi(),
                drawdown: portfolio.getDrawdown(),
                winRate: portfolio.getWinRate(),
                hash: auditHash
            }));
        }

        return this.createAndEmitSnapshot(sessionId, currentRegime);
    }

    private updateStratMap(sessionId: string, strat: string, isWin: boolean, pnl: number): void {
        let m = this.strategyStats.get(sessionId);
        if (!m) {
            m = new Map();
            this.strategyStats.set(sessionId, m);
        }
        let stat = m.get(strat);
        if (!stat) {
            stat = { total: 0, wins: 0, profitLoss: 0 };
            m.set(strat, stat);
        }
        stat.total++;
        if (isWin) stat.wins++;
        stat.profitLoss += pnl;
    }

    private updateRegimeMap(sessionId: string, regime: string, isWin: boolean, pnl: number): void {
        let m = this.regimeStats.get(sessionId);
        if (!m) {
            m = new Map();
            this.regimeStats.set(sessionId, m);
        }
        let stat = m.get(regime);
        if (!stat) {
            stat = { total: 0, wins: 0, profitLoss: 0 };
            m.set(regime, stat);
        }
        stat.total++;
        if (isWin) stat.wins++;
        stat.profitLoss += pnl;
    }

    public createAndEmitSnapshot(sessionId: string, currentRegime: string = 'LOW_INFORMATION'): ShadowPerformanceSnapshot {
        const portfolio = this.getOrCreatePortfolio(sessionId);
        const snapshotId = randomUUID();
        const timestampUtc = new Date().toISOString();

        // Build Strategy Performance map
        const stratMap = this.strategyStats.get(sessionId);
        const strategyPerformance: Record<string, StrategyPerformanceMetrics> = {};
        let bestStrategy = 'MARKOV_TREND';
        let bestPnl = -Infinity;

        if (stratMap && stratMap.size > 0) {
            for (const [sName, sData] of stratMap.entries()) {
                const wr = sData.total > 0 ? Math.round((sData.wins / sData.total) * 1000) / 10 : 0;
                strategyPerformance[sName] = {
                    total: sData.total,
                    wins: sData.wins,
                    winRate: wr,
                    profitLoss: Math.round(sData.profitLoss * 100) / 100
                };
                if (sData.profitLoss > bestPnl) {
                    bestPnl = sData.profitLoss;
                    bestStrategy = sName;
                }
            }
        } else {
            strategyPerformance['MARKOV_TREND'] = { total: 0, wins: 0, winRate: 0, profitLoss: 0 };
        }

        // Build Regime Performance map
        const regMap = this.regimeStats.get(sessionId);
        const regimePerformance: Record<string, RegimePerformanceMetrics> = {};
        if (regMap && regMap.size > 0) {
            for (const [rName, rData] of regMap.entries()) {
                const wr = rData.total > 0 ? Math.round((rData.wins / rData.total) * 1000) / 10 : 0;
                regimePerformance[rName] = {
                    total: rData.total,
                    wins: rData.wins,
                    winRate: wr,
                    profitLoss: Math.round(rData.profitLoss * 100) / 100
                };
            }
        } else {
            regimePerformance[currentRegime] = { total: 0, wins: 0, winRate: 0, profitLoss: 0 };
        }

        const rawContent = `${snapshotId}:${sessionId}:${portfolio.getCurrentBankroll()}:${portfolio.getRoi()}:${portfolio.getDrawdown()}`;
        const snapshotHash = createHash('sha256').update(rawContent).digest('hex');

        const snapshot: ShadowPerformanceSnapshot = Object.freeze({
            snapshotId,
            sessionId,
            timestampUtc,
            initialBankroll: portfolio.getInitialBankroll(),
            currentBankroll: portfolio.getCurrentBankroll(),
            totalSimulations: portfolio.getTotalTrades(),
            wins: portfolio.getWins(),
            losses: portfolio.getLosses(),
            winRate: portfolio.getWinRate(),
            roi: portfolio.getRoi(),
            drawdown: portfolio.getDrawdown(),
            maxLossSequence: portfolio.getMaxLossSequence(),
            bestStrategy,
            strategyPerformance: Object.freeze(strategyPerformance),
            regimePerformance: Object.freeze(regimePerformance),
            snapshotHash
        });

        this.history.push(snapshot);
        if (this.history.length > this.MAX_HISTORY) {
            this.history.shift();
        }

        if (this.eventBus) {
            this.eventBus.publish('SHADOW_PERFORMANCE_UPDATED', '5.0.0', randomUUID(), sessionId, { snapshot });
        }

        return snapshot;
    }

    public getShadowPerformance(sessionId: string = 'SESSION-000'): ShadowPerformanceSnapshot {
        const latest = this.history.filter(s => s.sessionId === sessionId || sessionId === 'SESSION-000').pop();
        if (!latest) {
            return this.createAndEmitSnapshot(sessionId);
        }
        return latest;
    }

    public getShadowHistory(sessionId: string = 'SESSION-000'): ReadonlyArray<ShadowPerformanceSnapshot> {
        const filtered = this.history.filter(s => s.sessionId === sessionId || sessionId === 'SESSION-000');
        return Object.freeze(filtered);
    }
}
