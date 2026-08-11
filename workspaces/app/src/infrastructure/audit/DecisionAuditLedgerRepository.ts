import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { IDecisionAuditLedger } from '../../domain/contracts/IDecisionAuditLedger';
import { DecisionAuditEvent } from '../../domain/audit/DecisionAuditEvent';

export class DecisionAuditLedgerRepository implements IDecisionAuditLedger {
  private readonly ledgerPath: string;

  constructor(filePath?: string) {
    this.ledgerPath = filePath || path.join(process.cwd(), 'data', 'audit', 'decision-ledger.jsonl');
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    const dir = path.dirname(this.ledgerPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private generateChecksum(event: Omit<DecisionAuditEvent, 'checksum'>): string {
    const dataString = `${event.eventId}|${event.timestamp}|${event.decision}|${event.reason}|${event.sessionId}`;
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  public logDecision(event: Record<string, unknown>): void {
    const eventId = event.eventId || crypto.randomUUID();
    const timestamp = event.timestamp || new Date().toISOString();
    const decision = event.status || 'UNKNOWN';
    const reason = event.reason || 'NO_REASON';
    const sessionId = event.sessionId || 'SYSTEM';

    this.append({
      eventId,
      timestamp,
      decision,
      reason,
      sessionId
    });
  }

  public append(eventData: Omit<DecisionAuditEvent, 'checksum'>): DecisionAuditEvent {
    const checksum = this.generateChecksum(eventData);
    const event: DecisionAuditEvent = {
      ...eventData,
      checksum
    };

    const jsonlLine = JSON.stringify(event) + '\n';
    
    // Append-only implementation
    fs.appendFileSync(this.ledgerPath, jsonlLine, { encoding: 'utf8' });

    return event;
  }

  public getHistory(): DecisionAuditEvent[] {
    if (!fs.existsSync(this.ledgerPath)) {
      return [];
    }

    const content = fs.readFileSync(this.ledgerPath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim() !== '');
    
    return lines.map(line => JSON.parse(line) as DecisionAuditEvent);
  }

  public verifyIntegrity(): boolean {
    const history = this.getHistory();
    
    for (const event of history) {
      const { checksum: storedChecksum, ...eventData } = event;
      const expectedChecksum = this.generateChecksum(eventData);
      
      if (storedChecksum !== expectedChecksum) {
        return false;
      }
    }
    
    return true;
  }
}
