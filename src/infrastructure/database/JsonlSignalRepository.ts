import { promises as fs } from 'fs';
import path from 'path';
import { ISignalRepository, SignalData } from '../../domain/math/ISignalRepository';

/**
 * Persistência append-only em JSONL.
 * Evita dependências nativas como sqlite3, tornando o projeto mais confiável em Termux/Arch/Android.
 */
export class JsonlSignalRepository implements ISignalRepository {
  constructor(private readonly filePath: string) {}

  public async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, '', 'utf8');
    }
  }

  public async saveSignal(signal: SignalData): Promise<void> {
    const record = JSON.stringify({ ...signal, persistedAt: new Date().toISOString() });
    await fs.appendFile(this.filePath, `${record}\n`, 'utf8');
  }

  public async getHistory(limit: number): Promise<SignalData[]> {
    const content = await fs.readFile(this.filePath, 'utf8');
    return content
      .split('\n')
      .filter(Boolean)
      .slice(-Math.max(0, limit))
      .map(line => JSON.parse(line) as SignalData)
      .reverse();
  }

  public async close(): Promise<void> {
    // JSONL append-only não mantém conexão aberta.
  }
}
