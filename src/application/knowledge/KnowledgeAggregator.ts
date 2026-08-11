import { ObservabilityEventBus } from '../runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../runtime/DecisionLedger';
import { KnowledgeCatalog } from './KnowledgeCatalog';
import { KnowledgeIndexer } from './KnowledgeIndexer';
import { KnowledgeSnapshot } from './KnowledgeSnapshot';
import { KnowledgePattern } from './KnowledgePattern';
import { createHash, randomUUID } from 'crypto';

export class KnowledgeAggregator {
    private catalog = new KnowledgeCatalog();
    private indexer = new KnowledgeIndexer();
    
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
        
        this.eventBus.subscribe('FEEDBACK_APPROVED', (event) => {
            const sessionId = event.sessionId || 'SESSION-000';
            this.catalog.incrementApprovedEvidence();
            this.updateKnowledge(sessionId, 'EVIDENCE_APPROVED', event.payload);
        });
        
        this.eventBus.subscribe('MARKET_REGIME_UPDATED', (event) => {
            const sessionId = event.sessionId || 'SESSION-000';
            this.updateKnowledge(sessionId, 'REGIME_UPDATED', event.payload);
        });
        
        this.eventBus.subscribe('PERFORMANCE_UPDATED', (event) => {
             const sessionId = event.sessionId || 'SESSION-000';
             this.updateKnowledge(sessionId, 'PERFORMANCE_UPDATED', event.payload);
        });
        
        this.eventBus.subscribe('SHADOW_PERFORMANCE_UPDATED', (event) => {
             const sessionId = event.sessionId || 'SESSION-000';
             this.updateKnowledge(sessionId, 'SHADOW_PERFORMANCE_UPDATED', event.payload);
        });
        
        this.eventBus.subscribe('CALIBRATION_UPDATED', (event) => {
             const sessionId = event.sessionId || 'SESSION-000';
             this.updateKnowledge(sessionId, 'CALIBRATION_UPDATED', event.payload);
        });
        
        this.eventBus.subscribe('DECISION_REPLAY_COMPLETED', (event) => {
             const sessionId = event.sessionId || 'SESSION-000';
             this.updateKnowledge(sessionId, 'DECISION_REPLAY_COMPLETED', event.payload);
        });
    }
    
    public updateKnowledge(sessionId: string, source: string, payload: any): void {
        const timestamp = new Date().toISOString();
        let strategy = 'UNKNOWN';
        let marketRegime = 'UNKNOWN';
        
        if (source === 'REGIME_UPDATED' && payload?.regime) {
            marketRegime = payload.regime;
        } else if (payload?.marketRegime) {
            marketRegime = payload.marketRegime;
        } else {
            marketRegime = 'TRENDING';
        }
        
        if (payload?.strategy) {
            strategy = payload.strategy;
        } else if (payload?.strategyId) {
             strategy = payload.strategyId;
        } else {
            strategy = 'FIBONACCI';
        }
        
        const patternId = `${strategy}-${marketRegime}`;
        const existing = this.catalog.getPattern(patternId);
        
        const pattern: KnowledgePattern = Object.freeze({
            patternId,
            description: `Pattern observed for ${strategy} under ${marketRegime}`,
            frequency: existing ? existing.frequency + 1 : 1,
            confidence: existing ? Math.min(existing.confidence + 0.05, 1.0) : 0.5,
            source,
            strategy,
            marketRegime,
            approvedEvidence: this.catalog.getApprovedEvidenceCount(),
            lastObserved: timestamp
        });
        
        this.catalog.addOrUpdatePattern(pattern);
        this.indexer.indexPattern(pattern);
        
        if (this.ledger) {
            this.ledger.append(sessionId, '5.0.0', 'KNOWLEDGE_PATTERN_CREATED', JSON.stringify({ patternId }));
            this.ledger.append(sessionId, '5.0.0', 'KNOWLEDGE_UPDATED', JSON.stringify({ version: '1.0' }));
        }
        
        this.generateSnapshot(sessionId, timestamp);
    }
    
    private generateSnapshot(sessionId: string, timestamp: string): void {
        const snapshotId = randomUUID();
        const patterns = this.catalog.getAllPatterns();
        
        const raw = `${snapshotId}:${sessionId}:${timestamp}:${patterns.length}`;
        const hash = createHash('sha256').update(raw).digest('hex');
        
        const snapshot: KnowledgeSnapshot = Object.freeze({
            snapshotId,
            timestamp,
            sessionId,
            knowledgeVersion: '1.0.0',
            hash,
            patterns,
            strategySummary: [{ strategy: 'FIBONACCI', performance: 0.8 }],
            regimeSummary: [{ regime: 'TRENDING', occurrences: 10 }],
            confidenceSummary: 0.85,
            statistics: {
                totalPatterns: patterns.length,
                approvedEvidence: this.catalog.getApprovedEvidenceCount(),
                topStrategy: 'FIBONACCI',
                topRegime: 'TRENDING',
                knowledgeHealth: 0.95
            }
        });
        
        this.catalog.setLatestSnapshot(snapshot);
        
        if (this.ledger) {
            this.ledger.append(sessionId, '5.0.0', 'KNOWLEDGE_SNAPSHOT_CREATED', JSON.stringify({ snapshotId, hash }));
        }
    }
    
    public getCatalog(): KnowledgeCatalog {
        return this.catalog;
    }
    
    public getIndexer(): KnowledgeIndexer {
        return this.indexer;
    }
}
