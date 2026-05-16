/**
 * Metadados de segurança e versionamento.
 */
export interface SnapshotMetadata {
  readonly snapshotId: string;
  readonly compiledAtMs: number;
  readonly validUntilMs: number; // Tempo limite para o decaimento do Alpha
  readonly compilerVersion: string;
}

/**
 * Restrições de Regime. O Snapshot só tem validade se o ambiente físico coincidir.
 */
export interface RegimeConstraint {
  readonly expectedDealerId: string;
  readonly wheelSpeedCategory: 'SLOW' | 'NORMAL' | 'FAST' | 'ANY';
}

/**
 * Representação do Edge Matemático para um setor específico.
 */
export interface SectorEdge {
  readonly targetSector: number; // Número central do cluster (0-36)
  readonly clusterSize: number;  // Quantos vizinhos engloba
  readonly expectedEV: number;   // Expected Value > 0
  readonly confidenceScore: number; // 0.0 a 1.0
}

/**
 * Tabela de Lookup O(1). 
 * A chave é um identificador determinístico de estado (ex: "D01_NORMAL_SECTOR12").
 */
export type DecisionLookupTable = Record<string, SectorEdge[]>;

/**
 * O Contrato Principal: O Pacote Compilado.
 */
export interface KnowledgeSnapshot {
  readonly metadata: SnapshotMetadata;
  readonly constraints: RegimeConstraint;
  readonly lookupTable: DecisionLookupTable;
}
