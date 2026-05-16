import * as fs from 'node:fs';
import * as path from 'node:path';
import { SnapshotRepository } from '../../application/orchestration/OrchestrationContracts';
import { KnowledgeSnapshot } from '../../domain/knowledge/SnapshotSchema';

export class FileSnapshotRepository implements SnapshotRepository {
  constructor(private readonly storageDirectory: string) {
    if (!fs.existsSync(storageDirectory)) {
      fs.mkdirSync(storageDirectory, { recursive: true });
    }
  }

  public save(snapshot: KnowledgeSnapshot): void {
    const safeId = snapshot.metadata.snapshotId.replace(/[^a-zA-Z0-9_-]/g, '');
    const filePath = path.join(this.storageDirectory, `${safeId}.json`);
    
    // Escrita síncrona atómica para garantir a integridade do laboratório
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
  }
}
