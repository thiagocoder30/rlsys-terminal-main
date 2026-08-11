import { describe, it, expect, vi } from 'vitest';
import { KnowledgeAggregator } from '../../../src/application/knowledge/KnowledgeAggregator';
import { ObservabilityEventBus } from '../../../src/application/runtime/observability/ObservabilityEventBus';
import { DecisionLedger } from '../../../src/application/runtime/DecisionLedger';

describe('KnowledgeAggregator', () => {
    it('should aggregate knowledge on events', () => {
        const eventBus = new ObservabilityEventBus();
        const ledger = new DecisionLedger();
        
        const aggregator = new KnowledgeAggregator(eventBus, ledger);
        
        eventBus.publish('MARKET_REGIME_UPDATED', '1.0.0', 'CORR-1', 'TEST', { regime: 'TRENDING' });
        
        const catalog = aggregator.getCatalog();
        expect(catalog.getAllPatterns()).toHaveLength(1);
        const pattern = catalog.getAllPatterns()[0];
        expect(pattern.marketRegime).toBe('TRENDING');
        
        eventBus.publish('FEEDBACK_APPROVED', '1.0.0', 'CORR-2', 'TEST', { strategy: 'MARKOV', marketRegime: 'RANGING' });
        
        expect(catalog.getApprovedEvidenceCount()).toBe(1);
        expect(catalog.getAllPatterns()).toHaveLength(2);
        const indexer = aggregator.getIndexer();
        expect(indexer.getPatternsByStrategy('MARKOV')).toHaveLength(1);
    });
});
