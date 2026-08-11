import { DecisionAuditEvent } from '../audit/DecisionAuditEvent';

export interface IDecisionAuditLedger {
  logDecision(event: Record<string, unknown>): void;
  append(event: Omit<DecisionAuditEvent, 'checksum'>): DecisionAuditEvent;
  verifyIntegrity(): boolean;
  getHistory(): DecisionAuditEvent[];
}
