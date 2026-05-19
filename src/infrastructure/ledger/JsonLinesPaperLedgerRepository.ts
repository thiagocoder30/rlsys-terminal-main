import * as fs from 'fs';
import * as path from 'path';
import {
  IPaperLedgerRepository,
  PaperLedgerAppendStatus,
  PaperLedgerRecord,
  PaperLedgerSnapshot
} from '../../domain/ledger/PaperLedgerContracts';

export class JsonLinesPaperLedgerRepository implements IPaperLedgerRepository {
  private readonly filePath: string;
  private readonly eventIds = new Set<string>();

  public constructor(storageDirectory: string, fileName = 'paper-ledger.jsonl') {
    if (!fs.existsSync(storageDirectory)) {
      fs.mkdirSync(storageDirectory, { recursive: true });
    }

    this.filePath = path.join(storageDirectory, fileName);
    this.indexExistingEventIds();
  }

  public async appendRecord(record: PaperLedgerRecord): Promise<PaperLedgerAppendStatus> {
    if (this.eventIds.has(record.eventId)) {
      return 'DUPLICATE';
    }

    await fs.promises.appendFile(this.filePath, `${JSON.stringify(record)}\n`, 'utf8');
    this.eventIds.add(record.eventId);

    return 'APPENDED';
  }

  public async getLatestSnapshot(): Promise<PaperLedgerSnapshot | null> {
    if (!fs.existsSync(this.filePath)) {
      return null;
    }

    const content = await fs.promises.readFile(this.filePath, 'utf8');
    const lines = content.trim().split('\n').filter((line: string) => line.trim().length > 0);

    if (lines.length === 0) {
      return null;
    }

    const last = JSON.parse(lines[lines.length - 1]) as PaperLedgerRecord;

    return {
      runningBalance: last.runningBalance,
      peakBalance: last.peakBalance,
      maxDrawdown: last.maxDrawdown,
      lastEventId: last.eventId
    };
  }

  public getPath(): string {
    return this.filePath;
  }

  private indexExistingEventIds(): void {
    if (!fs.existsSync(this.filePath)) {
      return;
    }

    const content = fs.readFileSync(this.filePath, 'utf8');
    const lines = content.split('\n').filter((line: string) => line.trim().length > 0);

    for (const line of lines) {
      try {
        const record = JSON.parse(line) as PaperLedgerRecord;
        this.eventIds.add(record.eventId);
      } catch {
        continue;
      }
    }
  }
}
