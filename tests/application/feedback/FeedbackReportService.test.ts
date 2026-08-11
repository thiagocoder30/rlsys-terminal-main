import { describe, it, expect, beforeEach } from 'vitest';
import { FeedbackReportService } from '../../../src/application/feedback/FeedbackReportService';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../../../src/application/runtime/DecisionLedger';

describe('FeedbackReportService Unit Tests', () => {
    let eventBus: ObservabilityEventBus;
    let ledger: DecisionLedger;
    let service: FeedbackReportService;

    beforeEach(() => {
        eventBus = new ObservabilityEventBus();
        ledger = new DecisionLedger();
        service = new FeedbackReportService(eventBus, ledger);
    });

    it('should initialize and return empty summary', () => {
        const summary = service.getFeedbackSummary('SESSION-000');
        expect(summary.totalEvidence).toBe(0);
        expect(summary.approved).toBe(0);
        expect(summary.rejected).toBe(0);
        expect(summary.averageQuality).toBe(0);
        expect(summary.latestDecisionStatus).toBe('NONE');
    });

    it('should process evidence manually', () => {
        service.submitEvidence('SESSION-000', {
            evidenceType: 'SHADOW_PERFORMANCE',
            sampleSize: 50,
            qualityScore: 0.8,
            stabilityScore: 0.7,
            noiseLevel: 0.1,
            conflictLevel: 0.1,
            ledgerIntact: true,
            snapshotIntact: true
        });

        const summary = service.getFeedbackSummary('SESSION-000');
        expect(summary.totalEvidence).toBe(1);
        expect(summary.approved).toBe(1);
        expect(summary.averageQuality).toBe(0.8);
        expect(summary.latestDecisionStatus).toBe('APPROVED');
    });

    it('should react to SHADOW_PERFORMANCE_UPDATED event', () => {
        eventBus.publish('SHADOW_PERFORMANCE_UPDATED', '5.0.0', 'corr-1', 'SESSION-000', {
            snapshot: {
                totalSimulations: 40,
                winRate: 70, // 0.7 quality
                drawdown: 5 // 0.8 stability
            }
        });

        const summary = service.getFeedbackSummary('SESSION-000');
        expect(summary.totalEvidence).toBe(1);
        expect(summary.approved).toBe(1);
        expect(summary.averageQuality).toBe(0.7);
    });
    
    it('should react to PERFORMANCE_UPDATED event and reject on poor quality', () => {
        eventBus.publish('PERFORMANCE_UPDATED', '5.0.0', 'corr-2', 'SESSION-000', {
            snapshot: {
                totalRounds: 10, // < 30 triggers INSUFFICIENT_SAMPLE_SIZE
                winRate: 40, 
                drawdown: 25
            }
        });

        const summary = service.getFeedbackSummary('SESSION-000');
        expect(summary.totalEvidence).toBe(1);
        expect(summary.rejected).toBe(1);
        expect(summary.latestDecisionStatus).toBe('REJECTED');
        expect(summary.latestRejectionReason).toBe('INSUFFICIENT_SAMPLE_SIZE');
    });
});
