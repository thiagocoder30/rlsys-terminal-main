export type LiveSessionStatus = 'INITIALIZING' | 'WARMED_UP' | 'LIVE_READY' | 'BLOCKED';
export type LiveRoundIngestionStatus = 'ACCEPTED' | 'DUPLICATE_IGNORED' | 'REJECTED';
export type LiveSessionPhase = 'COLLECTING_WARMUP' | 'WARMUP_COMPLETE' | 'DECISION_READY' | 'COOLDOWN' | 'BLOCKED';
export type LiveSessionNextAction = 'INGEST_ROUND' | 'EVALUATE_DECISION' | 'WAIT_COOLDOWN' | 'REJECT_EVENT';

export interface LiveRoundCommand {
  readonly sessionId: string;
  readonly value: number;
  readonly eventId?: string;
  readonly sequence?: number;
  readonly occurredAt?: string;
}

export interface LiveSessionControlFrame {
  readonly phase: LiveSessionPhase;
  readonly nextAction: LiveSessionNextAction;
  readonly spinsUntilWarmup: number;
  readonly spinsUntilDecision: number;
  readonly cooldownRemainingSpins: number;
  readonly decisionWindowSize: number;
  readonly reason: string;
}

export interface RollingMetrics {
  readonly windowSize: number;
  readonly uniqueNumbers: number;
  readonly normalizedEntropy: number;
  readonly repeatRate: number;
  readonly maxNumberConcentration: number;
  readonly alternationRate: number;
}

export interface LiveSessionSnapshot {
  readonly engineVersion: 'live-session-runtime-v1';
  readonly sessionId: string;
  readonly status: LiveSessionStatus;
  readonly roundCount: number;
  readonly acceptedEvents: number;
  readonly duplicateEvents: number;
  readonly rejectedEvents: number;
  readonly lastValue?: number;
  readonly lastSequence?: number;
  readonly warmupProgress: number;
  readonly readyForDecision: boolean;
  readonly historyWindow: readonly number[];
  readonly warmupWindow: readonly number[];
  readonly rolling: RollingMetrics;
  readonly control: LiveSessionControlFrame;
  readonly checksum: string;
  readonly updatedAt: string;
}
