import { SessionLifecycleManager } from "../../../application/session-lifecycle/SessionLifecycleManager";
import { SessionLifecycleHistory } from "../../../application/session-lifecycle/SessionLifecycleHistory";
import { SessionLifecycleReportService } from "../../../application/session-lifecycle/SessionLifecycleReportService";

import { OperatorHUDBuilder } from '../../../application/operator-hud/OperatorHUDBuilder';
import { OperatorHUDReportService } from '../../../application/operator-hud/OperatorHUDReportService';
import { DecisionInteractionService } from '../../../application/operator-hud/DecisionInteractionService';
import { SuggestionHistory } from '../../../application/operator-hud/SuggestionHistory';

import { SessionAuditEngine } from '../../../application/session-audit/SessionAuditEngine';
import { SessionAuditHistory } from '../../../application/session-audit/SessionAuditHistory';
import { SessionAuditReportService } from '../../../application/session-audit/SessionAuditReportService';

import { SessionInsightHistory } from '../../../application/session-intelligence/SessionInsightHistory';
import { SessionIntelligenceEngine } from '../../../application/session-intelligence/SessionIntelligenceEngine';
import { SessionIntelligenceReportService } from '../../../application/session-intelligence/SessionIntelligenceReportService';

import { TerminalHistory } from '../../../application/terminal/TerminalHistory';
import { CommandParser } from '../../../application/terminal/CommandParser';
import { CommandDispatcher } from '../../../application/terminal/CommandDispatcher';
import { OperationalTerminal } from '../../../application/terminal/OperationalTerminal';
import { TerminalReportService } from '../../../application/terminal/TerminalReportService';

import { StartupProgress } from '../../../application/session-startup/StartupProgress';
import { StartupHistory } from '../../../application/session-startup/StartupHistory';
import { SessionStartupWizard } from '../../../application/session-startup/SessionStartupWizard';
import { SessionStartupReportService } from '../../../application/session-startup/SessionStartupReportService';

import { ConfigurationHistory } from '../../../application/configuration/ConfigurationHistory';
import { ConfigurationEngine } from '../../../application/configuration/ConfigurationEngine';
import { ConfigurationReportService } from '../../../application/configuration/ConfigurationReportService';
import { ApplicationBootstrap } from '../../../application/bootstrap/ApplicationBootstrap';
import { BootstrapReportService } from '../../../application/bootstrap/BootstrapReportService';


import { SessionControlEngine } from '../../../application/session-control/SessionControlEngine';
import { SessionHistory } from '../../../application/session-control/SessionHistory';
import { SessionReportService } from '../../../application/session-control/SessionReportService';
import { InstitutionalDecisionEngine } from "../../../application/institutional-ai/InstitutionalDecisionEngine";
import { InstitutionalDecisionReportService } from "../../../application/institutional-ai/InstitutionalDecisionReportService";
import { OperationalGate } from '../../../application/preflight/OperationalGate';
import { PreFlightContext } from '../../../application/preflight/PreFlightContext';
import { Request, Response } from 'express';
import { QuantitativeEnginePipeline } from '../../../application/runtime/QuantitativeEnginePipeline';
import { TacticalExecutionRequest } from '../../../application/runtime/dto/TacticalExecutionRequest';
import { RuntimeTelemetry } from '../../../application/runtime/RuntimeTelemetry';
import { ObservabilityEventBus } from '../../../application/runtime/observability/ObservabilityEventBus';
import { ObservableSessionManager } from '../../../application/runtime/observability/ObservableSessionManager';
import { ObservableSnapshotManager } from '../../../application/runtime/observability/ObservableSnapshotManager';
import { ObservableDecisionLedger } from '../../../application/runtime/observability/ObservableDecisionLedger';
import { ObservableHeartbeatManager } from '../../../application/runtime/observability/ObservableHeartbeatManager';
import { ObservableRecoveryPipeline } from '../../../application/runtime/observability/ObservableRecoveryPipeline';
import { StrategyPerformanceHistory } from '../../../application/adaptive/StrategyPerformanceHistory';
import { StrategyConfidenceRepository } from '../../../application/adaptive/StrategyConfidenceRepository';
import { ConfidenceSnapshotManager } from '../../../application/adaptive/ConfidenceSnapshotManager';
import { AdaptiveConfidenceEngine } from '../../../application/adaptive/AdaptiveConfidenceEngine';
import { AdaptiveLearningOrchestrator } from '../../../application/adaptive/AdaptiveLearningOrchestrator';
import { randomUUID } from 'crypto';

import { WeightedVotingEngine } from '../../../application/ensemble/WeightedVotingEngine';
import { ConsensusCalculator } from '../../../application/ensemble/ConsensusCalculator';
import { DecisionConflictAnalyzer } from '../../../application/ensemble/DecisionConflictAnalyzer';
import { EnsembleDecisionEngine } from '../../../application/ensemble/EnsembleDecisionEngine';
import { EnsembleSnapshotManager } from '../../../application/ensemble/EnsembleSnapshotManager';
import { DecisionConsensusService } from '../../../application/ensemble/DecisionConsensusService';
import { SessionPerformanceEngine } from '../../../application/performance/SessionPerformanceEngine';
import { MarketRegimeEngine } from '../../../application/regime/MarketRegimeEngine';
import { StrategyCalibrationEngine } from '../../../application/calibration/StrategyCalibrationEngine';
import { ShadowReportService } from '../../../application/shadow/ShadowReportService';
import { FeedbackReportService } from '../../../application/feedback/FeedbackReportService';
import { ReplayReportService } from '../../../application/replay/ReplayReportService';
import { KnowledgeAggregator } from '../../../application/knowledge/KnowledgeAggregator';
import { KnowledgeReportService } from '../../../application/knowledge/KnowledgeReportService';

import { InstitutionalLearningEngine } from '../../../application/learning/InstitutionalLearningEngine';
import { LearningReportService } from '../../../application/learning/LearningReportService';

import { InstitutionalEvolutionEngine } from "../../../application/evolution/InstitutionalEvolutionEngine";
import { EvolutionReportService } from "../../../application/evolution/EvolutionReportService";

import { PredictiveScenarioEngine } from "../../../application/predictive/PredictiveScenarioEngine";
import { PredictiveReportService } from "../../../application/predictive/PredictiveReportService";
import { MultiSessionIntelligenceEngine } from "../../../application/multisession/MultiSessionIntelligenceEngine";
import { MultiSessionReportService } from "../../../application/multisession/MultiSessionReportService";
import { PortfolioIntelligenceEngine } from "../../../application/portfolio/PortfolioIntelligenceEngine";
import { PortfolioReportService } from "../../../application/portfolio/PortfolioReportService";
import { StrategyEvolutionGovernanceEngine } from "../../../application/evolution-governance/StrategyEvolutionGovernanceEngine";
import { StrategyEvolutionReportService } from "../../../application/evolution-governance/StrategyEvolutionReportService";



export class RuntimeController {
    public readonly eventBus = new ObservabilityEventBus();
    public readonly sessionManager = new ObservableSessionManager(this.eventBus);
    public readonly snapshotManager = new ObservableSnapshotManager(this.eventBus);
    public readonly ledger = new ObservableDecisionLedger(this.eventBus);
    public readonly performanceEngine = new SessionPerformanceEngine(this.eventBus, this.ledger);
    public readonly regimeEngine = new MarketRegimeEngine(this.eventBus, this.ledger);
    public readonly calibrationEngine = new StrategyCalibrationEngine(this.eventBus, this.ledger);
    public readonly shadowService = new ShadowReportService(this.eventBus, this.ledger);
    public readonly feedbackService = new FeedbackReportService(this.eventBus, this.ledger);
    public readonly replayService = new ReplayReportService(this.ledger);
    public readonly knowledgeAggregator = new KnowledgeAggregator(this.eventBus, this.ledger);
    public readonly knowledgeService = new KnowledgeReportService(this.knowledgeAggregator);
    public readonly learningEngine = new InstitutionalLearningEngine(this.eventBus, this.ledger);
    public readonly learningService = new LearningReportService(this.learningEngine);
    public readonly evolutionEngine = new InstitutionalEvolutionEngine(this.eventBus, this.ledger);
    public readonly evolutionService = new EvolutionReportService(this.evolutionEngine);
    public readonly predictiveEngine = new PredictiveScenarioEngine(this.eventBus, this.ledger);
    public readonly predictiveService = new PredictiveReportService(this.predictiveEngine);
    public readonly multiSessionEngine = new MultiSessionIntelligenceEngine(this.eventBus, this.ledger);
    public readonly multiSessionService = new MultiSessionReportService(this.multiSessionEngine);
    public readonly portfolioEngine = new PortfolioIntelligenceEngine(this.eventBus, this.ledger);
    public readonly portfolioService = new PortfolioReportService(this.portfolioEngine);
    public readonly evolutionGovernanceEngine = new StrategyEvolutionGovernanceEngine(this.eventBus, this.ledger);
    public readonly evolutionGovernanceService = new StrategyEvolutionReportService(this.evolutionGovernanceEngine);
    public readonly institutionalDecisionEngine = new InstitutionalDecisionEngine(this.eventBus, this.ledger);
    public readonly institutionalDecisionService = new InstitutionalDecisionReportService(this.institutionalDecisionEngine);
    public readonly telemetry = new RuntimeTelemetry();

    public readonly sessionHistoryEngine = new SessionHistory();
    public readonly sessionLifecycleHistory = new SessionLifecycleHistory();
    public readonly sessionLifecycleManager = new SessionLifecycleManager(this.sessionLifecycleHistory, this.eventBus, this.ledger);
    public readonly sessionLifecycleReportService = new SessionLifecycleReportService(this.sessionLifecycleManager);
    public readonly sessionControlEngine = new SessionControlEngine(this.eventBus, this.ledger, this.sessionHistoryEngine, this.sessionLifecycleManager);
    public readonly sessionReportService = new SessionReportService(this.sessionControlEngine, this.sessionHistoryEngine);

    public readonly operatorHUDBuilder = new OperatorHUDBuilder(this.sessionControlEngine);
    public readonly operatorHUDReportService = new OperatorHUDReportService(this.operatorHUDBuilder);
    public readonly suggestionHistory = new SuggestionHistory();
    public readonly decisionInteractionService = new DecisionInteractionService(this.eventBus, this.suggestionHistory);

    public readonly sessionAuditHistory = new SessionAuditHistory();
    public readonly sessionAuditEngine = new SessionAuditEngine(this.eventBus, this.ledger, this.sessionAuditHistory);
    public readonly sessionAuditReportService = new SessionAuditReportService(this.sessionAuditHistory);

    public readonly sessionInsightHistory = new SessionInsightHistory();
    public readonly sessionIntelligenceEngine = new SessionIntelligenceEngine(this.eventBus, this.ledger, this.sessionAuditHistory, this.sessionInsightHistory);
    public readonly sessionIntelligenceReportService = new SessionIntelligenceReportService(this.sessionInsightHistory, this.sessionIntelligenceEngine);

    public readonly terminalHistory = new TerminalHistory();
    public readonly commandDispatcher = new CommandDispatcher(
        this.sessionControlEngine,
        this.sessionAuditReportService,
        this.sessionIntelligenceReportService,
        this.terminalHistory
    );
    public readonly operationalTerminal = new OperationalTerminal(
        CommandParser,
        this.commandDispatcher,
        this.terminalHistory,
        this.eventBus,
        this.ledger
    );
    public readonly terminalReportService = new TerminalReportService(this.terminalHistory);

    public readonly configurationHistory = new ConfigurationHistory();
    public readonly configurationEngine = new ConfigurationEngine(this.configurationHistory, this.eventBus, this.ledger);
    public readonly configurationReportService = new ConfigurationReportService(this.configurationEngine, this.configurationHistory);

    public readonly startupProgress = new StartupProgress();
    public readonly startupHistory = new StartupHistory();
    public readonly sessionStartupWizard = new SessionStartupWizard(
        this.startupProgress,
        this.startupHistory,
        this.sessionControlEngine,
        this.operationalTerminal,
        this.eventBus,
        this.ledger,
        this.configurationEngine,
        this.sessionLifecycleManager
    );
    public readonly sessionStartupReportService = new SessionStartupReportService(
        this.sessionStartupWizard,
        this.startupProgress,
        this.startupHistory
    );

    public readonly applicationBootstrap = new ApplicationBootstrap(
        this.configurationEngine,
        this.sessionControlEngine,
        this.sessionStartupWizard,
        this.sessionLifecycleManager,
        this.eventBus,
        this.ledger
    );
    public readonly bootstrapReportService = new BootstrapReportService(this.applicationBootstrap);

    constructor() {
        this.applicationBootstrap.bootstrap();
    }



    public readonly operationalGate = new OperationalGate();
    public latestVix = 0;
    public latestEntropy = 0;
    public burnInCount = 0;
    
    public readonly performanceHistory = new StrategyPerformanceHistory();
    public readonly confidenceRepo = new StrategyConfidenceRepository();
    public readonly confidenceSnapshotManager = new ConfidenceSnapshotManager(this.confidenceRepo);
    public readonly adaptiveEngine = new AdaptiveConfidenceEngine(this.ledger, this.telemetry, this.performanceHistory);
    public readonly adaptiveOrchestrator = new AdaptiveLearningOrchestrator(this.eventBus, this.adaptiveEngine, this.confidenceSnapshotManager, this.performanceHistory, this.telemetry, this.confidenceRepo);

    public readonly heartbeatManager = new ObservableHeartbeatManager(this.sessionManager, this.eventBus);
    
    public readonly votingEngine = new WeightedVotingEngine();
    public readonly consensusCalculator = new ConsensusCalculator();
    public readonly conflictAnalyzer = new DecisionConflictAnalyzer();
    public readonly ensembleDecisionEngine = new EnsembleDecisionEngine(this.votingEngine, this.consensusCalculator, this.conflictAnalyzer);
    public readonly ensembleSnapshotManager = new EnsembleSnapshotManager();
    public readonly consensusService = new DecisionConsensusService(this.ensembleDecisionEngine, this.ensembleSnapshotManager);

    public readonly recoveryPipeline = new ObservableRecoveryPipeline(
        this.sessionManager,
        this.snapshotManager,
        this.heartbeatManager,
        this.telemetry,
        this.ledger,
        this.eventBus
    );

    public readonly pipeline = new QuantitativeEnginePipeline(
        this.sessionManager,
        this.snapshotManager,
        this.ledger,
        this.telemetry
    );

    
    public getPreFlightContext(sessionId: string): PreFlightContext {
        const ensembleMetrics = this.ensembleSnapshotManager.getMetrics();
        const adaptiveMetrics = this.adaptiveEngine.getAggregateMetrics();
        const session = this.sessionManager.getSession(sessionId);
        const bankroll = session ? session.currentBankroll : 1000;
        const peak = session ? session.peakBankroll : 1000;
        const drawdown = peak > 0 && bankroll < peak ? ((peak - bankroll) / peak) * 100 : 0;
        
        return {
            operationalVix: this.latestVix || 25,
            shannonEntropy: this.latestEntropy || 0.95,
            adaptiveConfidence: adaptiveMetrics.averageConfidence || 0,
            shadowPerformance: 50, // default if not tracked fully here
            consensusRate: ensembleMetrics.consensusRate || 0,
            sessionStatus: session ? session.status : 'CREATED',
            burnInCount: this.burnInCount,
            isInCooldown: false,
            currentBankroll: bankroll,
            drawdown: drawdown,
            activeStrategies: this.performanceHistory.getAllPerformances().map(p => p.strategyId)
        };
    }

    public processRound = (req: Request, res: Response) => {
        const requestStartMs = Date.now();
        try {
            const request: TacticalExecutionRequest = req.body;
            if (!request.sessionId) {
                return res.status(400).json({ error: "sessionId is required." });
            }
            
            this.heartbeatManager.heartbeat(request.sessionId);
            
            const pipelineStartMs = Date.now();
            const result = this.pipeline.execute(request);
            this.latestVix = result.vix;
            this.burnInCount++;
            const pipelineTimeMs = Date.now() - pipelineStartMs;
            
            this.telemetry.recordLatency(pipelineTimeMs);
            
            this.eventBus.publish('DecisionExecuted', '5.0.0', randomUUID(), request.sessionId, {
                engineTimeMs: pipelineTimeMs,
                pipelineTimeMs,
                requestTimeMs: Date.now() - requestStartMs,
                decisionTimeMs: pipelineTimeMs
            });
            
            res.status(200).json(result);
        } catch (error: any) {
            console.error("Erro no RuntimeController:", error);
            this.eventBus.publish('RuntimeError', '5.0.0', randomUUID(), req.body?.sessionId, { error: error.message });
            res.status(500).json({ error: error.message || "Erro interno no Runtime." });
        }
    }

    public syncTape = (req: Request, res: Response) => {
        const requestStartMs = Date.now();
        try {
            const numbers: number[] = req.body.timeline;
            const sessionId: string = req.body.sessionId;
            if (!sessionId) {
                return res.status(400).json({ error: "sessionId is required." });
            }

            this.heartbeatManager.heartbeat(sessionId);
            
            const pipelineStartMs = Date.now();
            const result = this.pipeline.sync(sessionId, numbers);
            this.latestVix = result.vix;
            this.latestEntropy = 0.95; // Mock for now if not in result
            this.burnInCount = numbers.length;

            const ctx = this.getPreFlightContext(sessionId);
            const preFlight = this.operationalGate.executePreFlight(ctx);
            let finalResult = { ...result } as any;
            if (preFlight.status === 'REJECTED') {
                this.sessionManager.lockSession(sessionId);
                finalResult.preFlightStatus = 'REJECTED';
                finalResult.preFlightReason = 'Pre-Flight Failed: ' + preFlight.rejection?.reasons.map(r => r.description).join(' | ');
                finalResult.isLocked = true;
                finalResult.lockReason = "MESA REPROVADA NO PRE-FLIGHT";
            } else {
                finalResult.preFlightStatus = 'APPROVED';
                finalResult.preFlightReason = 'Pre-Flight Approved';
                finalResult.isLocked = false;
            }

            const pipelineTimeMs = Date.now() - pipelineStartMs;

            this.telemetry.recordLatency(pipelineTimeMs);
            
            this.eventBus.publish('DecisionExecuted', '5.0.0', randomUUID(), sessionId, {
                engineTimeMs: pipelineTimeMs,
                pipelineTimeMs,
                requestTimeMs: Date.now() - requestStartMs,
                decisionTimeMs: pipelineTimeMs
            });

            res.status(200).json(finalResult);
        } catch (error: any) {
            console.error("Erro no RuntimeController sync:", error);
            this.eventBus.publish('RuntimeError', '5.0.0', randomUUID(), req.body?.sessionId, { error: error.message });
            res.status(500).json({ error: error.message || "Erro interno no Runtime." });
        }
    }

    public getConfidence = (req: Request, res: Response) => {
        const strategyId = req.query.strategyId as string;
        if (strategyId) {
            const conf = this.adaptiveEngine.evaluateConfidence(strategyId);
            return res.status(200).json(conf);
        }
        const metrics = this.adaptiveEngine.getAggregateMetrics();
        res.status(200).json(metrics);
    }

    public getConfidenceHistory = (req: Request, res: Response) => {
        const strategyId = req.query.strategyId as string;
        const history = this.confidenceSnapshotManager.getHistory(strategyId);
        res.status(200).json(history);
    }

    public getStrategies = (req: Request, res: Response) => {
        const perfs = this.performanceHistory.getAllPerformances();
        res.status(200).json(perfs);
    }

    public getAdaptive = (req: Request, res: Response) => {
        res.status(200).json({
            engineStatus: 'ACTIVE',
            totalSnapshots: this.confidenceRepo.getCount(),
            aggregateMetrics: this.adaptiveEngine.getAggregateMetrics(),
            strategiesTracked: this.performanceHistory.getAllPerformances().length
        });
    }

    public getEnsemble = (req: Request, res: Response) => {
        res.status(200).json({
            engineStatus: 'ACTIVE',
            metrics: this.ensembleSnapshotManager.getMetrics(),
            snapshotsCount: this.ensembleSnapshotManager.getHistory().length
        });
    }

    public getEnsembleHistory = (req: Request, res: Response) => {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        res.status(200).json(this.ensembleSnapshotManager.getHistory(limit));
    }

    public getConsensus = (req: Request, res: Response) => {
        const latest = this.ensembleSnapshotManager.getLatest();
        if (!latest) return res.status(404).json({ error: 'No consensus found.' });
        res.status(200).json(latest);
    }

    public getVotes = (req: Request, res: Response) => {
        const latest = this.ensembleSnapshotManager.getLatest();
        if (!latest) return res.status(404).json({ error: 'No votes found.' });
        res.status(200).json(latest.votes);
    }

    public getConflicts = (req: Request, res: Response) => {
        const latest = this.ensembleSnapshotManager.getLatest();
        if (!latest) return res.status(404).json({ error: 'No conflicts found.' });
        res.status(200).json({
            conflictLevel: latest.conflictLevel,
            agreement: latest.agreement
        });
    }

}
