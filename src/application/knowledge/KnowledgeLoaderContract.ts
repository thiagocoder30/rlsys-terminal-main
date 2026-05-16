import { KnowledgeSnapshot } from '../../domain/knowledge/SnapshotSchema';

export type LoaderResult = 
  | { success: true; snapshot: KnowledgeSnapshot }
  | { success: false; error: string };

/**
 * Interface que isola o domínio do sistema de ficheiros físico.
 */
export interface SnapshotLoader {
  load(snapshotId: string, currentTimeMs: number): LoaderResult;
}
