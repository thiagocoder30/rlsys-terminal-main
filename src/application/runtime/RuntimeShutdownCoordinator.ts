import {
  RuntimeSessionJournalRepository,
} from '../../domain/journal/RuntimeSessionJournalContracts';

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

/**
 * Idempotent shutdown coordinator for the runtime kernel.
 */
export class RuntimeShutdownCoordinator {
  private closed = false;
  private sequence = 0;

  public constructor(
    private readonly target: RuntimeShutdownTarget,
    private readonly journalRepository: RuntimeSessionJournalRepository | null = null,
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
      eventId: `shutdown:${this.sequence}:${reason}`,
      sessionId: 'runtime-kernel',
      sequence: this.sequence,
      timestampEpochMs: Date.now(),
      type: 'SHUTDOWN',
      lifecycleState: 'SHUTDOWN',
      verdict: 'SHUTDOWN',
      reason,
      payload: { reason },
    });
  }
}
