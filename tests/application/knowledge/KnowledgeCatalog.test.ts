import { describe, it, expect } from 'vitest';
import { KnowledgeCatalog } from '../../../src/application/knowledge/KnowledgeCatalog';
import { KnowledgePattern } from '../../../src/application/knowledge/KnowledgePattern';

describe('KnowledgeCatalog', () => {
    it('should add and retrieve a pattern', () => {
        const catalog = new KnowledgeCatalog();
        const pattern: KnowledgePattern = Object.freeze({
            patternId: 'FIB-TRENDING',
            description: 'Test pattern',
            frequency: 1,
            confidence: 0.8,
            source: 'REGIME_UPDATED',
            strategy: 'FIBONACCI',
            marketRegime: 'TRENDING',
            approvedEvidence: 0,
            lastObserved: '2023-01-01T00:00:00Z'
        });
        
        catalog.addOrUpdatePattern(pattern);
        expect(catalog.getPattern('FIB-TRENDING')).toEqual(pattern);
        expect(catalog.getAllPatterns()).toHaveLength(1);
    });
    
    it('should increment approved evidence count', () => {
        const catalog = new KnowledgeCatalog();
        expect(catalog.getApprovedEvidenceCount()).toBe(0);
        catalog.incrementApprovedEvidence();
        expect(catalog.getApprovedEvidenceCount()).toBe(1);
    });
});
