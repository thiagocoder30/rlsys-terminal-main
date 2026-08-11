import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../runtime/DecisionLedger';
import { FeedbackGovernanceEngine } from './FeedbackGovernanceEngine';
import { EvidenceHistory } from './EvidenceHistory';
import { EvidenceValidationInput } from './EvidenceValidator';

export interface FeedbackSummary {
    readonly totalEvidence: number;
    readonly approved: number;
    readonly rejected: number;
    readonly averageQuality: number;
    readonly latestDecisionStatus: 'APPROVED' | 'REJECTED' | 'NONE';
    readonly latestRejectionReason: string | null;
}

export class FeedbackReportService {
    private engine: FeedbackGovernanceEngine;
    private history = new EvidenceHistory();

    constructor(
        private readonly eventBus?: ObservabilityEventBus,
        private readonly ledger?: DecisionLedger
    ) {
        this.engine = new FeedbackGovernanceEngine(ledger);
        if (this.eventBus) {
            this.setupSubscriptions();
        }
    }

    private setupSubscriptions(): void {
        if (!this.eventBus) return;

        // Listen to events and evaluate evidence
        this.eventBus.subscribe('SHADOW_PERFORMANCE_UPDATED', (event) => {
            const sessionId = event.sessionId || 'SESSION-000';
            const payload = event.payload || {};
            const snapshot = payload.snapshot as any;

            if (snapshot) {
                const totalSims = snapshot.totalSimulations || 0;
                // Construct a validation input based on shadow performance
                const input: EvidenceValidationInput = {
                    evidenceType: 'SHADOW_PERFORMANCE',
                    sampleSize: totalSims,
                    qualityScore: snapshot.winRate ? snapshot.winRate / 100 : 0.5,
                    stabilityScore: snapshot.drawdown && snapshot.drawdown < 10 ? 0.8 : 0.4,
                    noiseLevel: 0.1, // Mock metric
                    conflictLevel: 0.1, // Mock metric
                    ledgerIntact: true,
                    snapshotIntact: true
                };
                
                this.processEvidence(sessionId, input);
            }
        });
        
        this.eventBus.subscribe('PERFORMANCE_UPDATED', (event) => {
            const sessionId = event.sessionId || 'SESSION-000';
            const payload = event.payload || {};
            const snapshot = payload.snapshot as any;

            if (snapshot) {
                const totalRounds = snapshot.totalRounds || 0;
                // Construct a validation input based on session performance
                const input: EvidenceValidationInput = {
                    evidenceType: 'SESSION_PERFORMANCE',
                    sampleSize: totalRounds,
                    qualityScore: snapshot.winRate ? snapshot.winRate / 100 : 0.5,
                    stabilityScore: snapshot.drawdown && snapshot.drawdown < 15 ? 0.7 : 0.3,
                    noiseLevel: 0.2, 
                    conflictLevel: 0.2, 
                    ledgerIntact: true,
                    snapshotIntact: true
                };
                
                this.processEvidence(sessionId, input);
            }
        });
    }

    private processEvidence(sessionId: string, input: EvidenceValidationInput) {
        const result = this.engine.evaluateEvidence(sessionId, input);
        this.history.append(result.snapshot);
    }
    
    // For manual testing/triggering
    public submitEvidence(sessionId: string, input: EvidenceValidationInput) {
        this.processEvidence(sessionId, input);
    }

    public getFeedbackSummary(sessionId: string = 'SESSION-000'): FeedbackSummary {
        const hist = this.history.getHistory(sessionId);
        const latest = this.history.getLatest(sessionId);
        return {
            totalEvidence: hist.length,
            approved: this.history.getApprovedCount(sessionId),
            rejected: this.history.getRejectedCount(sessionId),
            averageQuality: this.history.getAverageQuality(sessionId),
            latestDecisionStatus: latest ? latest.validationStatus : 'NONE',
            latestRejectionReason: latest && latest.validationStatus === 'REJECTED' ? latest.reason : null
        };
    }

    public getFeedbackHistory(sessionId: string = 'SESSION-000') {
        return this.history.getHistory(sessionId);
    }
}
