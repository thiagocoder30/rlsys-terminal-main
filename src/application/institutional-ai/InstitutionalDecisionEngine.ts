import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../runtime/DecisionLedger';
import { InstitutionalDecisionSnapshot } from './InstitutionalDecisionSnapshot';
import { InstitutionalDecisionAggregator } from './InstitutionalDecisionAggregator';
import { InstitutionalConfidenceCalculator } from './calculators/InstitutionalConfidenceCalculator';
import { InstitutionalConsensusCalculator } from './calculators/InstitutionalConsensusCalculator';
import { InstitutionalHealthCalculator } from './calculators/InstitutionalHealthCalculator';
import { InstitutionalDecisionHistory } from './InstitutionalDecisionHistory';
import { createHash, randomUUID } from 'crypto';

export class InstitutionalDecisionEngine {
    private readonly history = new InstitutionalDecisionHistory();
    private readonly aggregator: InstitutionalDecisionAggregator;
    private readonly confidenceCalculator = new InstitutionalConfidenceCalculator();
    private readonly consensusCalculator = new InstitutionalConsensusCalculator();
    private readonly healthCalculator = new InstitutionalHealthCalculator();
    private currentSessionId = 'SESSION-000';

    constructor(
        private readonly eventBus: ObservabilityEventBus,
        private readonly ledger: DecisionLedger
    ) {
        this.aggregator = new InstitutionalDecisionAggregator(this.eventBus);
        this.setupSubscriptions();
    }

    private setupSubscriptions(): void {
        this.eventBus.subscribe('SESSION_PERFORMANCE_UPDATED', (event) => {
            this.currentSessionId = event.sessionId || this.currentSessionId;
            this.generateSnapshot();
        });
    }

    private generateSnapshot(): void {
        const evidence = this.aggregator.getEvidence();
        
        const institutionalConfidence = this.confidenceCalculator.calculate(evidence);
        const institutionalConsensus = this.consensusCalculator.calculate(evidence);
        const healthIndicators = this.healthCalculator.calculate(evidence);
        
        const evidenceQuality = healthIndicators.evidenceStability;
        const overallIntelligenceScore = (institutionalConfidence + institutionalConsensus + healthIndicators.institutionalHealth) / 3;

        const snapshotId = randomUUID();
        const timestamp = new Date().toISOString();

        const raw = `${snapshotId}:${overallIntelligenceScore}:${institutionalConfidence}:${institutionalConsensus}:${healthIndicators.institutionalHealth}`;
        const hash = createHash('sha256').update(raw).digest('hex');

        const snapshot: InstitutionalDecisionSnapshot = Object.freeze({
            snapshotId,
            timestamp,
            overallIntelligenceScore,
            institutionalConfidence,
            institutionalConsensus,
            institutionalHealth: healthIndicators.institutionalHealth,
            knowledgeCoverage: evidence.knowledgeCoverage,
            learningIndex: evidence.learningIndex,
            evolutionIndex: evidence.evolutionIndex,
            portfolioHealth: evidence.portfolioHealth,
            portfolioDiversification: evidence.portfolioDiversification,
            predictionConfidence: evidence.predictionConfidence,
            strategyMaturity: evidence.strategyMaturity,
            shadowAccuracy: evidence.shadowAccuracy,
            replayConsistency: evidence.replayConsistency,
            evidenceQuality,
            operationalReadiness: healthIndicators.operationalReadiness,
            hash
        });

        this.history.addSnapshot(snapshot);

        // Ledger integration
        this.ledger.append(this.currentSessionId, '5.0.0', 'INSTITUTIONAL_DECISION_UPDATED', JSON.stringify({
            snapshotId,
            overallIntelligenceScore,
            hash
        }));
        this.ledger.append(this.currentSessionId, '5.0.0', 'INSTITUTIONAL_CONFIDENCE_UPDATED', JSON.stringify({
            institutionalConfidence,
            hash
        }));
        this.ledger.append(this.currentSessionId, '5.0.0', 'INSTITUTIONAL_CONSENSUS_UPDATED', JSON.stringify({
            institutionalConsensus,
            hash
        }));
        this.ledger.append(this.currentSessionId, '5.0.0', 'INSTITUTIONAL_HEALTH_UPDATED', JSON.stringify({
            institutionalHealth: healthIndicators.institutionalHealth,
            hash
        }));
    }

    public getHistory(): InstitutionalDecisionHistory {
        return this.history;
    }
}
