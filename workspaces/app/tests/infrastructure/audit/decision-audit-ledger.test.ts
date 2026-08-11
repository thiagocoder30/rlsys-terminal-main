import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DecisionAuditLedgerRepository } from '../../../src/infrastructure/audit/DecisionAuditLedgerRepository';

describe('DecisionAuditLedger', () => {
  const testLedgerPath = path.join(process.cwd(), 'data', 'audit', 'test-decision-ledger.jsonl');

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

  it('should append an event successfully', () => {
    const ledger = new DecisionAuditLedgerRepository(testLedgerPath);
    
    const eventData = {
      eventId: '123',
      timestamp: '2023-01-01T00:00:00.000Z',
      decision: 'AUTHORIZED',
      reason: 'TEST',
      sessionId: 'sess-1'
    };

    const appendedEvent = ledger.append(eventData);

    expect(appendedEvent.checksum).toBeDefined();
    expect(fs.existsSync(testLedgerPath)).toBe(true);

    const content = fs.readFileSync(testLedgerPath, 'utf8');
    expect(content).toContain('123');
    expect(content).toContain('AUTHORIZED');
  });

  it('should reconstruct history from jsonl file', () => {
    const ledger = new DecisionAuditLedgerRepository(testLedgerPath);
    
    ledger.append({
      eventId: 'evt-1',
      timestamp: '2023-01-01T00:00:01.000Z',
      decision: 'AUTHORIZED',
      reason: 'TEST 1',
      sessionId: 'sess-1'
    });

    ledger.append({
      eventId: 'evt-2',
      timestamp: '2023-01-01T00:00:02.000Z',
      decision: 'BLOCKED',
      reason: 'TEST 2',
      sessionId: 'sess-1'
    });

    const history = ledger.getHistory();
    expect(history.length).toBe(2);
    expect(history[0].eventId).toBe('evt-1');
    expect(history[1].eventId).toBe('evt-2');
  });

  it('should correctly adapt logDecision to append', () => {
    const ledger = new DecisionAuditLedgerRepository(testLedgerPath);

    ledger.logDecision({
      action: 'PLAY',
      status: 'BLOCKED',
      reason: 'GOVERNANCE_VIOLATION'
    });

    const history = ledger.getHistory();
    expect(history.length).toBe(1);
    expect(history[0].decision).toBe('BLOCKED');
    expect(history[0].reason).toBe('GOVERNANCE_VIOLATION');
  });
});
