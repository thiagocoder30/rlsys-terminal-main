export interface DecisionAuditEvent {
  eventId: string;
  timestamp: string;
  decision: string;
  reason: string;
  sessionId: string;
  checksum: string;
}
