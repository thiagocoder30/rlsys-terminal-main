import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../runtime/observability/ObservableDecisionLedger';
import { SessionAuditHistory } from './SessionAuditHistory';
import { HistoricalSessionSnapshot, HistoricalSessionData } from './HistoricalSessionSnapshot';
import { PerformanceMetricsCalculator } from './PerformanceMetricsCalculator';
import { randomUUID } from 'crypto';

export interface CreateAuditRequest {
    sessionId: string;
    startTime: number;
    endTime: number;
    initialBankroll: number;
    finalBankroll: number;
    totalRounds: number;
    confirmedSuggestions: number;
    skippedSuggestions: number;
    wins: number;
    losses: number;
    stopReason: string;
    strategiesUsed: string[];
}

export class SessionAuditEngine {
    constructor(
        private readonly eventBus: ObservabilityEventBus,
        private readonly ledger: ObservableDecisionLedger,
        private readonly history: SessionAuditHistory
    ) {}

    public auditSession(request: CreateAuditRequest): HistoricalSessionSnapshot {
        const metrics = PerformanceMetricsCalculator.calculate(
            request.initialBankroll,
            request.finalBankroll,
            request.totalRounds,
            request.confirmedSuggestions,
            request.skippedSuggestions,
            request.wins,
            request.losses
        );

        const data: HistoricalSessionData = {
            sessionId: request.sessionId,
            startTime: request.startTime,
            endTime: request.endTime,
            initialBankroll: request.initialBankroll,
            finalBankroll: request.finalBankroll,
            profitLoss: request.finalBankroll - request.initialBankroll,
            roi: metrics.roi,
            totalRounds: request.totalRounds,
            confirmedSuggestions: request.confirmedSuggestions,
            skippedSuggestions: request.skippedSuggestions,
            wins: request.wins,
            losses: request.losses,
            stopReason: request.stopReason,
            strategiesUsed: request.strategiesUsed,
            performanceScore: metrics.overallScore
        };

        const snapshot = new HistoricalSessionSnapshot(data);
        this.history.append(snapshot);

        // Ledger & Event Bus
        this.ledger.append(
            request.sessionId,
            '5.0.0',
            'SESSION_AUDIT_CREATED',
            `Session Audit created. ROI: ${(metrics.roi * 100).toFixed(2)}%, Score: ${metrics.overallScore}`
        );

        this.eventBus.publish(
            'SESSION_HISTORY_ANALYZED',
            '5.0.0',
            randomUUID(),
            request.sessionId,
            { snapshot }
        );

        return snapshot;
    }
}
