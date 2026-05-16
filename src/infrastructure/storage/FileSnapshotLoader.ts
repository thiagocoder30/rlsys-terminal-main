import * as fs from 'node:fs';
import * as path from 'node:path';
import { SnapshotLoader, LoaderResult } from '../../application/knowledge/KnowledgeLoaderContract';
import { SnapshotValidator } from '../../domain/knowledge/SnapshotValidator';
import { KnowledgeSnapshot } from '../../domain/knowledge/SnapshotSchema';

export class FileSnapshotLoader implements SnapshotLoader {
  /**
   * @param storageDirectory O diretório onde os ficheiros .json compilados são armazenados.
   */
  constructor(private readonly storageDirectory: string) {}

  /**
   * Carrega, faz o parse e valida a integridade física e temporal do Snapshot.
   * Operação bloqueante segura (feita apenas no pré-carregamento da sessão).
   */
  public load(snapshotId: string, currentTimeMs: number): LoaderResult {
    // Sanitização básica do nome do ficheiro contra path traversal
    const safeSnapshotId = path.basename(snapshotId);
    const filePath = path.join(this.storageDirectory, `${safeSnapshotId}.json`);

    // 1. Integridade Física: O Ficheiro existe?
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'SNAPSHOT_FILE_NOT_FOUND' };
    }

    try {
      // 2. I/O: Leitura do Ficheiro
      const rawData = fs.readFileSync(filePath, 'utf-8');
      
      // 3. Parse: Transforma String em Objeto (Pode falhar se corrompido na transferência)
      const parsedObject = JSON.parse(rawData);

      // 4. Validação de Domínio (Schema e Decaimento Temporal via Sprint 038)
      const validation = SnapshotValidator.validate(parsedObject, currentTimeMs);
      
      if (!validation.isValid) {
        return { success: false, error: `INTEGRITY_OR_EXPIRATION_FAILURE: ${validation.error}` };
      }

      // 5. Sucesso: Pacote ancorado na memória, estritamente tipado.
      return { success: true, snapshot: parsedObject as KnowledgeSnapshot };

    } catch (error) {
      return { success: false, error: 'JSON_PARSE_ERROR_CORRUPT_FILE' };
    }
  }
}
