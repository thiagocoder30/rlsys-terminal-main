import { describe, it, expect } from 'vitest';
import { SessionIntelligenceReportService } from '../../../src/application/session-intelligence/SessionIntelligenceReportService';
import { SessionIntelligenceEngine } from '../../../src/application/session-intelligence/SessionIntelligenceEngine';
import { SessionInsightHistory } from '../../../src/application/session-intelligence/SessionInsightHistory';
import { SessionAuditHistory } from '../../../src/application/session-audit/SessionAuditHistory';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { ObservableDecisionLedger } from '../../../src/application/runtime/observability/ObservableDecisionLedger';

describe('SessionIntelligenceReportService', () => {
    it('should return latest intelligence and trend analysis', () => {
        const eventBus = new ObservabilityEventBus();
        const ledger = new ObservableDecisionLedger(eventBus);
        const auditHistory = new SessionAuditHistory();
        const insightHistory = new SessionInsightHistory();
        const engine = new SessionIntelligenceEngine(eventBus, ledger, auditHistory, insightHistory);
        const service = new SessionIntelligenceReportService(insightHistory, engine);

        const snapshot = service.getLatestIntelligence();
        expect(snapshot.data.operatorProfile.operatorId).toBe('OP-CORE-001');

        const trendAnalysis = service.getTrendAnalysis();
        expect(trendAnalysis.consistencyScore).toBeDefined();
        expect(trendAnalysis.trend).toBeDefined();

        const history = service.getInsightHistory();
        expect(history.length).toBe(1);
    });
});
