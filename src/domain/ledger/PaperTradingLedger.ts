import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export interface PaperTradeRecord {
  readonly timestamp: string;
  readonly recommendation: string;
  readonly outcome: 'WIN' | 'LOSS' | 'PENDING';
  readonly virtualStake: number;
  readonly virtualPnL: number;
}

export class PaperTradingLedger {
  constructor(private readonly storagePath: string) {
    const dir = dirname(this.storagePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    if (!existsSync(this.storagePath)) {
      appendFileSync(this.storagePath, '', 'utf8');
    }
  }

  public registerTrade(record: PaperTradeRecord): void {
    const line = JSON.stringify(record) + '\n';
    appendFileSync(this.storagePath, line, 'utf8');
  }

  public calculateCurrentDrawdown(): number {
    if (!existsSync(this.storagePath)) return 0;
    
    try {
      const payload = readFileSync(this.storagePath, 'utf8');
      const lines = payload.split('\n').filter(l => l.trim().length > 0);
      
      let consecutiveLosses = 0;
      // Analisa do mais recente para o mais antigo O(n) limitado à amostragem
      for (let i = lines.length - 1; i >= 0; i--) {
        const record: PaperTradeRecord = JSON.parse(lines[i]);
        if (record.outcome === 'LOSS') {
          consecutiveLosses++;
        } else if (record.outcome === 'WIN') {
          break; // Drawdown interrompido por um Win
        }
      }
      return consecutiveLosses;
    } catch {
      return 0; // Fallback seguro em caso de corrupção do arquivo
    }
  }
}
