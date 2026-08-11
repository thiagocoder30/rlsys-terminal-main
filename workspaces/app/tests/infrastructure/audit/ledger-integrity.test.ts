import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DecisionAuditLedgerRepository } from '../../../src/infrastructure/audit/DecisionAuditLedgerRepository';
import { DecisionAuditEvent } from '../../../src/domain/audit/DecisionAuditEvent';

describe('Ledger Integrity Verification', () => {
  const testLedgerPath = path.join(process.cwd(), 'data', 'audit', 'integrity-test-ledger.jsonl');

  beforeEach(() => {
    if (fs.existsSync(testLedgerPath)) {
      fs.unlinkSync(testLedgerPath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(testLedgerPath)) {
      fs.unlinkSync(testLedgerPath);
    }
  });

  it('should pass integrity check for a valid ledger', () => {
    const ledger = new DecisionAuditLedgerRepository(testLedgerPath);
    
    ledger.append({
      eventId: 'evt-1',
      timestamp: '2023-01-01T00:00:01.000Z',
      decision: 'AUTHORIZED',
      reason: 'TEST',
      sessionId: 'sess-1'
    });

    const isIntegrityValid = ledger.verifyIntegrity();
    expect(isIntegrityValid).toBe(true);
  });

  it('should fail integrity check if a record is manually altered', () => {
    const ledger = new DecisionAuditLedgerRepository(testLedgerPath);
    
    ledger.append({
      eventId: 'evt-1',
      timestamp: '2023-01-01T00:00:01.000Z',
      decision: 'AUTHORIZED',
      reason: 'TEST',
      sessionId: 'sess-1'
    });

    // Simulate tampering by reading, altering, and rewriting the file
    const content = fs.readFileSync(testLedgerPath, 'utf8');
    const records = content.split('\n').filter(l => l.trim() !== '');
    
    const tamperedRecord = JSON.parse(records[0]) as DecisionAuditEvent;
    tamperedRecord.decision = 'BLOCKED'; // Alter the decision
    
    fs.writeFileSync(testLedgerPath, JSON.stringify(tamperedRecord) + '\n', 'utf8');

    const isIntegrityValid = ledger.verifyIntegrity();
    expect(isIntegrityValid).toBe(false);
  });

  it('should fail integrity check if checksum is manually altered', () => {
    const ledger = new DecisionAuditLedgerRepository(testLedgerPath);
    
    ledger.append({
      eventId: 'evt-1',
      timestamp: '2023-01-01T00:00:01.000Z',
      decision: 'AUTHORIZED',
      reason: 'TEST',
      sessionId: 'sess-1'
    });

    // Simulate tampering with the checksum
    const content = fs.readFileSync(testLedgerPath, 'utf8');
    const records = content.split('\n').filter(l => l.trim() !== '');
    
    const tamperedRecord = JSON.parse(records[0]) as DecisionAuditEvent;
    tamperedRecord.checksum = 'invalid-checksum';
    
    fs.writeFileSync(testLedgerPath, JSON.stringify(tamperedRecord) + '\n', 'utf8');

    const isIntegrityValid = ledger.verifyIntegrity();
    expect(isIntegrityValid).toBe(false);
  });
});
