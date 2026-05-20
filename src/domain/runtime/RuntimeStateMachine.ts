export type RuntimeLifecycleState =
  | 'BOOTSTRAP'
  | 'NO_GO'
  | 'OBSERVE'
  | 'REVIEW'
  | 'ALLOW'
  | 'FREEZE'
  | 'LOCKED'
  | 'BLOCKED'
  | 'SHUTDOWN';

export type RuntimeTransitionVerdict =
  | 'TRANSITION_ACCEPTED'
  | 'TRANSITION_REJECTED';

export interface RuntimeTransitionRequest {
  readonly from: RuntimeLifecycleState;
  readonly to: RuntimeLifecycleState;
  readonly reason: string;
  readonly timestampEpochMs: number;
}

export interface RuntimeTransitionResult {
  readonly verdict: RuntimeTransitionVerdict;
  readonly from: RuntimeLifecycleState;
  readonly to: RuntimeLifecycleState;
  readonly reason: string;
  readonly accepted: boolean;
}

/**
 * Deterministic finite state machine for RL.SYS runtime lifecycle.
 *
 * Complexity:
 * - Time: O(1), using bounded transition sets.
 * - Space: O(1), fixed graph.
 *
 * It prevents illegal operational jumps and makes runtime lifecycle auditable.
 */
export class RuntimeStateMachine {
  private readonly graph: ReadonlyMap<RuntimeLifecycleState, ReadonlySet<RuntimeLifecycleState>>;

  public constructor() {
    this.graph = new Map<RuntimeLifecycleState, ReadonlySet<RuntimeLifecycleState>>([
      ['BOOTSTRAP', new Set(['NO_GO', 'OBSERVE', 'REVIEW', 'BLOCKED', 'SHUTDOWN'])],
      ['NO_GO', new Set(['NO_GO', 'OBSERVE', 'REVIEW', 'FREEZE', 'LOCKED', 'BLOCKED', 'SHUTDOWN'])],
      ['OBSERVE', new Set(['NO_GO', 'OBSERVE', 'REVIEW', 'ALLOW', 'FREEZE', 'LOCKED', 'BLOCKED', 'SHUTDOWN'])],
      ['REVIEW', new Set(['NO_GO', 'OBSERVE', 'REVIEW', 'FREEZE', 'LOCKED', 'BLOCKED', 'SHUTDOWN'])],
      ['ALLOW', new Set(['NO_GO', 'OBSERVE', 'REVIEW', 'FREEZE', 'LOCKED', 'BLOCKED', 'SHUTDOWN'])],
      ['FREEZE', new Set(['REVIEW', 'LOCKED', 'BLOCKED', 'SHUTDOWN'])],
      ['LOCKED', new Set(['REVIEW', 'BLOCKED', 'SHUTDOWN'])],
      ['BLOCKED', new Set(['REVIEW', 'SHUTDOWN'])],
      ['SHUTDOWN', new Set(['SHUTDOWN'])],
    ]);
  }

  public transition(request: RuntimeTransitionRequest): RuntimeTransitionResult {
    const allowedTargets = this.graph.get(request.from);
    const accepted = allowedTargets?.has(request.to) ?? false;

    return {
      verdict: accepted ? 'TRANSITION_ACCEPTED' : 'TRANSITION_REJECTED',
      from: request.from,
      to: request.to,
      reason: accepted
        ? request.reason
        : `illegal runtime transition: ${request.from} -> ${request.to}; ${request.reason}`,
      accepted,
    };
  }

  public canTransition(from: RuntimeLifecycleState, to: RuntimeLifecycleState): boolean {
    return this.graph.get(from)?.has(to) ?? false;
  }
}
