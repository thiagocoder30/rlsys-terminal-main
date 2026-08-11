import { KnowledgePattern } from './KnowledgePattern';

export class KnowledgeIndexer {
    private strategyIndex = new Map<string, Set<string>>();
    private regimeIndex = new Map<string, Set<string>>();
    
    public indexPattern(pattern: KnowledgePattern): void {
        if (!this.strategyIndex.has(pattern.strategy)) {
            this.strategyIndex.set(pattern.strategy, new Set());
        }
        this.strategyIndex.get(pattern.strategy)!.add(pattern.patternId);
        
        if (!this.regimeIndex.has(pattern.marketRegime)) {
            this.regimeIndex.set(pattern.marketRegime, new Set());
        }
        this.regimeIndex.get(pattern.marketRegime)!.add(pattern.patternId);
    }
    
    public getPatternsByStrategy(strategy: string): string[] {
        return Array.from(this.strategyIndex.get(strategy) || []);
    }
    
    public getPatternsByRegime(regime: string): string[] {
        return Array.from(this.regimeIndex.get(regime) || []);
    }
}
