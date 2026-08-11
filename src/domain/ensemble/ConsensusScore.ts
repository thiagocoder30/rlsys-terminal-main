export interface ConsensusScore {
    value: number; // 0 to 100+
    level: 'WEAK' | 'MODERATE' | 'STRONG' | 'ABSOLUTE';
}
