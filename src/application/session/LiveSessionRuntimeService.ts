import { LiveRoundCommand, LiveRoundIngestionReport, LiveSessionRuntime, LiveSessionSnapshot } from '../../domain/session/LiveSessionRuntime';
import { StrategyDecisionService, StrategyDecisionServiceReport } from '../decision/StrategyDecisionService';
import { OperationalGateState } from '../../domain/decision/StrategyDecisionEngine';

export interface LiveSessionRuntimeServiceInput {
  readonly sessionId?: string;
  readonly value?: number;
  readonly eventId?: string;
  readonly sequence?: number;
  readonly occurredAt?: string;
  readonly bankroll?: number;
}

export interface LiveSessionRuntimeServiceReport {
  readonly service: 'LiveSessionRuntimeService';
  readonly schemaVersion: '2.9.0';
  readonly status: 'ACCEPTED' | 'DUPLICATE_IGNORED' | 'REJECTED';
  readonly sessionId: string;
  readonly ingestion?: LiveRoundIngestionReport;
  readonly snapshot: LiveSessionSnapshot;
  readonly decision?: StrategyDecisionServiceReport;
  readonly executiveSummary: {
    readonly liveRuntimeGate: 'INITIALIZING' | 'WARMUP_COMPLETE' | 'DECISION_READY' | 'COOLDOWN' | 'BLOCKED';
    readonly operationalGate: OperationalGateState | 'BLOCKED';
    readonly reason: string;
    readonly nextAction: 'COLLECT_MORE_ROUNDS' | 'REVIEW_DECISION_REPORT' | 'WAIT_COOLDOWN' | 'REJECT_EVENT';
  };
  readonly generatedAt: string;
}

/**
 * Application boundary for round-by-round live session ingestion.
 *
 * The service preserves Clean Architecture by keeping runtime state in the domain
 * engine and using the StrategyDecisionService only after the warm-up window is
 * complete. Repeated events are idempotently ignored through the runtime engine.
 */
export class LiveSessionRuntimeService {
  private readonly runtime: LiveSessionRuntime;
  private readonly decisionService: StrategyDecisionService;

  constructor(runtime = new LiveSessionRuntime(), decisionService = new StrategyDecisionService()) {
    this.runtime = runtime;
    this.decisionService = decisionService;
  }

  public ingest(input: LiveSessionRuntimeServiceInput | unknown): LiveSessionRuntimeServiceReport {
    const command = this.normalizeCommand(input);
    const result = this.runtime.ingest(command);
    if (!result.success) {
      const snapshot = this.emptySnapshot(command.sessionId || 'invalid-session');
      return {
        service: 'LiveSessionRuntimeService',
        schemaVersion: '2.9.0',
        status: 'REJECTED',
        sessionId: command.sessionId || 'invalid-session',
        snapshot,
        executiveSummary: {
          liveRuntimeGate: 'BLOCKED',
          operationalGate: 'BLOCKED',
          reason: result.error.message,
          nextAction: 'REJECT_EVENT'
        },
        generatedAt: new Date().toISOString()
      };
    }

    const ingestion = result.value;
    const snapshot = ingestion.snapshot;
    const decision = snapshot.readyForDecision
      ? this.decisionService.evaluate({ values: snapshot.warmupWindow, bankroll: this.safeBankroll(input), sessionId: snapshot.sessionId, source: 'live-runtime' })
      : undefined;

    return {
      service: 'LiveSessionRuntimeService',
      schemaVersion: '2.9.0',
      status: ingestion.status,
      sessionId: snapshot.sessionId,
      ingestion,
      snapshot,
      decision,
      executiveSummary: this.summary(snapshot, ingestion.status, decision),
      generatedAt: new Date().toISOString()
    };
  }

  public snapshot(sessionId: string): LiveSessionRuntimeServiceReport {
    const result = this.runtime.snapshotBySession(sessionId);
    if (!result.success) {
      const reset = this.runtime.reset(sessionId || 'unknown-session');
      const snapshot = reset.success ? reset.value : this.emptySnapshot(sessionId || 'unknown-session');
      return {
        service: 'LiveSessionRuntimeService',
        schemaVersion: '2.9.0',
        status: 'REJECTED',
        sessionId: snapshot.sessionId,
        snapshot,
        executiveSummary: {
          liveRuntimeGate: 'BLOCKED',
          operationalGate: 'BLOCKED',
          reason: result.error.message,
          nextAction: 'REJECT_EVENT'
        },
        generatedAt: new Date().toISOString()
      };
    }
    return {
      service: 'LiveSessionRuntimeService',
      schemaVersion: '2.9.0',
      status: 'ACCEPTED',
      sessionId: result.value.sessionId,
      snapshot: result.value,
      executiveSummary: this.summary(result.value, 'ACCEPTED'),
      generatedAt: new Date().toISOString()
    };
  }

  private normalizeCommand(input: LiveSessionRuntimeServiceInput | unknown): LiveRoundCommand {
    if (!input || typeof input !== 'object') {
      return { sessionId: 'invalid-session', value: Number.NaN };
    }
    const payload = input as LiveSessionRuntimeServiceInput;
    return {
      sessionId: typeof payload.sessionId === 'string' ? payload.sessionId : 'default-live-session',
      value: Number(payload.value),
      eventId: typeof payload.eventId === 'string' ? payload.eventId : undefined,
      sequence: Number.isInteger(payload.sequence) ? payload.sequence : undefined,
      occurredAt: typeof payload.occurredAt === 'string' ? payload.occurredAt : undefined
    };
  }

  private safeBankroll(input: LiveSessionRuntimeServiceInput | unknown): number {
    if (!input || typeof input !== 'object') return 0;
    const bankroll = Number((input as LiveSessionRuntimeServiceInput).bankroll ?? 0);
    return Number.isFinite(bankroll) && bankroll > 0 ? bankroll : 0;
  }

  private summary(
    snapshot: LiveSessionSnapshot,
    ingestionStatus: LiveRoundIngestionReport['status'],
    decision?: StrategyDecisionServiceReport
  ): LiveSessionRuntimeServiceReport['executiveSummary'] {
    if (snapshot.status === 'BLOCKED') {
      return { liveRuntimeGate: 'BLOCKED', operationalGate: 'BLOCKED', reason: 'Live runtime is blocked by validation or governance.', nextAction: 'REJECT_EVENT' };
    }
    if (snapshot.control.phase === 'COOLDOWN') {
      return { liveRuntimeGate: 'COOLDOWN', operationalGate: 'COOLDOWN', reason: snapshot.control.reason, nextAction: 'WAIT_COOLDOWN' };
    }
    if (!snapshot.readyForDecision || snapshot.control.phase === 'COLLECTING_WARMUP') {
      return { liveRuntimeGate: 'INITIALIZING', operationalGate: 'BLOCKED', reason: snapshot.control.reason, nextAction: 'COLLECT_MORE_ROUNDS' };
    }
    if (snapshot.control.phase === 'WARMUP_COMPLETE') {
      return { liveRuntimeGate: 'WARMUP_COMPLETE', operationalGate: 'OBSERVE', reason: snapshot.control.reason, nextAction: 'COLLECT_MORE_ROUNDS' };
    }
    if (ingestionStatus === 'DUPLICATE_IGNORED') {
      return { liveRuntimeGate: 'DECISION_READY', operationalGate: 'BLOCKED', reason: 'Duplicate event ignored; last valid decision state preserved.', nextAction: 'REVIEW_DECISION_REPORT' };
    }
    return {
      liveRuntimeGate: 'DECISION_READY',
      operationalGate: decision?.decision.operationalGate ?? 'OBSERVE',
      reason: decision
        ? `Decision engine returned ${decision.decision.action} with gate ${decision.decision.operationalGate} under research governance.`
        : 'Decision window ready for review.',
      nextAction: 'REVIEW_DECISION_REPORT'
    };
  }

  private emptySnapshot(sessionId: string): LiveSessionSnapshot {
    return {
      engineVersion: 'live-session-runtime-v1',
      sessionId,
      status: 'BLOCKED',
      roundCount: 0,
      acceptedEvents: 0,
      duplicateEvents: 0,
      rejectedEvents: 1,
      warmupProgress: 0,
      readyForDecision: false,
      historyWindow: [],
      warmupWindow: [],
      rolling: { windowSize: 0, uniqueNumbers: 0, normalizedEntropy: 0, repeatRate: 0, maxNumberConcentration: 0, alternationRate: 0 },
      control: { phase: 'BLOCKED', nextAction: 'REJECT_EVENT', spinsUntilWarmup: 100, spinsUntilDecision: 100, cooldownRemainingSpins: 0, decisionWindowSize: 100, reason: 'Snapshot vazio criado para evento rejeitado.' },
      checksum: '',
      updatedAt: new Date().toISOString()
    };
  }
}
