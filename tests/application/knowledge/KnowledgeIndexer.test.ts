import { describe, it, expect } from 'vitest';
import { KnowledgeIndexer } from '../../../src/application/knowledge/KnowledgeIndexer';
import { KnowledgePattern } from '../../../src/application/knowledge/KnowledgePattern';

describe('KnowledgeIndexer', () => {
    it('should index patterns by strategy and regime', () => {
        const indexer = new KnowledgeIndexer();
        const pattern1: KnowledgePattern = Object.freeze({
            patternId: 'FIB-TRENDING',
            description: 'Test pattern 1',
            frequency: 1,
            confidence: 0.8,
            source: 'REGIME_UPDATED',
            strategy: 'FIBONACCI',
            marketRegime: 'TRENDING',
            approvedEvidence: 0,
            lastObserved: '2023-01-01T00:00:00Z'
        });
        const pattern2: KnowledgePattern = Object.freeze({
            patternId: 'MARKOV-RANGING',
            description: 'Test pattern 2',
            frequency: 1,
            confidence: 0.8,
            source: 'REGIME_UPDATED',
            strategy: 'MARKOV',
            marketRegime: 'RANGING',
            approvedEvidence: 0,
            lastObserved: '2023-01-01T00:00:00Z'
        });
        
        indexer.indexPattern(pattern1);
        indexer.indexPattern(pattern2);
        
        const fibPatterns = indexer.getPatternsByStrategy('FIBONACCI');
        expect(fibPatterns).toHaveLength(1);
        expect(fibPatterns[0]).toBe('FIB-TRENDING');
        
        const rangingPatterns = indexer.getPatternsByRegime('RANGING');
        expect(rangingPatterns).toHaveLength(1);
        expect(rangingPatterns[0]).toBe('MARKOV-RANGING');
    });
});
