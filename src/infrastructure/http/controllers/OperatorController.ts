import { StrategyRecommendationEngine } from '../../../application/recommendation/StrategyRecommendationEngine';
import { OperatorWorkflowService } from '../../../application/operator/OperatorWorkflowService';
import { STRATEGY_ZONES } from '../../../application/runtime/QuantitativeEnginePipeline';
import { Request, Response } from 'express';
import { RuntimeController } from './RuntimeController';
import { OperatorConsoleDTO } from '../../../application/operator/dto/OperatorConsoleDTO';
import { SessionDTO } from '../../../application/operator/dto/SessionDTO';
import { RuntimeStatusDTO } from '../../../application/operator/dto/RuntimeStatusDTO';
import { BankrollDTO } from '../../../application/operator/dto/BankrollDTO';
import { StrategyDTO } from '../../../application/operator/dto/StrategyDTO';
import { ConsensusDTO } from '../../../application/operator/dto/ConsensusDTO';
import { ExplainabilityDTO } from '../../../application/operator/dto/ExplainabilityDTO';

export class OperatorController {
    private readonly recommendationEngine = new StrategyRecommendationEngine();
    public readonly workflowService: OperatorWorkflowService;
    private pendingConfirmedBets = new Map<string, { strategy: string; stake: number; suggestionId?: string }>();

    constructor(private readonly runtime: RuntimeController) {
        this.workflowService = new OperatorWorkflowService(runtime);
    }

    private getSessionDTO(sessionId = 'SESSION-000'): SessionDTO {
        const loop = this.workflowService.getSessionLoop(sessionId);
        return {
            sessionId,
            status: loop.getState() as any,
            heartbeatStatus: 'ALIVE',
            executionTimeMs: loop.getUptimeSeconds() * 1000,
            lastSnapshotTimeUtc: new Date().toISOString(),
            lastDecisionTimeUtc: new Date().toISOString()
        };
    }

    private getRuntimeStatusDTO(sessionId = 'SESSION-000'): RuntimeStatusDTO {
        const ensembleMetrics = this.runtime.ensembleSnapshotManager.getMetrics();
        const adaptiveMetrics = this.runtime.adaptiveEngine.getAggregateMetrics();
        const stats = this.workflowService.getStatistics(sessionId);

        return {
            status: stats.totalBlocks > 0 ? 'REJECTED' : 'APPROVED',
            reason: null,
            paperTrading: true,
            operationalVix: stats.averageVix || this.runtime.latestVix || 25.5,
            shannonEntropy: stats.averageEntropy || this.runtime.latestEntropy || 0.95,
            burnIn: this.runtime.burnInCount,
            adaptiveConfidence: adaptiveMetrics.averageConfidence || 0,
            shadowPerformance: stats.hitRate,
            consensusRate: stats.averageConsensus || ensembleMetrics.consensusRate || 0,
            riskLevel: stats.drawdown > 10 ? 'HIGH' : stats.drawdown > 5 ? 'MEDIUM' : 'LOW'
        };
    }

    private getBankrollDTO(sessionId = 'SESSION-000'): BankrollDTO {
        const session = this.runtime.sessionManager.getSession(sessionId);
        const stats = this.workflowService.getStatistics(sessionId);
        const currentBankroll = session ? session.currentBankroll : stats.currentBankroll || 1000;
        const initialBankroll = 1000;
        const profit = currentBankroll - initialBankroll;

        return {
            initialBankroll,
            currentBankroll,
            drawdown: stats.drawdown,
            profit,
            stopLoss: initialBankroll * 0.85,
            takeProfit: initialBankroll * 1.25,
            suggestedStake: stats.averageStake || 10,
            maxAllowedStake: currentBankroll * 0.05
        };
    }

    private getStrategiesDTO(): StrategyDTO[] {
        const performances = this.runtime.performanceHistory.getAllPerformances();
        return performances.map((p, index) => ({
            strategyId: p.strategyId,
            name: p.strategyId,
            status: 'ENABLED',
            confidence: this.runtime.adaptiveEngine.evaluateConfidence(p.strategyId).score.value,
            shadowWeight: 1.0,
            ranking: index + 1,
            lastResult: p.totalExecutions > 0 ? (p.wins / p.totalExecutions > 0.5 ? 'WIN' : 'LOSS') : 'PENDING'
        }));
    }

    private getConsensusDTO(): ConsensusDTO {
        const latest = this.runtime.ensembleSnapshotManager.getLatest();
        if (!latest) {
            return {
                level: 'NONE',
                agreementScore: 0,
                conflictLevel: 'NONE',
                dominantStrategy: null,
                confidenceScore: 0,
                votes: []
            };
        }

        return {
            level: latest.score.level,
            agreementScore: latest.agreement.score,
            conflictLevel: latest.conflictLevel,
            dominantStrategy: latest.dominantStrategy?.strategyId || null,
            confidenceScore: latest.dominantStrategy?.confidence || 0,
            votes: latest.votes.map(v => ({
                modelId: v.modelId,
                suggestedStrategy: v.suggestedStrategy,
                confidence: v.confidence,
                weight: v.weight
            }))
        };
    }

    private getExplainabilityDTO(): ExplainabilityDTO {
        return {
            reasons: [
                'Markov ↑',
                'Entropy ↑',
                'Adaptive ↑',
                'Shadow ↑',
                'Consensus STRONG',
                'Risk OK'
            ],
            summary: 'Decision aligned with ensemble majority and passed risk constraints.'
        };
    }

    public getOperatorConsole = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const dto: OperatorConsoleDTO = {
            session: this.getSessionDTO(sessionId),
            runtimeStatus: this.getRuntimeStatusDTO(sessionId),
            bankroll: this.getBankrollDTO(sessionId),
            strategies: this.getStrategiesDTO(),
            consensus: this.getConsensusDTO(),
            explainability: this.getExplainabilityDTO()
        };
        res.status(200).json(dto);
    }

    
    
    public getHUDCurrent = (req: Request, res: Response) => {
        // We'll update the snapshot with the latest suggestion from runtime if available.
        // For simplicity, we just get the latest built snapshot, but it should contain suggestion.
        const snapshot = this.runtime.operatorHUDReportService.getCurrentSnapshot();
        res.status(200).json(snapshot);
    }

    public processLiveSpin = async (req: Request, res: Response) => {
        try {
            const spinValue = req.body.result ?? req.body.spin ?? req.body.value;
            const sessionId = (req.body.sessionId as string) || (req.query.sessionId as string) || 'SESSION-000';

            if (spinValue === undefined || spinValue === null || isNaN(Number(spinValue))) {
                return res.status(400).json({ error: 'spin result is required and must be a number' });
            }

            const numResult = Number(spinValue);
            if (numResult < 0 || numResult > 36) {
                return res.status(400).json({ error: 'spin result must be between 0 and 36' });
            }

            // 1. AUTO-RESOLUÇÃO DE WIN/LOSS ANTES DE RECALCULAR O MOTOR
            const lastSnapshot = this.runtime.operatorHUDReportService.getCurrentSnapshot();
            const pendingBet = this.pendingConfirmedBets.get(sessionId);

            const stratToResolve = pendingBet?.strategy || lastSnapshot?.data?.strategySuggestion;
            const stakeToResolve = pendingBet?.stake ?? lastSnapshot?.data?.stakeValue ?? 0;

            if (stratToResolve && stakeToResolve > 0) {
                const isWin = STRATEGY_ZONES[stratToResolve]?.includes(numResult) ?? false;
                let payoutFactor = 1.0;
                if (stratToResolve.startsWith('CROSS_')) payoutFactor = 8.0;
                else if (stratToResolve === 'ZONE_TIERS' || stratToResolve === 'ZONE_ORPHELINS') payoutFactor = 2.0;
                else if (stratToResolve === 'SECTOR_ZERO_GAME' || stratToResolve === 'SECTOR_POTINHO') payoutFactor = 2.5;

                const profit = isWin ? stakeToResolve * payoutFactor : -stakeToResolve;
                this.runtime.sessionControlEngine.reportShadowTradeResult(profit);

                const updatedState = this.runtime.sessionControlEngine.getCurrentState();
                if (updatedState.bankroll) {
                    const session = this.runtime.sessionManager.getSession(sessionId);
                    if (session) {
                        this.runtime.sessionManager.updateSession(sessionId, {
                            currentBankroll: updatedState.bankroll.current
                        });
                    }
                }

                this.pendingConfirmedBets.delete(sessionId);
            }

            // 2. EXECUTAR MOTOR QUANTITATIVO PARA O PRÓXIMO GIRO
            const spinResult = await this.workflowService.handleCommand(`spin ${numResult}`, sessionId);

            const vix = spinResult?.pipelineResult?.vix ?? this.runtime.latestVix ?? 25.5;
            const recommendation = spinResult?.recommendation;

            let oracleMessage = "Analisando padrões da mesa...";
            if (vix > 80) {
                oracleMessage = "⚠️ ALERTA: VIX Crítico. Risco de Caos na Mesa.";
            } else if (recommendation && recommendation.isOpportunity && recommendation.strategy) {
                oracleMessage = "🎯 Convergência detectada. Preparar entrada.";
            }

            // 3. CORREÇÃO DA TIMELINE: Concatena o histórico e reverte para que o giro mais recente fique no índice [0]
            const recentTimeline = this.workflowService.getTimeline(sessionId);
            const sessionSpins = recentTimeline.map(t => t.drawnNumber);
            const pipelineTimeline = spinResult?.pipelineResult?.newTimeline || [];
            
            const allSpinsChronological = pipelineTimeline.length > 0 ? [...pipelineTimeline] : [...sessionSpins];
            if (allSpinsChronological.length === 0) {
                allSpinsChronological.push(numResult);
            }
            
            // Reverter para que o giro mais recente fique na extremidade esquerda (índice 0)
            const recentSpinsReversed = [...allSpinsChronological].reverse().slice(0, 20);

            const suggestion = (recommendation && recommendation.isOpportunity) ? recommendation.strategy : null;
            const confidence = (recommendation && recommendation.isOpportunity) ? (recommendation.confidence > 0.7 ? 'ALTA' : 'MÉDIA') : null;
            const stakeValue = (recommendation && recommendation.isOpportunity) ? recommendation.stake : 0;
            const xaiExplanation = recommendation?.explanation || (suggestion 
                ? `Alvo ${suggestion} selecionado por convergência quantitativa (VIX ${vix.toFixed(1)}%).` 
                : "Aguardando sinal quantitativo de alta confiança.");

            const realStrategies = ['ZONE_TIERS', 'ZONE_VOISINS', 'ZONE_ORPHELINS', 'SECTOR_ZERO_GAME', 'SECTOR_POTINHO', 'CROSS_TERMINAL_7', 'CROSS_TERMINAL_9', 'FUSION_REDUZIDA'];
            const shadowPnLObj = spinResult?.pipelineResult?.shadowPnL || {};
            const shadowWeightsObj = spinResult?.pipelineResult?.shadowWeights || {};

            const strategyWeightsOverride = realStrategies.map(strat => {
                const rawWeight = shadowWeightsObj[strat] ?? 1.0;
                const pnl = shadowPnLObj[strat] ?? 0;
                const isSelected = suggestion === strat;
                const isAvailable = ['ZONE_TIERS', 'ZONE_VOISINS', 'ZONE_ORPHELINS', 'SECTOR_ZERO_GAME', 'SECTOR_POTINHO'].includes(strat);
                return {
                    name: strat,
                    status: (isSelected || isAvailable) ? ('ON' as const) : ('OFF' as const),
                    shadowPnl: pnl,
                    weight: Math.round(rawWeight * 25)
                };
            });

            this.runtime.operatorHUDReportService.updateSnapshot(
                suggestion,
                confidence,
                stakeValue,
                0.10,
                suggestion,
                oracleMessage,
                recentSpinsReversed,
                xaiExplanation,
                strategyWeightsOverride
            );

            const updatedSnapshot = this.runtime.operatorHUDReportService.getCurrentSnapshot();

            res.status(200).json({
                success: true,
                spinResult,
                hudSnapshot: updatedSnapshot
            });
        } catch (error: any) {
            console.error('Error processing live spin:', error);
            res.status(400).json({ error: error.message || 'Error processing live spin' });
        }
    }

    public confirmSuggestionAction = (req: Request, res: Response) => {
        const { sessionId, roundId, strategy, stake, suggestionId } = req.body;
        const targetSessionId = sessionId || 'SESSION-000';
        this.runtime.decisionInteractionService.confirmSuggestion(targetSessionId, roundId, strategy, stake, suggestionId);
        
        if (strategy && stake) {
            this.pendingConfirmedBets.set(targetSessionId, {
                strategy,
                stake: Number(stake) || 0,
                suggestionId
            });
        }

        res.status(200).json({ success: true });
    }

    public skipSuggestionAction = (req: Request, res: Response) => {
        const { sessionId, roundId, strategy, stake, suggestionId } = req.body;
        this.runtime.decisionInteractionService.skipSuggestion(sessionId, roundId, strategy, stake, suggestionId);
        res.status(200).json({ success: true });
    }

    public getSessionCurrent = (req: Request, res: Response) => {
        const state = this.runtime.sessionReportService.getCurrentSessionState();
        res.status(200).json(state);
    }

    public getSessionHistoryAPI = (req: Request, res: Response) => {
        const history = this.runtime.sessionReportService.getSessionHistory();
        res.status(200).json(history);
    }

    public startSession = (req: Request, res: Response) => {
        const { initialBankroll = 1000, provider = 'Pragmatic', minimumChipValue = 0.1 } = req.body || {};
        this.runtime.sessionControlEngine.startSession(initialBankroll, { provider, minimumChipValue });
        res.status(200).json({ success: true, state: this.runtime.sessionControlEngine.getCurrentState() });
    }

    public confirmSuggestion = (req: Request, res: Response) => {
        this.runtime.sessionControlEngine.confirmSuggestion();
        res.status(200).json({ success: true });
    }

    public skipSuggestion = (req: Request, res: Response) => {
        this.runtime.sessionControlEngine.skipSuggestion();
        res.status(200).json({ success: true });
    }

    public finishSession = (req: Request, res: Response) => {
        this.runtime.sessionControlEngine.finishSession('MANUAL');
        res.status(200).json({ success: true, state: this.runtime.sessionControlEngine.getCurrentState() });
    }

    public getSession = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        res.status(200).json(this.getSessionDTO(sessionId));
    }

    public getPreflight = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const ctx = this.runtime.getPreFlightContext(sessionId);
        const result = this.runtime.operationalGate.executePreFlight(ctx);
        const consensus = this.getConsensusDTO();

        res.status(200).json({
            status: result.status,
            reasons: result.rejection ? result.rejection.reasons : [],
            operationalReadiness: result.readiness,
            eligibleStrategies: result.approval ? result.approval.eligibleStrategies : [],
            approvedStake: result.approval ? result.approval.approvedStake : 0,
            consensus: consensus,
            confidence: result.approval ? result.approval.confidence : 0
        });
    }

    public getBankroll = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        res.status(200).json(this.getBankrollDTO(sessionId));
    }

    public getStrategies = (req: Request, res: Response) => {
        res.status(200).json(this.getStrategiesDTO());
    }

    public getEnsemble = (req: Request, res: Response) => {
        res.status(200).json(this.getConsensusDTO());
    }

    public getExplainability = (req: Request, res: Response) => {
        res.status(200).json(this.getExplainabilityDTO());
    }

    public getTimeline = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const timeline = this.workflowService.getTimeline(sessionId);
        res.status(200).json(timeline);
    }

    public getStatistics = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const stats = this.workflowService.getStatistics(sessionId);
        res.status(200).json(stats);
    }

    public getHistory = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const history = this.workflowService.getHistory(sessionId);
        res.status(200).json(history);
    }

    public getPerformance = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const snapshot = this.runtime.performanceEngine.getLatestSnapshot(sessionId);
        res.status(200).json(snapshot);
    }

    public getPerformanceHistory = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const history = this.runtime.performanceEngine.getSnapshotHistory(sessionId);
        res.status(200).json(history);
    }

    public getSessionHealth = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const health = this.runtime.performanceEngine.getSessionHealth(sessionId);
        res.status(200).json(health);
    }

    public getRegime = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const snapshot = this.runtime.regimeEngine.getLatestSnapshot(sessionId);
        res.status(200).json(snapshot);
    }

    public getRegimeHistory = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const history = this.runtime.regimeEngine.getSnapshotHistory(sessionId);
        res.status(200).json(history);
    }

    public getRegimeCurrent = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const current = this.runtime.regimeEngine.getCurrentRegimeInfo(sessionId);
        res.status(200).json(current);
    }

    public getCalibration = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const snapshot = this.runtime.calibrationEngine.getLatestSnapshot(sessionId);
        res.status(200).json(snapshot);
    }

    public getCalibrationHistory = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const history = this.runtime.calibrationEngine.getCalibrationHistory(sessionId);
        res.status(200).json(history);
    }

    public getStrategyWeights = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const weights = this.runtime.calibrationEngine.getStrategyWeights(sessionId);
        res.status(200).json(weights);
    }

    public getShadowPerformance = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const perf = this.runtime.shadowService.getShadowPerformance(sessionId);
        res.status(200).json(perf);
    }

    public getShadowHistory = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const history = this.runtime.shadowService.getShadowHistory(sessionId);
        res.status(200).json(history);
    }

    public getFeedback = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const summary = this.runtime.feedbackService.getFeedbackSummary(sessionId);
        res.status(200).json(summary);
    }

    public getFeedbackHistory = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const history = this.runtime.feedbackService.getFeedbackHistory(sessionId);
        res.status(200).json(history);
    }

    public getReplay = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const history = this.runtime.replayService.getReplayHistory(sessionId);
        const latest = history.length > 0 ? history[history.length - 1] : null;
        if (latest) {
            res.status(200).json(latest);
        } else {
            res.status(404).json({ error: 'No replay found' });
        }
    }

    public getReplayHistory = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const history = this.runtime.replayService.getReplayHistory(sessionId);
        res.status(200).json(history);
    }

    public getReplayByDecision = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const decisionId = req.params.decisionId;
        const replay = this.runtime.replayService.getReplay(decisionId, sessionId);
        if (replay) {
            res.status(200).json(replay);
        } else {
            res.status(404).json({ error: 'Decision not found' });
        }
    }

    public getKnowledge = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const stats = this.runtime.knowledgeService.getKnowledgeStatistics(sessionId);
        res.status(200).json(stats);
    }

    public getKnowledgePatterns = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const patterns = this.runtime.knowledgeService.getKnowledgePatterns(sessionId);
        res.status(200).json(patterns);
    }

    public getKnowledgeStatistics = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const stats = this.runtime.knowledgeService.getKnowledgeStatistics(sessionId);
        res.status(200).json(stats);
    }

    public getLearning = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const snapshot = this.runtime.learningService.getLearningSnapshot(sessionId);
        res.status(200).json(snapshot);
    }

    public getPredictiveScenario = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || "SESSION-000";
        const snapshot = this.runtime.predictiveService.getPredictiveScenario(sessionId);
        res.status(200).json(snapshot);
    }

    public getPredictiveHistory = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || "SESSION-000";
        const history = this.runtime.predictiveService.getPredictiveHistory(sessionId);
        res.status(200).json(history);
    }

    public getPortfolio = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || "SESSION-000";
        const snapshot = this.runtime.portfolioService.getPortfolioSnapshot(sessionId);
        res.status(200).json(snapshot);
    }


    public getPortfolioHistory = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || "SESSION-000";
        const history = this.runtime.portfolioService.getPortfolioHistory(sessionId);
        res.status(200).json(history);
    }

    public getMultiSession = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || "SESSION-000";
        const snapshot = this.runtime.multiSessionService.getMultiSession(sessionId);
        res.status(200).json(snapshot);
    }

    public getMultiSessionHistory = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || "SESSION-000";
        const history = this.runtime.multiSessionService.getMultiSessionHistory(sessionId);
        res.status(200).json(history);
    }

    public getEvolution = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || "SESSION-000";
        const snapshot = this.runtime.evolutionService.getEvolutionSnapshot(sessionId);
        res.status(200).json(snapshot);
    }

    public getEvolutionHistory = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || "SESSION-000";
        const history = this.runtime.evolutionService.getEvolutionHistory(sessionId);
        res.status(200).json(history);
    }

    public getStrategyEvolution = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || "SESSION-000";
        const snapshot = this.runtime.evolutionGovernanceService.getStrategyEvolution(sessionId);
        res.status(200).json(snapshot);
    }

    public getStrategyEvolutionHistory = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || "SESSION-000";
        const history = this.runtime.evolutionGovernanceService.getStrategyEvolutionHistory(sessionId);
        res.status(200).json(history);
    }

    public getLearningHistory = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || 'SESSION-000';
        const history = this.runtime.learningService.getLearningHistory(sessionId);
        res.status(200).json(history);
    }

    public executeCommand = async (req: Request, res: Response) => {
        try {
            const { command, sessionId } = req.body;
            if (!command) return res.status(400).json({ error: 'Command is required' });
            
            const sId = sessionId || 'SESSION-000';
            const result = await this.workflowService.handleCommand(command, sId);
            res.status(200).json(result);
        } catch (e: any) {
            res.status(400).json({ error: e.message });
        }
    }

    public getInstitutionalDecision = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || "SESSION-000";
        const snapshot = this.runtime.institutionalDecisionService.getInstitutionalDecision(sessionId);
        res.status(200).json(snapshot);
    }

    public getInstitutionalDecisionHistory = (req: Request, res: Response) => {
        const sessionId = (req.query.sessionId as string) || "SESSION-000";
        const history = this.runtime.institutionalDecisionService.getInstitutionalDecisionHistory(sessionId);
        res.status(200).json(history);
    }

    public getSessionAuditHistory = (_req: Request, res: Response) => {
        const history = this.runtime.sessionAuditReportService.getSessionHistory();
        res.status(200).json(history);
    }

    public getSessionAuditPerformance = (_req: Request, res: Response) => {
        const report = this.runtime.sessionAuditReportService.getPerformanceReport();
        res.status(200).json(report);
    }

    public createSessionAudit = (req: Request, res: Response) => {
        try {
            const snapshot = this.runtime.sessionAuditEngine.auditSession(req.body);
            res.status(201).json(snapshot);
        } catch (e: any) {
            res.status(400).json({ error: e.message });
        }
    }

    public getSessionIntelligenceProfile = (_req: Request, res: Response) => {
        const latest = this.runtime.sessionIntelligenceReportService.getLatestIntelligence();
        res.status(200).json(latest.data.operatorProfile);
    }

    public getSessionIntelligenceInsights = (_req: Request, res: Response) => {
        const latest = this.runtime.sessionIntelligenceReportService.getLatestIntelligence();
        res.status(200).json({
            insights: latest.data.insights,
            history: this.runtime.sessionIntelligenceReportService.getInsightHistory()
        });
    }

    public getSessionIntelligenceTrend = (_req: Request, res: Response) => {
        const trend = this.runtime.sessionIntelligenceReportService.getTrendAnalysis();
        res.status(200).json(trend);
    }

    public executeTerminalCommand = async (req: Request, res: Response) => {
        const { command } = req.body;
        const result = await this.runtime.operationalTerminal.executeCommand(command || '');
        res.status(200).json(result);
    }

    public getTerminalHistory = (_req: Request, res: Response) => {
        const history = this.runtime.terminalReportService.getCommandHistory();
        res.status(200).json(history);
    }

    public getTerminalCommands = (_req: Request, res: Response) => {
        const commands = this.runtime.terminalReportService.getAvailableCommands();
        const summary = this.runtime.terminalReportService.getTerminalStatusSummary();
        res.status(200).json({ commands, summary });
    }

    public getStartupStatus = (_req: Request, res: Response) => {
        const status = this.runtime.sessionStartupReportService.getStartupStatus();
        res.status(200).json(status);
    }

    public getStartupHistory = (_req: Request, res: Response) => {
        const history = this.runtime.sessionStartupReportService.getStartupHistory();
        res.status(200).json(history);
    }

    public startStartupFlow = (_req: Request, res: Response) => {
        const state = this.runtime.sessionStartupWizard.startFlow();
        res.status(200).json({ state, status: this.runtime.sessionStartupReportService.getStartupStatus() });
    }

    public selectStartupTable = (req: Request, res: Response) => {
        const { provider } = req.body;
        try {
            const config = this.runtime.sessionStartupWizard.selectTable(provider);
            res.status(200).json({ config, status: this.runtime.sessionStartupReportService.getStartupStatus() });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    public configureStartupBankroll = (req: Request, res: Response) => {
        const { amount, provider } = req.body;
        try {
            const numericAmount = Number(amount);
            if (isNaN(numericAmount) || numericAmount <= 0) {
                throw new Error("Banca inicial deve ser maior que zero.");
            }
            if (provider) {
                const provName = provider === 'EVOLUTION' ? 'Evolution' : 'Pragmatic';
                this.runtime.sessionStartupWizard.selectTable(provName);
            }
            this.runtime.sessionStartupWizard.configureBankroll(numericAmount);
            const status = this.runtime.sessionStartupReportService.getStartupStatus();
            res.status(200).json({ success: true, status });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error?.message || "Erro interno ao configurar banca." });
        }
    }

    public executeStartupSync = async (req: Request, res: Response) => {
        const { numbers } = req.body;
        const success = await this.runtime.sessionStartupWizard.executeSync(numbers || []);
        res.status(200).json({ success, status: this.runtime.sessionStartupReportService.getStartupStatus() });
    }

    public executeStartupWarmup = async (_req: Request, res: Response) => {
        const success = await this.runtime.sessionStartupWizard.executeWarmup();
        res.status(200).json({ success, status: this.runtime.sessionStartupReportService.getStartupStatus() });
    }

    public finishStartup = (_req: Request, res: Response) => {
        try {
            if (this.runtime.sessionStartupWizard) {
                const status = this.runtime.sessionStartupReportService.getStartupStatus();
                if (status.tableProvider && status.bankroll !== null && status.bankroll > 0) {
                    this.runtime.sessionStartupWizard.ensureAllStepsCompleted();
                }
            }
            const success = this.runtime.sessionStartupWizard.validateAndFinish();
            
            const status = this.runtime.sessionStartupReportService.getStartupStatus();
            const bankroll = (status.bankroll && status.bankroll > 0) ? status.bankroll : 1000;
            const provider = (status.tableProvider === 'EVOLUTION' ? 'Evolution' : status.tableProvider || 'Pragmatic') as 'Pragmatic' | 'Evolution';
            const minimumChipValue = 0.10;

            if (this.runtime.sessionLifecycleManager) {
                if (!this.runtime.sessionLifecycleManager.existsActiveSession()) {
                    if (this.runtime.sessionLifecycleManager.getCurrentState() === 'NONE') {
                        const sessionId = `SESS-${Date.now()}`;
                        this.runtime.sessionLifecycleManager.createSession(sessionId);
                    }
                    this.runtime.sessionLifecycleManager.startSession();
                }
            }

            if (this.runtime.sessionControlEngine) {
                this.runtime.sessionControlEngine.startSession(bankroll, { provider, minimumChipValue });
            }

            if (this.runtime.operatorHUDReportService) {
                this.runtime.operatorHUDReportService.updateSnapshot();
            }

            res.status(200).json({ success, status: this.runtime.sessionStartupReportService.getStartupStatus() });
        } catch (error: any) {
            res.status(400).json({
                success: false,
                error: error?.message || 'Erro ao finalizar inicialização da sessão.',
                status: this.runtime.sessionStartupReportService.getStartupStatus()
            });
        }
    }

    public resetStartup = (_req: Request, res: Response) => {
        if (this.runtime.sessionLifecycleManager.existsActiveSession()) {
            this.runtime.sessionLifecycleManager.finishSession('NEW_SESSION_REQUESTED');
            this.runtime.sessionLifecycleManager.archiveSession();
        }
        this.runtime.sessionLifecycleManager.clearRuntime();
        this.runtime.sessionStartupWizard.reset();
        res.status(200).json({ status: this.runtime.sessionStartupReportService.getStartupStatus() });
    }

    public resumeSession = (_req: Request, res: Response) => {
        if (this.runtime.sessionLifecycleManager.getCurrentState() !== 'ACTIVE') {
            this.runtime.sessionLifecycleManager.resumeSession();
        }
        res.status(200).json({ success: true });
    }

    public getConfiguration = (_req: Request, res: Response) => {
        const config = this.runtime.configurationReportService.getCurrentConfiguration();
        res.status(200).json(config);
    }

    public getConfigurationHistory = (_req: Request, res: Response) => {
        const history = this.runtime.configurationReportService.getConfigurationHistory();
        res.status(200).json(history);
    }

    public updateConfiguration = (req: Request, res: Response) => {
        try {
            const updated = this.runtime.configurationEngine.updateConfiguration(req.body);
            res.status(200).json(updated);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    public applyConfiguration = (req: Request, res: Response) => {
        try {
            const updated = this.runtime.configurationEngine.applyConfiguration(req.body);
            res.status(200).json(updated);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    public updateProvider = (req: Request, res: Response) => {
        try {
            const { provider } = req.body;
            if (!provider) {
                return res.status(400).json({ error: 'Provedor é obrigatório' });
            }
            const updated = this.runtime.configurationEngine.setProvider(provider);
            res.status(200).json(updated);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    public updateBankroll = (req: Request, res: Response) => {
        try {
            const { defaultBankroll, amount } = req.body;
            const bankrollVal = defaultBankroll ?? amount;
            if (bankrollVal === undefined || bankrollVal === null || typeof bankrollVal !== 'number' || bankrollVal <= 0) {
                return res.status(400).json({ error: 'Banca inicial deve ser um número maior que zero' });
            }
            const updated = this.runtime.configurationEngine.setBankroll(bankrollVal);
            this.runtime.applicationBootstrap.syncRuntime();
            res.status(200).json(updated);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    public getBootstrapStatus = (_req: Request, res: Response) => {
        const report = this.runtime.bootstrapReportService.getReport();
        res.status(200).json(report);
    }

    public getRuntimeConfiguration = (_req: Request, res: Response) => {
        let state = this.runtime.applicationBootstrap.getCurrentState();
        if (!state) {
            state = this.runtime.applicationBootstrap.bootstrap();
        }
        res.status(200).json(state.toJSON());
    }

    public syncRuntimeConfiguration = (_req: Request, res: Response) => {
        const state = this.runtime.applicationBootstrap.syncRuntime();
        res.status(200).json(state.toJSON());
    }
}
