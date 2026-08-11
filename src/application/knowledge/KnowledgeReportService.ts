import { KnowledgeAggregator } from './KnowledgeAggregator';
import { KnowledgeSnapshot } from './KnowledgeSnapshot';
import { KnowledgePattern } from './KnowledgePattern';

export interface KnowledgeStatistics {
    knowledgeVersion: string;
    totalPatterns: number;
    totalApprovedEvidence: number;
    topStrategies: string[];
    topRegimes: string[];
    knowledgeHealth: number;
}

export class KnowledgeReportService {
    constructor(private readonly aggregator: KnowledgeAggregator) {}
    
    public getKnowledgeStatistics(sessionId: string = 'SESSION-000'): KnowledgeStatistics {
        const catalog = this.aggregator.getCatalog();
        const latest = catalog.getLatestSnapshot();
        
        return {
            knowledgeVersion: latest ? latest.knowledgeVersion : '1.0.0',
            totalPatterns: catalog.getAllPatterns().length,
            totalApprovedEvidence: catalog.getApprovedEvidenceCount(),
            topStrategies: latest ? [latest.statistics.topStrategy] : [],
            topRegimes: latest ? [latest.statistics.topRegime] : [],
            knowledgeHealth: latest ? latest.statistics.knowledgeHealth : 1.0
        };
    }
    
    public getKnowledgePatterns(sessionId: string = 'SESSION-000'): ReadonlyArray<KnowledgePattern> {
        return this.aggregator.getCatalog().getAllPatterns();
    }
    
    public getLatestSnapshot(sessionId: string = 'SESSION-000'): KnowledgeSnapshot | null {
        return this.aggregator.getCatalog().getLatestSnapshot();
    }
}
