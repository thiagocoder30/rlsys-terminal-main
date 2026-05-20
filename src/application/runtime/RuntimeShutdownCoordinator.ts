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
 *
 * It guarantees that shutdown side effects are executed once, even when
 * multiple terminal/process signals arrive in sequence.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class RuntimeShutdownCoordinator {
  private closed = false;

  public constructor(private readonly target: RuntimeShutdownTarget) {}

  public shutdown(reason: RuntimeShutdownReason): RuntimeShutdownResult {
    if (this.closed) {
      return {
        accepted: true,
        reason,
        message: 'runtime shutdown already completed',
      };
    }

    this.closed = true;
    this.target.shutdown();

    return {
      accepted: true,
      reason,
      message: `runtime shutdown completed: ${reason}`,
    };
  }

  public isClosed(): boolean {
    return this.closed;
  }
}
