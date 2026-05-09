import fs from 'fs/promises';
import path from 'path';

export interface DecisionAuditRecord {
  timestamp: string;
  status: string;
  reason: string;
  sampleSize: number;
  confidenceScore?: number;
  riskLevel?: string;
  stakeFraction?: number;
  riskOfRuin?: number;
}

export class DecisionAuditLogger {
  constructor(private readonly filePath: string) {}

  public async append(record: DecisionAuditRecord): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.appendFile(this.filePath, `${JSON.stringify(record)}\n`, 'utf8');
  }
}
