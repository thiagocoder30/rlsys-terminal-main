import type {
  TriplicacaoLiveDiagnosticEvent,
} from './TriplicacaoLiveStatsDiagnostics.js';


/**
 * Canonical counterfactual decision boundary.
 *
 * A Triplicação recommendation can only exist after the opening pair
 * has been completed and BEFORE the third spin is observed.
 *
 * WAITING_SECOND:
 *   first position has just been observed.
 *
 * WAITING_THIRD:
 *   second position has just been observed.
 *   This is the only temporal location where a prospective decision
 *   may exist.
 *
 * WAITING_FIRST:
 *   the fixed trio has already been completed or discarded.
 *
 * ZERO INTEGRITY:
 *
 * A WAITING_THIRD event is NOT a decision point when either opening
 * position is zero. The remaining third position still belongs to the
 * invalidated fixed trio and must be consumed before another trio begins.
 *
 * Counterfactual calibration and settlement must never use information
 * from an invalidated trio or from its third position.
 */
export function isTriplicacaoCounterfactualDecisionPoint(
  event:
    TriplicacaoLiveDiagnosticEvent,
): boolean {
  return (
    event.formationState ===
      'WAITING_THIRD' &&
    event.firstNumber !==
      null &&
    event.secondNumber !==
      null &&
    event.firstNumber !==
      0 &&
    event.secondNumber !==
      0 &&
    event.trioCompleted ===
      false &&
    event.trioDiscarded ===
      false
  );
}


export function triplicacaoCounterfactualDecisionEvents(
  events:
    readonly TriplicacaoLiveDiagnosticEvent[],
): readonly TriplicacaoLiveDiagnosticEvent[] {
  return Object.freeze(
    events.filter(
      isTriplicacaoCounterfactualDecisionPoint,
    ),
  );
}
