import { randomUUID } from 'crypto';
import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../runtime/observability/ObservableDecisionLedger';
import { SessionAuditHistory } from '../session-audit/SessionAuditHistory';
import { StrategyPerformanceAnalyzer } from '../session-audit/StrategyPerformanceAnalyzer';
import { BankrollEvolutionAnalyzer } from '../session-audit/BankrollEvolutionAnalyzer';
import { SessionInsightHistory } from './SessionInsightHistory';
import { SessionInsightSnapshot } from './SessionInsightSnapshot';
import { OperatorPerformanceProfile } from './OperatorPerformanceProfile';
import { OperatorBehaviorAnalyzer } from './OperatorBehaviorAnalyzer';
import { RiskBehaviorAnalyzer } from './RiskBehaviorAnalyzer';
import { ConsistencyScoreCalculator } from './ConsistencyScoreCalculator';
import { ImprovementTrendCalculator } from './ImprovementTrendCalculator';

export class SessionIntelligenceEngine {
    constructor(
        private readonly eventBus: ObservabilityEventBus,
        private readonly ledger: ObservableDecisionLedger,
        private readonly auditHistory: SessionAuditHistory,
        private readonly insightHistory: SessionInsightHistory
    ) {}

    public analyzeOperatorIntelligence(operatorId: string = 'OP-CORE-001'): SessionInsightSnapshot {
        const snapshots = this.auditHistory.getRecords();
        const evolution = BankrollEvolutionAnalyzer.analyze(snapshots);
        const strategySummaries = StrategyPerformanceAnalyzer.analyze(snapshots);

        let totalRounds = 0;
        let totalRoi = 0;
        let totalWinRate = 0;
        let totalStake = 0;

        for (const snapshot of snapshots) {
            totalRounds += snapshot.data.totalRounds;
            totalRoi += snapshot.data.roi;
            const winRate = snapshot.data.totalRounds > 0 ? snapshot.data.wins / snapshot.data.totalRounds : 0;
            totalWinRate += winRate;
            const avgSessionStake = snapshot.data.confirmedSuggestions > 0 ? (snapshot.data.finalBankroll / snapshot.data.confirmedSuggestions) : 0;
            totalStake += avgSessionStake;
        }

        const count = snapshots.length;
        const averageROI = count > 0 ? totalRoi / count : 0;
        const averageWinRate = count > 0 ? totalWinRate / count : 0;
        const averageStake = count > 0 ? totalStake / count : 0;

        const bestStrategy = strategySummaries.length > 0 ? strategySummaries[0].strategyName : null;
        const worstStrategy = strategySummaries.length > 0 ? strategySummaries[strategySummaries.length - 1].strategyName : null;

        const consistencyScore = ConsistencyScoreCalculator.calculate(snapshots);
        const riskLevel = RiskBehaviorAnalyzer.analyze(snapshots, evolution.maxDrawdown);
        const trend = ImprovementTrendCalculator.calculate(snapshots);
        const insights = OperatorBehaviorAnalyzer.analyze(snapshots);

        const profile: OperatorPerformanceProfile = {
            operatorId,
            totalSessions: count,
            totalRounds,
            averageROI,
            averageWinRate,
            averageStake,
            averageDrawdown: evolution.maxDrawdown,
            bestStrategy,
            worstStrategy,
            consistencyScore,
            riskLevel,
            trend
        };

        const snapshot = new SessionInsightSnapshot({
            timestamp: Date.now(),
            operatorProfile: profile,
            riskLevel,
            consistencyScore,
            trend,
            insights
        });

        this.insightHistory.append(snapshot);

        this.ledger.append(
            operatorId,
            '5.0.0',
            'SESSION_INTELLIGENCE_CREATED',
            `Session Intelligence created for ${operatorId}. Score: ${consistencyScore}, Trend: ${trend}, Risk: ${riskLevel}`
        );

        this.eventBus.publish(
            'SESSION_INTELLIGENCE_UPDATED',
            '5.0.0',
            randomUUID(),
            operatorId,
            { snapshot }
        );

        return snapshot;
    }
}
