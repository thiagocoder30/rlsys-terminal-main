import { KnowledgePattern } from './KnowledgePattern';
import { KnowledgeSnapshot } from './KnowledgeSnapshot';

export class KnowledgeCatalog {
    private patterns = new Map<string, KnowledgePattern>();
    private latestSnapshot: KnowledgeSnapshot | null = null;
    private approvedEvidenceCount = 0;
    
    public addOrUpdatePattern(pattern: KnowledgePattern): void {
        this.patterns.set(pattern.patternId, pattern);
    }
    
    public getPattern(patternId: string): KnowledgePattern | undefined {
        return this.patterns.get(patternId);
    }
    
    public getAllPatterns(): ReadonlyArray<KnowledgePattern> {
        return Array.from(this.patterns.values());
    }
    
    public incrementApprovedEvidence(): void {
        this.approvedEvidenceCount++;
    }
    
    public getApprovedEvidenceCount(): number {
        return this.approvedEvidenceCount;
    }
    
    public setLatestSnapshot(snapshot: KnowledgeSnapshot): void {
        this.latestSnapshot = snapshot;
    }
    
    public getLatestSnapshot(): KnowledgeSnapshot | null {
        return this.latestSnapshot;
    }
}
