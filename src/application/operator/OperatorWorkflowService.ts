import { OperatorCommandParser, OperatorCommandType } from './OperatorCommandParser';
import { TapeParser } from './TapeParser';
import { RuntimeController } from '../../infrastructure/http/controllers/RuntimeController';
import { LiveSessionLoop, LiveSessionState } from './LiveSessionLoop';
import { SessionTimeline, SessionTimelineEntryDTO } from './SessionTimeline';
import { SessionStatistics, SessionStatisticsDTO } from './SessionStatistics';
import { RecommendationHistory, RecommendationHistoryItemDTO } from './RecommendationHistory';
import { StrategyRecommendationEngine } from '../recommendation/StrategyRecommendationEngine';
import { OperationalDecisionDTO } from '../recommendation/dto/OperationalDecisionDTO';
import { randomUUID } from 'crypto';

export class OperatorSessionContainer {
    public readonly loop: LiveSessionLoop;
    public readonly timeline: SessionTimeline;
    public readonly statistics: SessionStatistics;
    public readonly history: RecommendationHistory;

    constructor(public readonly sessionId: string, initialBankroll = 1000) {
        this.loop = new LiveSessionLoop(sessionId);
        this.timeline = new SessionTimeline();
        this.statistics = new SessionStatistics(initialBankroll);
        this.history = new RecommendationHistory();
    }
}

export class OperatorWorkflowService {
    private readonly recommendationEngine = new StrategyRecommendationEngine();
    private readonly sessions = new Map<string, OperatorSessionContainer>();

    constructor(private readonly runtime: RuntimeController) {}

    public getSessionContainer(sessionId: string): OperatorSessionContainer {
        let container = this.sessions.get(sessionId);
        if (!container) {
            const session = this.runtime.sessionManager.getSession(sessionId);
            const initialBankroll = session ? session.currentBankroll : 1000;
            container = new OperatorSessionContainer(sessionId, initialBankroll);
            this.sessions.set(sessionId, container);
        }
        return container;
    }

    public getTimeline(sessionId: string): SessionTimelineEntryDTO[] {
        return this.getSessionContainer(sessionId).timeline.getEntries();
    }

    public getStatistics(sessionId: string): SessionStatisticsDTO {
        return this.getSessionContainer(sessionId).statistics.getStatistics();
    }

    public getHistory(sessionId: string): RecommendationHistoryItemDTO[] {
        return this.getSessionContainer(sessionId).history.getHistory();
    }

    public getSessionLoop(sessionId: string): LiveSessionLoop {
        return this.getSessionContainer(sessionId).loop;
    }

    public async handleCommand(input: string, sessionId: string): Promise<any> {
        const command = OperatorCommandParser.parse(input);

        switch (command.type) {
            case OperatorCommandType.SYNC:
                return this.handleSync(command.payload, sessionId);
            case OperatorCommandType.SPIN:
                return this.handleSpin(command.payload, sessionId);
            case OperatorCommandType.STATUS:
                return this.handleStatus(sessionId);
            case OperatorCommandType.END_SESSION:
                return this.handleEndSession(sessionId);
            default:
                throw new Error(`Command ${command.type} not recognized or supported.`);
        }
    }

    private async handleSync(payload: string, sessionId: string): Promise<any> {
        const timeline = TapeParser.parse(payload);
        if (timeline.length < 100) {
            throw new Error(`Sync incompleto: A fita deve conter no mínimo 100 giros (Burn-In + PreFlight context). Fornecidos: ${timeline.length}`);
        }

        const container = this.getSessionContainer(sessionId);
        container.loop.startSync();

        let session = this.runtime.sessionManager.getSession(sessionId);
        if (!session) {
            session = this.runtime.sessionManager.createSession(sessionId, 1000, 'EVOLUTION');
        }

        const syncResult = this.runtime.pipeline.sync(sessionId, [...timeline]);

        this.runtime.latestVix = syncResult.vix;
        this.runtime.latestEntropy = 0.95;
        this.runtime.burnInCount = timeline.length;

        const ctx = this.runtime.getPreFlightContext(sessionId);
        const preFlight = this.runtime.operationalGate.executePreFlight(ctx);

        const isApproved = preFlight.status === 'APPROVED';
        container.loop.completePreflight(isApproved, isApproved ? undefined : preFlight.rejection?.reasons.map(r => r.description).join(' | '));

        if (!isApproved) {
            this.runtime.sessionManager.lockSession(sessionId);
        } else {
            this.runtime.sessionManager.updateSession(sessionId, { status: 'READY' as any });
        }

        // Ledger Event Registrations
        this.runtime.ledger.append(sessionId, '5.0.0', 'SPIN_RECEIVED', `Synced tape with ${timeline.length} spins`);
        if (isApproved) {
            this.runtime.ledger.append(sessionId, '5.0.0', 'RECOMMENDATION', 'PREFLIGHT_APPROVED - Mesa Pronta para Operação Live');
        } else {
            this.runtime.ledger.append(sessionId, '5.0.0', 'BLOCK', `PREFLIGHT_REJECTED - ${preFlight.rejection?.reasons.map(r => r.description).join(' | ')}`);
        }

        // Event Bus Notifications
        this.runtime.eventBus.publish('SPIN_RECEIVED', '5.0.0', randomUUID(), sessionId, {
            type: 'TAPE_SYNC',
            count: timeline.length
        });

        this.runtime.eventBus.publish('ROUND_PROCESSED', '5.0.0', randomUUID(), sessionId, {
            type: 'TAPE_SYNC_PROCESSED',
            preFlightStatus: preFlight.status
        });

        this.runtime.eventBus.publish('SESSION_UPDATED', '5.0.0', randomUUID(), sessionId, {
            status: container.loop.getState(),
            preFlightStatus: preFlight.status
        });

        if (!isApproved) {
            this.runtime.eventBus.publish('SESSION_LOCKED', '5.0.0', randomUUID(), sessionId, {
                reasons: preFlight.rejection?.reasons || []
            });
        }

        return {
            sessionStatus: container.loop.getState(),
            preFlightStatus: preFlight.status,
            timelineLength: timeline.length,
            reasons: preFlight.rejection?.reasons || [],
            vix: syncResult.vix
        };
    }

    private async handleSpin(payload: string, sessionId: string): Promise<any> {
        const startMs = Date.now();
        const num = parseInt(payload, 10);
        if (isNaN(num) || num < 0 || num > 36) {
            throw new Error(`Invalid spin number: ${payload}`);
        }

        const container = this.getSessionContainer(sessionId);
        const currentState = container.loop.getState();

        if (currentState === 'LOCKED') {
            throw new Error(`Session is LOCKED. Cannot process live spin.`);
        }
        if (currentState === 'FINISHED') {
            throw new Error(`Session is FINISHED. Cannot process live spin.`);
        }
        if (currentState === 'NOT_INITIALIZED') {
            container.loop.startSync();
            container.loop.completePreflight(true, 'Auto-initialized for live spin processing');
        }

        container.loop.startSpinProcessing();

        // Ledger & EventBus: SPIN_RECEIVED
        this.runtime.ledger.append(sessionId, '5.0.0', 'SPIN_RECEIVED', num.toString());
        this.runtime.eventBus.publish('SPIN_RECEIVED', '5.0.0', randomUUID(), sessionId, {
            spin: num,
            timestampUtc: new Date().toISOString()
        });

        let session = this.runtime.sessionManager.getSession(sessionId);
        const bankroll = session ? session.currentBankroll : 1000;

        // 1. Pipeline Execution
        const pipelineResult = this.runtime.pipeline.execute({
            sessionId,
            value: num,
            bankroll,
            provider: session ? session.provider : 'EVOLUTION',
            isSkip: false
        });

        this.runtime.latestVix = pipelineResult.vix;
        this.runtime.burnInCount++;

        // 2. Adaptive Intelligence & Ensemble metrics
        const adaptiveMetrics = this.runtime.adaptiveEngine.getAggregateMetrics();
        const ensembleSnapshot = this.runtime.ensembleSnapshotManager.getLatest();
        const consensusLevel = ensembleSnapshot ? ensembleSnapshot.agreement.score : 0.5;
        const confidenceLevel = adaptiveMetrics.averageConfidence || 0.6;
        const availableStrategies = this.runtime.performanceHistory.getAllPerformances().map(p => ({
            strategyId: p.strategyId,
            confidenceScore: this.runtime.adaptiveEngine.evaluateConfidence(p.strategyId).score.value,
            winRate: p.totalExecutions > 0 ? p.wins / p.totalExecutions : 0.5,
            recentPnL: p.cumulativeProfit || 0
        }));

        // 3. Strategy Recommendation Engine
        const recInput = {
            bankroll,
            preFlightStatus: (pipelineResult.isLocked ? 'REJECTED' : 'APPROVED') as 'APPROVED' | 'REJECTED',
            lockReason: pipelineResult.lockReason || null,
            consensusLevel,
            confidenceLevel,
            riskLevel: pipelineResult.vix > 60 ? 2 : 1,
            adaptiveScore: confidenceLevel * 100,
            availableStrategies
        };

        const recommendation: OperationalDecisionDTO = this.recommendationEngine.generateRecommendation(recInput);

        // Determine Status (RECOMMENDATION vs HOLD vs BLOCK)
        let status = 'HOLD';
        if (pipelineResult.isLocked || recInput.preFlightStatus === 'REJECTED') {
            status = 'BLOCK';
        } else if (recommendation.isOpportunity && recommendation.stake > 0) {
            status = 'RECOMMENDATION';
        }

        // Ledger registration based on status
        if (status === 'RECOMMENDATION') {
            this.runtime.ledger.append(
                sessionId,
                '5.0.0',
                'RECOMMENDATION',
                `Strategy: ${recommendation.strategy || 'N/A'}, Stake: $${recommendation.stake.toFixed(2)}, Explanation: ${recommendation.explanation}`
            );
            this.runtime.eventBus.publish('RECOMMENDATION_GENERATED', '5.0.0', randomUUID(), sessionId, {
                recommendation
            });
        } else if (status === 'BLOCK') {
            this.runtime.ledger.append(sessionId, '5.0.0', 'BLOCK', pipelineResult.lockReason || 'Preflight / Risk Gate Blocked');
            this.runtime.eventBus.publish('SESSION_LOCKED', '5.0.0', randomUUID(), sessionId, {
                reason: pipelineResult.lockReason
            });
        } else {
            this.runtime.ledger.append(sessionId, '5.0.0', 'HOLD', `No high-confidence trigger. VIX: ${pipelineResult.vix.toFixed(1)}%`);
        }

        const processingTimeMs = Date.now() - startMs;
        const spinNumber = container.timeline.count + 1;

        // O(1) Timeline & Stats update
        const timelineEntry = {
            spinNumber,
            drawnNumber: num,
            timestampUtc: new Date().toISOString(),
            operationalVix: pipelineResult.vix,
            entropy: this.runtime.latestEntropy,
            consensus: consensusLevel,
            suggestedStrategy: recommendation.strategy,
            stake: recommendation.stake,
            status,
            processingTimeMs
        };

        container.timeline.addEntry(timelineEntry);

        container.statistics.recordSpin({
            drawnNumber: num,
            operationalVix: pipelineResult.vix,
            entropy: this.runtime.latestEntropy,
            consensus: consensusLevel,
            status,
            stake: recommendation.stake,
            currentBankroll: bankroll,
            confidence: recommendation.confidence
        });

        const historyItem = {
            id: randomUUID(),
            spinNumber,
            drawnNumber: num,
            strategy: recommendation.strategy,
            stake: recommendation.stake,
            isOpportunity: recommendation.isOpportunity,
            confidence: recommendation.confidence,
            consensus: recommendation.consensus,
            vix: pipelineResult.vix,
            entropy: this.runtime.latestEntropy,
            explanation: recommendation.explanation,
            status,
            timestampUtc: new Date().toISOString()
        };

        container.history.add(historyItem);

        // Emit ROUND_PROCESSED and SESSION_UPDATED
        this.runtime.eventBus.publish('ROUND_PROCESSED', '5.0.0', randomUUID(), sessionId, {
            spinNumber,
            drawnNumber: num,
            processingTimeMs,
            status
        });

        this.runtime.sessionManager.updateSession(sessionId, { status: 'ACTIVE' as any });

        this.runtime.eventBus.publish('SESSION_UPDATED', '5.0.0', randomUUID(), sessionId, {
            status: container.loop.getState(),
            totalSpins: spinNumber,
            latestVix: pipelineResult.vix
        });

        container.loop.completeSpinProcessing();

        return {
            spinNumber,
            drawnNumber: num,
            status,
            sessionStatus: container.loop.getState(),
            recommendation,
            pipelineResult,
            statistics: container.statistics.getStatistics()
        };
    }

    private async handleEndSession(sessionId: string): Promise<any> {
        const container = this.getSessionContainer(sessionId);
        container.loop.finishSession();

        this.runtime.ledger.append(sessionId, '5.0.0', 'SESSION_FINISHED', 'Operator manually terminated live session');
        this.runtime.eventBus.publish('SESSION_FINISHED', '5.0.0', randomUUID(), sessionId, {
            sessionId,
            finishedAtUtc: new Date().toISOString()
        });

        this.runtime.sessionManager.updateSession(sessionId, { status: 'FINISHED' as any });

        return {
            status: 'FINISHED',
            message: 'Session closed successfully.',
            statistics: container.statistics.getStatistics()
        };
    }

    private async handleStatus(sessionId: string): Promise<any> {
        const container = this.getSessionContainer(sessionId);
        return {
            sessionId,
            sessionStatus: container.loop.getState(),
            statistics: container.statistics.getStatistics(),
            timelineCount: container.timeline.count,
            historyCount: container.history.count
        };
    }
}
