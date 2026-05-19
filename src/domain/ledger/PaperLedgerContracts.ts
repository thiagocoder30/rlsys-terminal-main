export type PaperDecisionType =
  | 'SIGNAL'
  | 'NO_GO'
  | 'OBSERVE'
  | 'REVIEW'
  | 'LOCKED';

export interface PaperLedgerRecord {
  readonly eventId: string;
  readonly sourceEventId: string;
  readonly sessionId: string;
  readonly snapshotId: string;
  readonly timestampMs: number;
  readonly decisionType: PaperDecisionType;
  readonly theoreticalStake: number;
  readonly theoreticalPnl: number;
  readonly runningBalance: number;
  readonly peakBalance: number;
  readonly drawdown: number;
  readonly maxDrawdown: number;
  readonly expectedEV: number;
  readonly confidence: number;
  readonly decisionLatencyMs: number;
  readonly reason: string;
}

export interface PaperLedgerSnapshot {
  readonly runningBalance: number;
  readonly peakBalance: number;
  readonly maxDrawdown: number;
  readonly lastEventId: string;
}

export type PaperLedgerAppendStatus = 'APPENDED' | 'DUPLICATE';

export interface IPaperLedgerRepository {
  appendRecord(record: PaperLedgerRecord): Promise<PaperLedgerAppendStatus>;
  getLatestSnapshot(): Promise<PaperLedgerSnapshot | null>;
}

export interface PaperLedgerDecisionInput {
  readonly sourceEventId: string;
  readonly sessionId: string;
  readonly snapshotId: string;
  readonly timestampMs: number;
  readonly decisionType: PaperDecisionType;
  readonly theoreticalStake?: number;
  readonly theoreticalPnl?: number;
  readonly expectedEV: number;
  readonly confidence: number;
  readonly decisionLatencyMs: number;
  readonly reason: string;
}

export interface PaperLedgerState {
  readonly runningBalance: number;
  readonly peakBalance: number;
  readonly drawdown: number;
  readonly maxDrawdown: number;
  readonly recordedEvents: number;
}

export interface PaperLedgerOk {
  readonly ok: true;
  readonly record: PaperLedgerRecord;
  readonly duplicate: boolean;
  readonly state: PaperLedgerState;
}

export interface PaperLedgerErr {
  readonly ok: false;
  readonly error: string;
}

export type PaperLedgerResult = PaperLedgerOk | PaperLedgerErr;
