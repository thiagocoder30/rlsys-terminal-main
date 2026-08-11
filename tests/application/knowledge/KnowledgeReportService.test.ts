import { describe, it, expect } from 'vitest';
import { KnowledgeAggregator } from '../../../src/application/knowledge/KnowledgeAggregator';
import { KnowledgeReportService } from '../../../src/application/knowledge/KnowledgeReportService';

describe('KnowledgeReportService', () => {
    it('should return statistics and patterns', () => {
        const aggregator = new KnowledgeAggregator();
        aggregator.updateKnowledge('TEST', 'MOCK', { strategy: 'FIBONACCI', marketRegime: 'TRENDING' });
        
        const service = new KnowledgeReportService(aggregator);
        const stats = service.getKnowledgeStatistics();
        expect(stats.totalPatterns).toBe(1);
        expect(stats.topStrategies).toContain('FIBONACCI');
        
        const patterns = service.getKnowledgePatterns();
        expect(patterns).toHaveLength(1);
        expect(patterns[0].strategy).toBe('FIBONACCI');
    });
});
