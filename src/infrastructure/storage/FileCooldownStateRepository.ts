import * as fs from 'node:fs';
import * as path from 'node:path';
import { CooldownState, CooldownStateRepository } from '../../domain/runtime/CooldownContracts';

export class FileCooldownStateRepository implements CooldownStateRepository {
  private readonly filePath: string;

  constructor(storageDirectory: string) {
    if (!fs.existsSync(storageDirectory)) {
      fs.mkdirSync(storageDirectory, { recursive: true });
    }
    this.filePath = path.join(storageDirectory, 'cooldown_state.json');
  }

  public save(state: CooldownState): void {
    try {
      // Uso sincrono garantindo atomicidade antes que o processo morra
      fs.writeFileSync(this.filePath, JSON.stringify(state), 'utf-8');
    } catch (error) {
      console.error('[FileCooldownRepo] Erro ao salvar estado:', error);
    }
  }

  public load(): CooldownState | null {
    try {
      if (!fs.existsSync(this.filePath)) return null;
      const data = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(data) as CooldownState;
    } catch (error) {
      console.error('[FileCooldownRepo] Erro ao carregar estado. Assumindo estado limpo.', error);
      return null;
    }
  }

  public clear(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
    } catch (error) {
      console.error('[FileCooldownRepo] Erro ao limpar estado:', error);
    }
  }
}
