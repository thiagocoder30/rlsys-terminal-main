import { KnowledgeSnapshot } from '../../domain/knowledge/SnapshotSchema';

export interface SnapshotRepository {
  save(snapshot: KnowledgeSnapshot): void;
}

export interface OrchestrationResult {
  readonly dealersProcessed: number;
  readonly snapshotsGenerated: number;
  readonly failures: Array<{ dealerId: string; reason: string }>;
}
