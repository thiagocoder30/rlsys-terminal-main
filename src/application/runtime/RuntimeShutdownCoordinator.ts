import {
  RuntimeSessionJournalRepository,
} from '../../domain/journal/RuntimeSessionJournalContracts';
import { RuntimeSessionIdentity } from '../../domain/session';

export type RuntimeShutdownReason =
  | 'OPERATOR_QUIT'
  | 'SIGINT'
  | 'SIGTERM'
  | 'UNCAUGHT_EXCEPTION'
  | 'UNHANDLED_REJECTION'
  | 'REPL_CLOSED'
  | 'UNKNOWN';

export interface RuntimeShutdownTarget {
  shutdown(): void;
}

export interface RuntimeShutdownResult {
  readonly accepted: boolean;
  readonly reason: RuntimeShutdownReason;
  readonly message: string;
}

const DEFAULT_SESSION_IDENTITY: RuntimeSessionIdentity = {
  sessionId: 'runtime-kernel',
  startedAtEpochMs: 0,
};

/**
 * Idempotent shutdown coordinator for the runtime kernel.
 */
export class RuntimeShutdownCoordinator {
  private closed = false;
  private sequence = 0;

  public constructor(
    private readonly target: RuntimeShutdownTarget,
    private readonly journalRepository: RuntimeSessionJournalRepository | null = null,
    private readonly identity: RuntimeSessionIdentity = DEFAULT_SESSION_IDENTITY,
  ) {}

  public shutdown(reason: RuntimeShutdownReason): RuntimeShutdownResult {
    if (this.closed) {
      return {
        accepted: true,
        reason,
        message: 'runtime shutdown already completed',
      };
    }

    this.closed = true;
    this.sequence += 1;
    this.target.shutdown();
    void this.appendShutdownJournal(reason);

    return {
      accepted: true,
      reason,
      message: `runtime shutdown completed: ${reason}`,
    };
  }

  public isClosed(): boolean {
    return this.closed;
  }

  private async appendShutdownJournal(reason: RuntimeShutdownReason): Promise<void> {
    if (this.journalRepository === null) {
      return;
    }

    await this.journalRepository.append({
      eventId: `shutdown:${this.identity.sessionId}:${this.sequence}:${reason}`,
      sessionId: this.identity.sessionId,
      sequence: this.sequence,
      timestampEpochMs: Date.now(),
      type: 'SHUTDOWN',
      lifecycleState: 'SHUTDOWN',
      verdict: 'SHUTDOWN',
      reason,
      payload: {
        reason,
        sessionId: this.identity.sessionId,
      },
    });
  }
}
