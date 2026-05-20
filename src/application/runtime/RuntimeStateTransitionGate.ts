import {
  RuntimeLifecycleState,
  RuntimeStateMachine,
  RuntimeTransitionResult,
} from '../../domain/runtime/RuntimeStateMachine';

export type RuntimeOperationalVerdict =
  | 'ALLOW'
  | 'NO_GO'
  | 'OBSERVE'
  | 'REVIEW'
  | 'FREEZE'
  | 'LOCKED'
  | 'BLOCKED';

export interface RuntimeStateTransitionGateRequest {
  readonly currentState: RuntimeLifecycleState;
  readonly operationalVerdict: RuntimeOperationalVerdict;
  readonly reason: string;
  readonly timestampEpochMs: number;
}

export interface RuntimeStateTransitionGateResult {
  readonly accepted: boolean;
  readonly previousState: RuntimeLifecycleState;
  readonly nextState: RuntimeLifecycleState;
  readonly operationalVerdict: RuntimeOperationalVerdict;
  readonly transition: RuntimeTransitionResult;
  readonly reason: string;
}

/**
 * Application-level wiring gate between operational verdicts and formal runtime lifecycle.
 *
 * It prevents future integrations from bypassing the finite state machine.
 * No runtime verdict is allowed to mutate lifecycle state without FSM validation.
 *
 * Complexity:
 * - Time: O(1)
 * - Space: O(1)
 */
export class RuntimeStateTransitionGate {
  public constructor(
    private readonly machine: RuntimeStateMachine = new RuntimeStateMachine(),
  ) {}

  public apply(
    request: RuntimeStateTransitionGateRequest,
  ): RuntimeStateTransitionGateResult {
    const nextState = this.mapVerdictToState(request.operationalVerdict);

    const transition = this.machine.transition({
      from: request.currentState,
      to: nextState,
      reason: request.reason,
      timestampEpochMs: request.timestampEpochMs,
    });

    return {
      accepted: transition.accepted,
      previousState: request.currentState,
      nextState: transition.accepted ? nextState : request.currentState,
      operationalVerdict: request.operationalVerdict,
      transition,
      reason: transition.reason,
    };
  }

  private mapVerdictToState(verdict: RuntimeOperationalVerdict): RuntimeLifecycleState {
    if (verdict === 'ALLOW') return 'ALLOW';
    if (verdict === 'NO_GO') return 'NO_GO';
    if (verdict === 'OBSERVE') return 'OBSERVE';
    if (verdict === 'REVIEW') return 'REVIEW';
    if (verdict === 'FREEZE') return 'FREEZE';
    if (verdict === 'LOCKED') return 'LOCKED';
    return 'BLOCKED';
  }
}
