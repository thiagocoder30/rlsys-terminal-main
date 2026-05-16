export interface RawResearchSector {
  readonly dealerId: string;
  readonly wheelSpeed: 'SLOW' | 'NORMAL' | 'FAST' | 'ANY';
  readonly targetSector: number;
  readonly clusterSize: number;
  readonly calculatedEV: number;
  readonly confidence: number;
}

export interface CompilerConfig {
  readonly minExpectedValue: number; // Ex: 0.05 (5% de edge mínimo)
  readonly minConfidence: number;    // Ex: 0.85 (85% de certeza estatística)
  readonly snapshotLifespanMs: number; // Tempo até o Alpha expirar
  readonly compilerVersion: string;
}

export type CompilerResult = 
  | { success: true; snapshot: import('./SnapshotSchema').KnowledgeSnapshot }
  | { success: false; error: string };
